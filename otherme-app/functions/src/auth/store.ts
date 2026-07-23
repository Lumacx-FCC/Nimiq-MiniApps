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

/** Idempotently create the user profile. Balance/welcome credits are Phase 2. */
export async function ensureUser(address: string): Promise<void> {
  const ref = users().doc(address);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists)
      return;
    tx.set(ref, { nimAddress: address, balance: 0, welcomeGranted: false, createdAt: Date.now() });
  });
}

/** Mint a Firebase custom token (uid = Nimiq address) for signInWithCustomToken. */
export async function mintSessionToken(address: string): Promise<string> {
  return getAuth().createCustomToken(address, { provider: "nimiq" });
}
