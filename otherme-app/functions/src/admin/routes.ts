/**
 * Admin-only endpoints, mounted under /api/admin by index.ts.
 *
 *   POST /api/admin/grant-credits (admin) { address, credits, note, dedupeKey }
 *     -> { balance, alreadyGranted }
 *
 * Replaces the manual Firestore-console grant process for contest prizes and
 * other one-off credit grants (backlog Tier 0.1) with an authenticated,
 * idempotent, audited path that writes through the same ledger shape as
 * every other balance mutation (see credits/store.ts's grantPromo).
 */
import type { Request, Response } from "express";
import { requireAdmin } from "../auth/requireAuth.js";
import { grantPromo } from "../credits/store.js";

export async function handleGrantCredits(req: Request, res: Response): Promise<void> {
  const adminUid = await requireAdmin(req, res);
  if (!adminUid)
    return;

  const address = String(req.body?.address || "").trim();
  const credits = Number(req.body?.credits);
  const note = String(req.body?.note || "");
  const dedupeKey = String(req.body?.dedupeKey || "").trim();
  if (!address || !Number.isFinite(credits) || credits <= 0 || !dedupeKey) {
    res.status(400).json({ error: "address, a positive credits amount, and dedupeKey are required" });
    return;
  }

  const result = await grantPromo(address, credits, note, dedupeKey);
  res.status(200).json(result);
}
