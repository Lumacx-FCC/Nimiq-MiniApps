/**
 * Verify the Firebase session on an authenticated request.
 *
 * The client attaches the ID token from signInWithCustomToken (Phase 1) as
 * `Authorization: Bearer <idToken>`. We verify it with the Admin SDK; the uid
 * is the user's Nimiq address (that's how the custom token was minted).
 */
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";

/** Returns the authenticated uid (NQ address), or null if the token is missing/invalid. */
export async function getAuthedUid(req: Request): Promise<string | null> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match)
    return null;
  try {
    const decoded = await getAuth().verifyIdToken(match[1], true);
    return decoded.uid || null;
  }
  catch {
    return null;
  }
}

/** Resolve the caller's uid + provider label. Prefers the `provider` custom
 * claim (set by mintSessionToken); falls back to the native `sign_in_provider`
 * for a session that hasn't been through the canonical-session swap yet.
 * `emailVerified` is the decoded token's standard `email_verified` claim —
 * used to gate the welcome-credit grant for the `email` provider (Nimiq and
 * Google are always considered verified; Google sign-in is pre-verified). */
export async function getAuthedClaims(req: Request): Promise<{ uid: string; provider: "nimiq" | "email" | "google"; emailVerified: boolean } | null> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match)
    return null;
  try {
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const claimProvider = (decoded as { provider?: string }).provider;
    const provider = claimProvider === "nimiq" || claimProvider === "email" || claimProvider === "google"
      ? claimProvider
      : decoded.firebase?.sign_in_provider === "google.com" ? "google" : "email";
    const emailVerified = provider === "email" ? Boolean(decoded.email_verified) : true;
    return { uid: decoded.uid, provider, emailVerified };
  }
  catch {
    return null;
  }
}

/** Resolve the caller's uid or send 401. Returns null when unauthenticated. */
export async function requireUid(req: Request, res: Response): Promise<string | null> {
  const uid = await getAuthedUid(req);
  if (!uid) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return uid;
}

/**
 * Resolve the caller's uid, requiring the `admin: true` custom claim — the
 * only way to reach it is functions/scripts/set-admin-claim.mjs, run by hand
 * against a trusted uid; nothing in the app grants it. Sends 403 (not 401)
 * when authenticated but not an admin, distinct from "not signed in at all".
 */
export async function requireAdmin(req: Request, res: Response): Promise<string | null> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(match[1], true);
    if (!(decoded as { admin?: boolean }).admin) {
      res.status(403).json({ error: "Admin access required" });
      return null;
    }
    return decoded.uid;
  }
  catch {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
}

/** Custom-token sign-in (mintSessionToken) and a native provider sign-in both
 * stamp a fresh `auth_time` — this works uniformly for all three providers, no
 * per-provider branching needed. */
const FRESH_AUTH_MAX_AGE_SECONDS = 5 * 60;

/**
 * Resolve the caller's uid, requiring they authenticated within the last few
 * minutes (Firebase's `auth_time` claim) — for actions where a stale, merely-
 * still-valid session isn't enough proof (unlink). Sends 401 with
 * code: "reauth-required" when the session is too old, distinct from missing/
 * invalid auth, so the client can prompt a fresh sign-in instead of a login.
 */
export async function requireFreshUid(req: Request, res: Response): Promise<string | null> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(match[1], true);
    const ageSeconds = Date.now() / 1000 - decoded.auth_time;
    if (ageSeconds > FRESH_AUTH_MAX_AGE_SECONDS) {
      res.status(401).json({ error: "Please sign in again to confirm this action.", code: "reauth-required" });
      return null;
    }
    return decoded.uid;
  }
  catch (e) {
    console.error("[requireFreshUid] verifyIdToken failed:", e instanceof Error ? e.message : e);
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
}
