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
    const decoded = await getAuth().verifyIdToken(match[1]);
    return decoded.uid || null;
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
