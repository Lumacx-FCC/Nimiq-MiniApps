/**
 * Incoming ONVO Pay webhook (SINPE Móvil rail). Verified against the
 * X-Webhook-Secret header — a shared secret from the ONVO dashboard, not an
 * HMAC signature (ONVO's docs don't describe one beyond this header, unlike
 * PayPal's remote verify-signature call).
 *
 * On payment-intent.succeeded, reads `data.metadata.orderId` — set when we
 * created the intent (onvo/routes.ts) — and grants directly. This is simpler
 * than PayPal's webhook: PayPal's Hosted Buttons never let us pass our own
 * order reference, forcing a payer-email-to-account-to-pending-order match;
 * ONVO round-trips our own order id, so there's nothing to match, only to look
 * up.
 */
import type { Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { claimOrder, getOrderById, grantOrder, setOrderStatus } from "../orders/store.js";

function verifySecret(req: Request, expected: string): boolean {
  const provided = String(req.headers["x-webhook-secret"] || "");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function logUnmatched(reason: string, event: unknown): Promise<void> {
  console.warn("[onvo-webhook] unmatched:", reason);
  await getFirestore().collection("onvo_unmatched_events").add({
    reason,
    event,
    at: Date.now(),
  });
}

export async function handleOnvoWebhook(req: Request, res: Response, webhookSecret: string): Promise<void> {
  if (!webhookSecret || !verifySecret(req, webhookSecret)) {
    res.status(400).json({ error: "invalid signature" });
    return;
  }

  const event = req.body as { type?: string; data?: { id?: string; metadata?: { orderId?: string } } };
  // Ack anything we don't act on (e.g. checkout-session.succeeded, subscription
  // events) so ONVO doesn't keep retrying.
  if (event?.type !== "payment-intent.succeeded" && event?.type !== "payment-intent.failed") {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const orderId = event.data?.metadata?.orderId;
  if (!orderId) {
    await logUnmatched("no metadata.orderId on event", event);
    res.status(200).json({ ok: true, unmatched: true });
    return;
  }

  const order = await getOrderById(orderId);
  if (!order || order.method !== "onvo") {
    await logUnmatched(`order ${orderId} not found or not an onvo order`, event);
    res.status(200).json({ ok: true, unmatched: true });
    return;
  }

  if (event.type === "payment-intent.failed") {
    if (order.status === "pending" || order.status === "submitted")
      await setOrderStatus(orderId, "failed", { failedReason: "ONVO reported payment-intent.failed" });
    res.status(200).json({ ok: true });
    return;
  }

  // payment-intent.succeeded. Normally the order is already 'submitted' (the
  // /api/onvo/confirm call claimed it right after ONVO accepted the confirm)
  // — but if that call died after ONVO accepted it and before claimOrder ran,
  // the order would still be stuck 'pending' with no txHash. Trust the
  // webhook and claim it here too rather than dropping a payment that
  // genuinely succeeded.
  if (order.status === "pending" && event.data?.id)
    await claimOrder(order.userId, orderId, event.data.id);

  const granted = await grantOrder(orderId);
  res.status(200).json({ ok: true, granted: granted.granted });
}
