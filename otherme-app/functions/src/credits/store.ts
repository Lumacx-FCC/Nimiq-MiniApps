/**
 * Server-authoritative credits ledger (Phase 2).
 *
 *   users/{address}                              balance + welcomeGranted (init flag)
 *   ledger_entries/{address}/entries/{entryId}   append-only history; doc id gives
 *                                                idempotency (txHash for purchases)
 *
 * balance is always mutated inside the same transaction that appends its ledger
 * entry, so the two never drift. All reads/writes are keyed by the caller's
 * verified uid (their NQ address) — never a client-supplied id.
 */
import { FieldValue, getFirestore } from "firebase-admin/firestore";

/** Starter credits for a brand-new ledger (mirrors client WELCOME_CREDITS). */
export const WELCOME_CREDITS = 5;
/** Sanity ceiling on a self-imported balance (test credits; tighten for real money). */
const MAX_IMPORT = 1_000_000;
const HISTORY_LIMIT = 25;

export type LedgerKind = "welcome" | "migrate" | "purchase" | "spend" | "link-merge";

export interface LedgerEntry {
  delta: number;
  kind: LedgerKind;
  at: number;
  txHash?: string;
  method?: string;
  note?: string;
}

const db = () => getFirestore();
export const userRef = (address: string) => db().collection("users").doc(address);
// Top-level ledger_entries/{address}/entries/{id} — matches firestore.rules and
// the design-doc data model (so a Phase 4 client onSnapshot passes the rules).
export const entriesRef = (address: string) => db().collection("ledger_entries").doc(address).collection("entries");

export interface LinkedAccount {
  uid: string;
  provider: "nimiq" | "email" | "google" | "unknown";
}

export interface BalanceView {
  balance: number;
  welcomeGranted: boolean;
  history: LedgerEntry[];
  primaryProvider: string | null;
  linkedAccounts: LinkedAccount[];
}

async function readHistory(address: string): Promise<LedgerEntry[]> {
  const snap = await entriesRef(address).orderBy("at", "desc").limit(HISTORY_LIMIT).get();
  return snap.docs.map(d => d.data() as LedgerEntry);
}

/** Resolve each linked uid's provider label for display (Part D). Best-effort —
 * a uid that vanished (shouldn't happen) is just omitted, not an error. */
async function readLinkedAccounts(linkedUids: string[]): Promise<LinkedAccount[]> {
  if (!linkedUids.length)
    return [];
  const snaps = await Promise.all(linkedUids.map(uid => userRef(uid).get()));
  return snaps
    .filter(s => s.exists)
    .map(s => ({ uid: s.id, provider: (s.data()?.provider as LinkedAccount["provider"]) ?? "unknown" }));
}

export async function getBalance(address: string): Promise<BalanceView> {
  const snap = await userRef(address).get();
  const data = snap.exists ? snap.data()! : {};
  return {
    balance: data.balance ?? 0,
    welcomeGranted: data.welcomeGranted ?? false,
    history: await readHistory(address),
    primaryProvider: data.provider ?? null,
    linkedAccounts: await readLinkedAccounts(data.linkedUids ?? []),
  };
}

/**
 * One-time guarded self-import (Phase 2 migration). If the ledger was never
 * initialized (welcomeGranted false), set the balance from the client's
 * reported localStorage balance (clamped), never below the welcome grant, and
 * lock it. Idempotent: once initialized, returns the current balance untouched.
 */
export async function migrateBalance(address: string, localBalance: number): Promise<BalanceView> {
  const imported = Math.max(0, Math.min(Math.floor(Number.isFinite(localBalance) ? localBalance : 0), MAX_IMPORT));
  const seeded = Math.max(imported, WELCOME_CREDITS);

  await db().runTransaction(async (tx) => {
    const ref = userRef(address);
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data()! : {};
    if (data.welcomeGranted)
      return; // already initialized — no-op

    tx.set(ref, {
      nimAddress: address,
      balance: seeded,
      welcomeGranted: true,
      createdAt: data.createdAt ?? Date.now(),
    }, { merge: true });
    tx.set(entriesRef(address).doc(`init-${Date.now()}`), {
      delta: seeded,
      kind: imported > WELCOME_CREDITS ? "migrate" : "welcome",
      at: Date.now(),
      note: imported > WELCOME_CREDITS ? `self-import of ${imported}` : "welcome credits",
    } satisfies LedgerEntry);
  });

  return getBalance(address);
}

/** Atomic debit. Rejects (ok:false) when the server balance is short. */
export async function spend(address: string, amount: number, kind: string): Promise<{ ok: boolean; balance: number }> {
  const debit = Math.floor(amount);
  if (!Number.isFinite(debit) || debit <= 0)
    return { ok: false, balance: (await getBalance(address)).balance };

  return db().runTransaction(async (tx) => {
    const ref = userRef(address);
    const snap = await tx.get(ref);
    const balance = snap.exists ? (snap.data()!.balance ?? 0) : 0;
    if (balance < debit)
      return { ok: false, balance };

    tx.update(ref, { balance: FieldValue.increment(-debit) });
    tx.set(entriesRef(address).doc(`spend-${Date.now()}-${debit}`), {
      delta: -debit,
      kind: "spend",
      at: Date.now(),
      note: String(kind).slice(0, 40),
    } satisfies LedgerEntry);
    return { ok: true, balance: balance - debit };
  });
}

/**
 * Record a purchase and credit the balance. Idempotent by txHash (the ledger
 * entry doc id), so a replay can't double-grant.
 *
 * TEMPORARY (Phase 2): trusts the client-reported credits, same trust level as
 * the current MVP. Phase 4 replaces this with the on-chain reconciler.
 */
export async function recordPurchase(
  address: string,
  txHash: string,
  credits: number,
  method: string,
  amount: number,
): Promise<{ balance: number; alreadyRecorded: boolean }> {
  const grant = Math.max(0, Math.floor(credits));
  const entryId = `tx-${txHash}`;

  return db().runTransaction(async (tx) => {
    const ref = userRef(address);
    const entryDoc = entriesRef(address).doc(entryId);
    const [userSnap, entrySnap] = await Promise.all([tx.get(ref), tx.get(entryDoc)]);
    const balance = userSnap.exists ? (userSnap.data()!.balance ?? 0) : 0;

    if (entrySnap.exists)
      return { balance, alreadyRecorded: true }; // idempotent

    tx.set(ref, { nimAddress: address, balance: balance + grant }, { merge: true });
    tx.set(entryDoc, {
      delta: grant,
      kind: "purchase",
      at: Date.now(),
      txHash,
      method: String(method).slice(0, 16),
      note: `${amount} ${method}`,
    } satisfies LedgerEntry);
    return { balance: balance + grant, alreadyRecorded: false };
  });
}
