/**
 * SINPE Móvil checkout (ONVO Pay). Authenticated.
 *
 *   POST /api/onvo/confirm  { orderId, phone, identification, identificationType }  ->  { ok, status }
 *
 * Creates the SINPE Móvil payment method + payment intent and confirms it
 * server-side (the secret key never reaches the client), then marks the
 * order 'submitted' with the ONVO payment-intent id standing in for txHash —
 * the same field NIM/USDT/PayPal orders use, so grantOrder's ledger-entry
 * idempotency key (`tx-<txHash>`) works unchanged here too. This call does
 * NOT grant credits itself: the ONVO webhook (payment-intent.succeeded) is
 * the sole granter, since only the webhook (or the reconciler poll fallback)
 * actually knows whether the customer approved the transfer in their bank.
 */
import type { Request, Response } from "express";
import { requireUid } from "../auth/requireAuth.js";
import { checkRateLimit } from "../shared/rateLimit.js";
import { claimOrder, getOrderById } from "../orders/store.js";
import { confirmPaymentIntent, createPaymentIntent, createSinpeMovilPaymentMethod, type OnvoIdentificationType } from "./client.js";
import { APP_ID } from "../config.js";

const ONVO_CONFIRM_LIMIT = 20;
const ONVO_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const VALID_IDENTIFICATION_TYPES: OnvoIdentificationType[] = [0, 1, 2, 3, 4, 5, 9];

/** Costa Rican mobile numbers are 8 digits; accept with or without the +506
 * country code and normalize to E.164 for ONVO. */
function normalizeCrPhone(input: string): string | null {
  const digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 8)
    return `+506${digits}`;
  if (digits.length === 11 && digits.startsWith("506"))
    return `+${digits}`;
  return null;
}

export async function handleOnvoConfirm(req: Request, res: Response, secretKey: string): Promise<void> {
  const uid = await requireUid(req, res);
  if (!uid)
    return;
  const allowed = await checkRateLimit("onvo-confirm", uid, ONVO_CONFIRM_LIMIT, ONVO_WINDOW_MS);
  if (!allowed) {
    res.status(429).json({ error: "Too many attempts — try again later." });
    return;
  }

  const orderId = String(req.body?.orderId || "");
  const phone = normalizeCrPhone(String(req.body?.phone || ""));
  const identification = String(req.body?.identification || "").trim();
  const identificationType = Number(req.body?.identificationType) as OnvoIdentificationType;
  if (!orderId || !phone || !identification || !VALID_IDENTIFICATION_TYPES.includes(identificationType)) {
    res.status(400).json({ error: "orderId, a valid Costa Rican phone number, and an ID number/type are required" });
    return;
  }
  if (!secretKey) {
    res.status(503).json({ error: "SINPE Móvil is not configured" });
    return;
  }

  const order = await getOrderById(orderId);
  if (!order || order.userId !== uid) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  if (order.method !== "onvo") {
    res.status(400).json({ error: "Order is not a SINPE Móvil order" });
    return;
  }
  if (order.status !== "pending") {
    res.status(400).json({ error: `Order already ${order.status}` });
    return;
  }

  try {
    const method = await createSinpeMovilPaymentMethod(phone, identification, identificationType, secretKey);
    const intent = await createPaymentIntent(order.expectedBaseUnits, "CRC", { orderId, appId: APP_ID }, secretKey);
    const confirmed = await confirmPaymentIntent(intent.id, method.id, secretKey);
    const claimed = await claimOrder(uid, orderId, confirmed.id);
    if (!claimed.ok) {
      res.status(400).json(claimed);
      return;
    }
    res.status(200).json({ ok: true, status: confirmed.status });
  }
  catch (error) {
    console.error("[onvo] confirm failed:", error);
    res.status(502).json({ error: error instanceof Error ? error.message : "SINPE Móvil request failed" });
  }
}
