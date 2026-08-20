/**
 * Firestore + Auth data layer for login (Phase 1 of the credits migration).
 *
 *   auth_challenges/{address}   one-shot login nonces (server-only)
 *   users/{address}             profile + authoritative balance (balance/welcome
 *                               are Phase 2; Phase 1 only creates the profile)
 *
 * The main function (index.ts) calls initializeApp() before these run; all
 * getFirestore()/getAuth() calls are lazy (inside functions) to stay init-safe.
 */
import { randomUUID } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

export interface Challenge {
  address: string;
  nonce: string;
  message: string;
  createdAt: number;
  expiresAt: number;
}

const db = () => getFirestore();
const challenges = () => db().collection("auth_challenges");
const users = () => db().collection("users");

export function buildChallengeMessage(address: string, nonce: string, issuedIso: string): string {
  return [
    "Other Me login",
    `address: ${address}`,
    `nonce: ${nonce}`,
    `issued: ${issuedIso}`,
  ].join("\n");
}

export async function issueChallenge(address: string): Promise<Challenge> {
  const now = Date.now();
  const nonce = randomUUID();
  const doc: Challenge = {
    address,
    nonce,
    message: buildChallengeMessage(address, nonce, new Date(now).toISOString()),
    createdAt: now,
    expiresAt: now + CHALLENGE_TTL_MS,
  };
  await challenges().doc(address).set(doc);
  return doc;
}

/** Read and delete the challenge (single use) so a signature can't be replayed. */
export async function takeChallenge(address: string): Promise<Challenge | null> {
  const ref = challenges().doc(address);
  const snap = await ref.get();
  if (!snap.exists)
    return null;
  await ref.delete();
  return snap.data() as Challenge;
}

/**
 * Idempotently create the user profile. Balance/welcome credits are Phase 2.
 *
 * Races with credits/store.ts's migrateBalance(), which the client also fires
 * on every login (via onSessionChange -> syncFromServer) — whichever creates
 * the doc first wins, and migrateBalance doesn't know `provider`. So on an
 * existing doc, backfill `provider` via merge if it's still missing, rather
 * than only setting it at creation.
 */
export async function ensureUser(address: string): Promise<void> {
  const ref = users().doc(address);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, { nimAddress: address, provider: "nimiq", balance: 0, welcomeGranted: false, createdAt: Date.now() });
      return;
    }
    if (!snap.data()?.provider)
      tx.set(ref, { provider: "nimiq" }, { merge: true });
  });
}

/** Mint a Firebase custom token for signInWithCustomToken. `uid` is the Nimiq
 * address for wallet logins, or the native Firebase uid for email/Google. */
export async function mintSessionToken(uid: string, provider: "nimiq" | "email" | "google" = "nimiq"): Promise<string> {
  return getAuth().createCustomToken(uid, { provider });
}

/** Idempotently create the user profile for a non-wallet (email/Google) uid.
 * See ensureUser's doc comment for why an existing doc still gets a provider
 * backfill instead of being left alone. */
export async function ensureAccountUser(uid: string, provider: "email" | "google"): Promise<void> {
  const ref = users().doc(uid);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      tx.set(ref, { provider, balance: 0, welcomeGranted: false, createdAt: Date.now() });
      return;
    }
    if (!snap.data()?.provider)
      tx.set(ref, { provider }, { merge: true });
  });
}

/** Resolve a native (freshly-authenticated) uid to its canonical uid via
 * identity_links. No doc = you are canonical (the default, pre-Part-B case). */
export async function resolveCanonicalUid(nativeUid: string): Promise<string> {
  const snap = await db().collection("identity_links").doc(nativeUid).get();
  const data = snap.data() as { canonicalUid?: string } | undefined;
  return data?.canonicalUid || nativeUid;
}

/** Whether a users/{uid} profile has already been created. */
export async function userExists(uid: string): Promise<boolean> {
  const snap = await users().doc(uid).get();
  return snap.exists;
}
