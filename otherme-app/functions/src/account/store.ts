/**
 * Account linking (Part B) — pairing-code based, preview-before-commit.
 *
 *   link_codes/{code}      sourceUid, sourceProvider, createdAt, expiresAt (10 min), attempts
 *   link_tickets/{id}      short-lived (2 min) preview-confirmed merge, single-use
 *   identity_links/{uid}   canonicalUid pointer — a doc only exists for a uid that
 *                          was folded away; "no doc" = you are canonical (default)
 *
 * The merge transaction mirrors credits/store.ts's spend()/recordPurchase()
 * shape exactly: read everything first, then write balance + ledger + link
 * state together so they can never drift apart.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { entriesRef, userRef, WELCOME_CREDITS } from "../credits/store.js";
import { mintSessionToken } from "../auth/store.js";

const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const LINK_CODE_MAX_ATTEMPTS = 5;
const TICKET_TTL_MS = 2 * 60 * 1000;

// Excludes ambiguous characters (0/O, 1/I/L) — this code gets read aloud/typed.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export type Provider = "nimiq" | "email" | "google";

interface LinkCode {
  sourceUid: string;
  sourceProvider: Provider;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

interface LinkTicket {
  code: string;
  sourceUid: string;
  targetUid: string;
  mergedTotal: number;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
}

const db = () => getFirestore();
const linkCodes = () => db().collection("link_codes");
const linkTickets = () => db().collection("link_tickets");
const identityLinks = () => db().collection("identity_links");

function generateCode(): string {
  return Array.from(randomBytes(8), b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

/** True if `uid` is already folded into another account (not canonical). */
export async function isLinkedAway(uid: string): Promise<boolean> {
  const snap = await identityLinks().doc(uid).get();
  return snap.exists;
}

export async function createLinkCode(sourceUid: string, sourceProvider: Provider): Promise<{ code: string; expiresAt: number }> {
  const now = Date.now();
  const expiresAt = now + LINK_CODE_TTL_MS;
  // Astronomically unlikely to collide (33^8 space), but a fresh doc write
  // means we don't need to check first — `set` on a new random id is safe.
  const code = generateCode();
  await linkCodes().doc(code).set({ sourceUid, sourceProvider, createdAt: now, expiresAt, attempts: 0 } satisfies LinkCode);
  return { code, expiresAt };
}

export type PreviewResult =
  | { ok: true; ticketId: string; sourceProvider: Provider; sourceBalance: number; targetBalance: number; mergedTotal: number; expiresAt: number }
  | { ok: false; error: string };

/** Preview a code redemption — validates and computes the merge math, but
 * commits nothing. `targetUid` is the freshly-authenticated redeeming account.
 * `targetProvider` (from the caller's own verified claims) backfills
 * users/{targetUid}.provider if a startup race with credits/store.ts's
 * migrateBalance() ever left it unset — see ensureUser's doc comment. */
export async function previewLinkCode(code: string, targetUid: string, targetProvider: Provider): Promise<PreviewResult> {
  const codeRef = linkCodes().doc(code.toUpperCase());
  const codeSnap = await codeRef.get();
  if (!codeSnap.exists)
    return { ok: false, error: "Invalid or expired code." };

  const data = codeSnap.data() as LinkCode;
  if (Date.now() > data.expiresAt) {
    await codeRef.delete();
    return { ok: false, error: "Code expired — request a new one." };
  }
  if (data.attempts >= LINK_CODE_MAX_ATTEMPTS) {
    await codeRef.delete();
    return { ok: false, error: "Too many attempts on this code — request a new one." };
  }
  await codeRef.update({ attempts: FieldValue.increment(1) });

  if (data.sourceUid === targetUid)
    return { ok: false, error: "You can't link an account to itself." };

  const [sourceLinked, targetLinked] = await Promise.all([isLinkedAway(data.sourceUid), isLinkedAway(targetUid)]);
  if (sourceLinked || targetLinked)
    return { ok: false, error: "One of these accounts is already linked to another — unlink first." };

  const [sourceSnap, targetSnap] = await Promise.all([userRef(data.sourceUid).get(), userRef(targetUid).get()]);
  const sourceBalance = sourceSnap.data()?.balance ?? 0;
  const targetData = targetSnap.data() ?? {};
  const targetBalance = targetData.balance ?? 0;
  if (!targetData.provider)
    await userRef(targetUid).set({ provider: targetProvider }, { merge: true });
  // Required, not optional: without subtracting an already-granted welcome
  // bonus, linking becomes a repeatable free-credit farm (throwaway accounts,
  // each collects its own welcome grant, then link them all in).
  const foldedAmount = targetData.welcomeGranted ? Math.max(0, targetBalance - WELCOME_CREDITS) : targetBalance;
  const mergedTotal = sourceBalance + foldedAmount;

  const ticketId = randomUUID();
  const expiresAt = Date.now() + TICKET_TTL_MS;
  await linkTickets().doc(ticketId).set({
    code: codeRef.id,
    sourceUid: data.sourceUid,
    targetUid,
    mergedTotal,
    createdAt: Date.now(),
    expiresAt,
    consumed: false,
  } satisfies LinkTicket);

  return { ok: true, ticketId, sourceProvider: data.sourceProvider, sourceBalance, targetBalance, mergedTotal, expiresAt };
}

export type CommitResult = { ok: true; token: string; uid: string } | { ok: false; error: string };

/** Commit a previewed link. Idempotent against replay via the ticket's
 * `consumed` flag and the code doc's existence (both checked inside the tx). */
export async function commitLink(ticketId: string): Promise<CommitResult> {
  const ticketRef = linkTickets().doc(ticketId);

  const txResult = await db().runTransaction(async (tx) => {
    const ticketSnap = await tx.get(ticketRef);
    if (!ticketSnap.exists)
      return { ok: false as const, error: "Link confirmation expired — start over." };
    const ticket = ticketSnap.data() as LinkTicket;
    if (ticket.consumed)
      return { ok: false as const, error: "This link was already completed." };
    if (Date.now() > ticket.expiresAt)
      return { ok: false as const, error: "Confirmation expired — start over." };

    const codeRef = linkCodes().doc(ticket.code);
    const sourceRef = userRef(ticket.sourceUid);
    const targetRef = userRef(ticket.targetUid);
    // All reads before any writes — Admin SDK transaction requirement.
    const [codeSnap, sourceSnap, targetSnap] = await Promise.all([tx.get(codeRef), tx.get(sourceRef), tx.get(targetRef)]);
    if (!codeSnap.exists)
      return { ok: false as const, error: "Code already used or expired — start over." };

    const targetData = targetSnap.data() ?? {};
    const targetBalance = targetData.balance ?? 0;
    const foldedAmount = targetData.welcomeGranted ? Math.max(0, targetBalance - WELCOME_CREDITS) : targetBalance;
    const sourceProvider = (sourceSnap.data()?.provider as Provider | undefined) ?? "nimiq";

    tx.update(sourceRef, {
      balance: FieldValue.increment(foldedAmount),
      linkedUids: FieldValue.arrayUnion(ticket.targetUid),
    });
    tx.set(entriesRef(ticket.sourceUid).doc(`link-merge-${Date.now()}`), {
      delta: foldedAmount,
      kind: "link-merge",
      at: Date.now(),
      note: `merged from ${ticket.targetUid}`,
    });
    // Never delete the secondary's doc — a stale client reading it should see
    // balance 0 and the merge pointer, not a ghost/error.
    tx.set(targetRef, { mergedInto: ticket.sourceUid, mergedAt: Date.now(), balance: 0 }, { merge: true });
    tx.set(identityLinks().doc(ticket.targetUid), {
      canonicalUid: ticket.sourceUid,
      provider: targetData.provider ?? "unknown",
      linkedAt: Date.now(),
    });
    tx.delete(codeRef);
    tx.update(ticketRef, { consumed: true });

    return { ok: true as const, canonicalUid: ticket.sourceUid, sourceProvider };
  });

  if (!txResult.ok)
    return txResult;

  const token = await mintSessionToken(txResult.canonicalUid, txResult.sourceProvider);
  return { ok: true, token, uid: txResult.canonicalUid };
}

export type UnlinkResult = { ok: true } | { ok: false; error: string };

/** Unlink a secondary uid from the caller's (canonical) account. Does not
 * restore the secondary's folded-in balance — one-way by design (see backlog
 * "Deferred"); it only reverses the *link*, letting the secondary account sign
 * in independently again. */
export async function unlinkAccount(canonicalUid: string, secondaryUid: string): Promise<UnlinkResult> {
  const linkRef = identityLinks().doc(secondaryUid);
  const linkSnap = await linkRef.get();
  if (!linkSnap.exists || linkSnap.data()?.canonicalUid !== canonicalUid)
    return { ok: false, error: "That account isn't linked to yours." };

  await db().runTransaction(async (tx) => {
    tx.delete(linkRef);
    tx.update(userRef(canonicalUid), { linkedUids: FieldValue.arrayRemove(secondaryUid) });
    tx.update(userRef(secondaryUid), { mergedInto: FieldValue.delete(), mergedAt: FieldValue.delete() });
  });
  // Force both sides to re-authenticate on their next token refresh — the
  // caller's own current request already went through requireFreshUid, so
  // this doesn't interrupt the in-flight response.
  await Promise.all([
    getAuth().revokeRefreshTokens(canonicalUid),
    getAuth().revokeRefreshTokens(secondaryUid),
  ]);
  return { ok: true };
}
