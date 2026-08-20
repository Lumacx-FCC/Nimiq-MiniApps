/**
 * Authenticated credits endpoints (Phase 2), mounted under /api/credits.
 * Every handler resolves the caller from the verified session (uid = NQ
 * address); a request without a valid session is 401.
 *
 *   GET  /api/credits/balance
 *   POST /api/credits/migrate         { localBalance }
 *   POST /api/credits/spend           { amount, kind }
 *   POST /api/credits/record-purchase { txHash, credits, method, amount }
 *   POST /api/credits/accept-terms
 */
import type { Request, Response } from "express";
import { getAuthedClaims, getAuthedUid } from "../auth/requireAuth.js";
import { checkRateLimit } from "../shared/rateLimit.js";
import { acceptTerms, getBalance, migrateBalance, recordPurchase, spend } from "./store.js";

const RECORD_PURCHASE_LIMIT = 10;
const RECORD_PURCHASE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

async function requireUid(req: Request, res: Response): Promise<string | null> {
  const uid = await getAuthedUid(req);
  if (!uid) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }
  return uid;
}

export async function handleBalance(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  res.status(200).json(await getBalance(uid));
}

export async function handleMigrate(req: Request, res: Response): Promise<void> {
  const claims = await getAuthedClaims(req);
  if (!claims) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const localBalance = Number(req.body?.localBalance ?? 0);
  res.status(200).json(await migrateBalance(claims.uid, localBalance, claims.emailVerified));
}

export async function handleSpend(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const amount = Number(req.body?.amount);
  const kind = String(req.body?.kind || "spend");
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "A positive amount is required" });
    return;
  }
  const result = await spend(uid, amount, kind);
  // 402 Payment Required signals "insufficient balance" to the client.
  res.status(result.ok ? 200 : 402).json(result);
}

export async function handleRecordPurchase(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const allowed = await checkRateLimit("record-purchase", uid, RECORD_PURCHASE_LIMIT, RECORD_PURCHASE_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many purchase records — try again later." });
    return;
  }
  const txHash = String(req.body?.txHash || "");
  const credits = Number(req.body?.credits);
  const method = String(req.body?.method || "");
  const amount = Number(req.body?.amount ?? 0);
  if (!txHash || !Number.isFinite(credits) || credits <= 0) {
    res.status(400).json({ error: "txHash and a positive credits amount are required" });
    return;
  }
  const result = await recordPurchase(uid, txHash, credits, method, amount);
  res.status("error" in result ? 400 : 200).json(result);
}

export async function handleAcceptTerms(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  res.status(200).json(await acceptTerms(uid));
}
