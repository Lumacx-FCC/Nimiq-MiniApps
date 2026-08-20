/**
 * Order (payment-intent) endpoints (Phase 3), mounted under /api. Authenticated.
 *
 *   POST /api/orders            { method, packUsd }        -> { orderId, expectedAmount, ... }
 *   POST /api/orders/:id/claim  { txHash, payerAddress? }  -> { ok }
 */
import type { Request, Response } from "express";
import { requireUid } from "../auth/requireAuth.js";
import { checkRateLimit } from "../shared/rateLimit.js";
import { claimOrder, createOrder, type OrderMethod } from "./store.js";

const ORDERS_CREATE_LIMIT = 20;
const ORDERS_CLAIM_LIMIT = 20;
const ORDERS_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function handleCreateOrder(req: Request, res: Response): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const allowed = await checkRateLimit("orders-create", uid, ORDERS_CREATE_LIMIT, ORDERS_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many orders — try again later." });
    return;
  }
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
  const allowed = await checkRateLimit("orders-claim", uid, ORDERS_CLAIM_LIMIT, ORDERS_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many claim attempts — try again later." });
    return;
  }
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
