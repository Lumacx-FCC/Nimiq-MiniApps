/**
 * Order (payment-intent) endpoints (Phase 3), mounted under /api. Authenticated.
 *
 *   POST /api/orders            { method, packUsd }        -> { orderId, expectedAmount, ... }
 *   POST /api/orders/:id/claim  { txHash, payerAddress? }  -> { ok }
 */
import type { Request, Response } from "express";
import { requireUid } from "../auth/requireAuth.js";
import { claimOrder, createOrder, type OrderMethod } from "./store.js";

export async function handleCreateOrder(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const method: OrderMethod = req.body?.method === "usdt" ? "usdt" : "nim";
  const packUsd = Number(req.body?.packUsd);
  if (!Number.isFinite(packUsd)) {
    res.status(400).json({ error: "packUsd is required" });
    return;
  }
  const result = await createOrder(uid, method, packUsd);
  if ("error" in result) {
    res.status(400).json(result);
    return;
  }
  res.status(200).json(result);
}

export async function handleClaimOrder(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const orderId = String(req.params.id || req.body?.orderId || "");
  const txHash = String(req.body?.txHash || "");
  const payerAddress = req.body?.payerAddress ? String(req.body.payerAddress) : undefined;
  if (!orderId || !txHash) {
    res.status(400).json({ error: "orderId and txHash are required" });
    return;
  }
  const result = await claimOrder(uid, orderId, txHash, payerAddress);
  res.status(result.ok ? 200 : 400).json(result);
}
