/**
 * Incoming PayPal webhook (backlog 4.7 Part B): verifies the signature, then
 * on a completed capture, matches the payer's email to a signed-in account
 * and grants credits through the same atomic path NIM/USDT use (claimOrder +
 * grantOrder — idempotent, so a redelivered webhook is a safe no-op).
 *
 * Hosted Buttons don't let us pass our own order reference at render time, so
 * there's no direct link from a capture back to one of our `orders/{id}`
 * docs — the match is: capture -> its order (PayPal API) -> payer email ->
 * Firebase Auth user (by email) -> canonical uid -> that uid's pending
 * PayPal order matching the captured amount. Anything that can't be
 * confidently matched is logged to `paypal_unmatched_events` for a manual
 * grant via /promos_management, never guessed.
 */
import type { Request, Response } from "express";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { PAYPAL_WEBHOOK_ID } from "../config.js";
import { resolveCanonicalUid } from "../auth/store.js";
import { claimOrder, findPendingPaypalOrders, grantOrder } from "../orders/store.js";
import { getAccessToken, paypalGet, paypalPost } from "./client.js";

interface VerifySignatureResponse {
  verification_status: "SUCCESS" | "FAILURE";
}

interface OrderDetails {
  payer?: { email_address?: string };
}

async function verifySignature(req: Request, accessToken: string): Promise<boolean> {
  const h = req.headers;
  const body = {
    auth_algo: h["paypal-auth-algo"],
    cert_url: h["paypal-cert-url"],
    transmission_id: h["paypal-transmission-id"],
    transmission_sig: h["paypal-transmission-sig"],
    transmission_time: h["paypal-transmission-time"],
    webhook_id: PAYPAL_WEBHOOK_ID,
    webhook_event: req.body,
  };
  const result = await paypalPost<VerifySignatureResponse>("/v1/notifications/verify-webhook-signature", accessToken, body);
  return result.verification_status === "SUCCESS";
}

async function logUnmatched(reason: string, event: any): Promise<void> {
  console.warn("[paypal-webhook] unmatched:", reason);
  await getFirestore().collection("paypal_unmatched_events").add({
    reason,
    eventId: event?.id ?? null,
    eventType: event?.event_type ?? null,
    resource: event?.resource ?? null,
    at: Date.now(),
  });
}

export async function handlePaypalWebhook(req: Request, res: Response, clientSecret: string): Promise<void> {
  let accessToken: string;
  try {
    accessToken = await getAccessToken(clientSecret);
  }
  catch (error) {
    console.error("[paypal-webhook] OAuth token fetch failed:", error);
    res.status(500).json({ error: "token error" });
    return;
  }

  let verified = false;
  try {
    verified = await verifySignature(req, accessToken);
  }
  catch (error) {
    console.error("[paypal-webhook] signature verification request failed:", error);
  }
  if (!verified) {
    res.status(400).json({ error: "invalid signature" });
    return;
  }

  const event = req.body;
  // Ack anything we don't act on yet (e.g. CHECKOUT.ORDER.APPROVED, refunds)
  // so PayPal doesn't keep retrying — only a completed capture grants credits.
  if (event?.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const capture = event.resource;
  const captureId = capture?.id as string | undefined;
  const orderId = capture?.supplementary_data?.related_ids?.order_id as string | undefined;
  const amountValue = Number(capture?.amount?.value);
  const currency = capture?.amount?.currency_code;

  if (!captureId || !orderId || !Number.isFinite(amountValue) || currency !== "USD") {
    await logUnmatched("malformed capture event", event);
    res.status(200).json({ ok: true, unmatched: true });
    return;
  }

  let payerEmail: string | undefined;
  try {
    const order = await paypalGet<OrderDetails>(`/v2/checkout/orders/${orderId}`, accessToken);
    payerEmail = order.payer?.email_address;
  }
  catch (error) {
    console.error("[paypal-webhook] order lookup failed:", error);
  }
  if (!payerEmail) {
    await logUnmatched("no payer email on order", event);
    res.status(200).json({ ok: true, unmatched: true });
    return;
  }

  let nativeUid: string;
  try {
    const authUser = await getAuth().getUserByEmail(payerEmail);
    nativeUid = authUser.uid;
  }
  catch {
    await logUnmatched(`no account for payer email`, event);
    res.status(200).json({ ok: true, unmatched: true });
    return;
  }

  const uid = await resolveCanonicalUid(nativeUid);
  const candidates = await findPendingPaypalOrders(uid);
  const match = candidates
    .filter(o => Math.abs(o.expectedAmount - amountValue) < 0.01)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (!match) {
    // Distinguish "no pending PayPal order at all" (order-creation on package
    // select likely never reached the server) from "some exist, none at this
    // amount" (a real mismatch) — both showed as one ambiguous message before.
    const detail = candidates.length
      ? `${candidates.length} pending order(s) found, amounts [${candidates.map(o => o.expectedAmount).join(", ")}], captured amount ${amountValue}`
      : "zero pending paypal orders exist for this uid";
    await logUnmatched(`no matching pending order for uid ${uid} — ${detail}`, event);
    res.status(200).json({ ok: true, unmatched: true });
    return;
  }

  const claimed = await claimOrder(uid, match.id, captureId);
  if (!claimed.ok) {
    // Already submitted/granted — a redelivered webhook is a safe no-op.
    res.status(200).json({ ok: true, alreadyHandled: true });
    return;
  }
  const granted = await grantOrder(match.id);
  res.status(200).json({ ok: true, granted: granted.granted });
}
