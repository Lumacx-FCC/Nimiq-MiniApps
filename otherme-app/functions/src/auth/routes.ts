/**
 * Express handlers for signed-challenge login, mounted under /api/auth by
 * index.ts. Nimiq Pay signs the challenge; the server verifies and mints a
 * Firebase session token.
 *
 *   POST /api/auth/challenge  { address }                         -> { message, expiresAt }
 *   POST /api/auth/verify     { address, publicKey, signature }   -> { token, address }
 */
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { isNimiqAddress, normalizeAddress } from "../shared/nimiqAddress.js";
import { checkRateLimit } from "../shared/rateLimit.js";
import { verifyNimiqSignature } from "./nimiqSignature.js";
import { ensureAccountUser, ensureUser, issueChallenge, mintSessionToken, resolveCanonicalUid, takeChallenge, userExists } from "./store.js";

const CHALLENGE_LIMIT = 10;
const CHALLENGE_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const NEW_ACCOUNT_LIMIT = 10;
const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000; // 1 day

export async function handleAuthChallenge(req: Request, res: Response): Promise<void> {
  const address = normalizeAddress(String(req.body?.address || ""));
  if (!isNimiqAddress(address)) {
    res.status(400).json({ error: "A valid Nimiq address is required" });
    return;
  }
  const allowed = await checkRateLimit("auth-challenge", address, CHALLENGE_LIMIT, CHALLENGE_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many login attempts — try again shortly." });
    return;
  }
  const { message, expiresAt } = await issueChallenge(address);
  res.status(200).json({ message, expiresAt });
}

export async function handleAuthVerify(req: Request, res: Response): Promise<void> {
  const address = normalizeAddress(String(req.body?.address || ""));
  const publicKey = String(req.body?.publicKey || "");
  const signature = String(req.body?.signature || "");
  if (!address || !publicKey || !signature) {
    res.status(400).json({ error: "address, publicKey and signature are required" });
    return;
  }

  const challenge = await takeChallenge(address);
  if (!challenge) {
    res.status(400).json({ error: "No pending login challenge — request a new one." });
    return;
  }
  if (Date.now() > challenge.expiresAt) {
    res.status(400).json({ error: "Login challenge expired — try again." });
    return;
  }

  const result = await verifyNimiqSignature({ message: challenge.message, publicKey, signature, claimedAddress: address });
  if (!result.ok) {
    res.status(401).json({ error: "Signature verification failed", reason: result.reason });
    return;
  }

  await ensureUser(address);
  // Resolve through identity_links so a wallet folded into another account via
  // linking signs back in AS the shared canonical account, not its own
  // now-empty one — mirrors handleAccountResolve below. No-op for an
  // never-linked wallet (resolveCanonicalUid returns the same address).
  const canonicalUid = await resolveCanonicalUid(address);
  const token = await mintSessionToken(canonicalUid);
  res.status(200).json({ token, address: canonicalUid });
}

/**
 * Exchange a native Firebase ID token (from a real email/Google sign-in) for a
 * canonical session token. Pre-account-linking (Part B), canonical uid always
 * equals the native uid — the identity_links lookup is a forward-compatible
 * no-op until linking exists.
 */
export async function handleAccountResolve(req: Request, res: Response): Promise<void> {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: "Missing Authorization: Bearer <idToken>" });
    return;
  }

  let nativeUid: string;
  let signInProvider: string | undefined;
  try {
    const decoded = await getAuth().verifyIdToken(match[1], true);
    nativeUid = decoded.uid;
    signInProvider = decoded.firebase?.sign_in_provider;
  }
  catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const canonicalUid = await resolveCanonicalUid(nativeUid);

  // Only bound the velocity of brand-new accounts per IP — an existing user
  // logging back in is never rate-limited by this check.
  if (!(await userExists(canonicalUid))) {
    const allowed = await checkRateLimit("new-account", req.ip || "unknown", NEW_ACCOUNT_LIMIT, NEW_ACCOUNT_WINDOW_MS);
    if (!allowed) {
      res.status(429).json({ error: "Too many new accounts from this network — try again later." });
      return;
    }
  }

  const provider = signInProvider === "google.com" ? "google" : "email";
  await ensureAccountUser(canonicalUid, provider);
  const token = await mintSessionToken(canonicalUid, provider);
  res.status(200).json({ token, uid: canonicalUid });
}
