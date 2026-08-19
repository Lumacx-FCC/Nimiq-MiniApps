/**
 * Generic fixed-window rate limiter backed by Firestore.
 *
 *   rate_limits/{scope}:{id}:{windowBucket}   count: number, expiresAt: number
 *
 * Deliberately generic (scope/id/limit/windowMs are all caller-supplied) so it
 * can be reused for other routes later — but wiring it into anything besides
 * the account-linking endpoints is out of scope for now (see Tier 1.1 in the
 * backlog: /api/auth/challenge, /api/orders, and the AI routes have no rate
 * limiting at all yet; retrofitting them is a separate follow-up).
 *
 * expiresAt exists so a Firestore TTL policy (configured once, in the console,
 * on this collection's `expiresAt` field) can garbage-collect old buckets —
 * this module never deletes them itself.
 */
import { getFirestore } from "firebase-admin/firestore";

const db = () => getFirestore();
const rateLimits = () => db().collection("rate_limits");

/**
 * Returns true if the action is allowed (and records it), false if `id` has
 * already hit `limit` calls for this scope within the current `windowMs`
 * window.
 */
export async function checkRateLimit(scope: string, id: string, limit: number, windowMs: number): Promise<boolean> {
  const windowBucket = Math.floor(Date.now() / windowMs);
  const ref = rateLimits().doc(`${scope}:${id}:${windowBucket}`);

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? (snap.data()?.count ?? 0) : 0;
    if (count >= limit)
      return false;
    tx.set(ref, { count: count + 1, expiresAt: Date.now() + windowMs * 2 }, { merge: true });
    return true;
  });
}
