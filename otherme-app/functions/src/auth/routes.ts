/**
 * Express handlers for signed-challenge login, mounted under /api/auth by
 * index.ts. Nimiq Pay signs the challenge; the server verifies and mints a
 * Firebase session token.
 *
 *   POST /api/auth/challenge  { address }                         -> { message, expiresAt }
 *   POST /api/auth/verify     { address, publicKey, signature }   -> { token, address }
 */
import type { Request, Response } from "express";
import { verifyNimiqSignature } from "./nimiqSignature.js";
import { ensureUser, issueChallenge, mintSessionToken, takeChallenge } from "./store.js";

function normalizeAddress(addr: string): string {
  return addr.replace(/\s+/g, "").toUpperCase();
}

function isNimiqAddress(addr: string): boolean {
  return /^NQ[0-9A-Z]{34}$/.test(addr);
}

export async function handleAuthChallenge(req: Request, res: Response): Promise<void> {
  const address = normalizeAddress(String(req.body?.address || ""));
  if (!isNimiqAddress(address)) {
    res.status(400).json({ error: "A valid Nimiq address is required" });
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
  const token = await mintSessionToken(address);
  res.status(200).json({ token, address });
}
