/**
 * Poll-based safety net for ONVO Pay orders (Phase 4 style), in case the
 * webhook (onvo/webhook.ts) is ever missed or delayed — the webhook is the
 * primary and much faster path; this only catches what it drops.
 */
import type { OrderWithId } from "../orders/store.js";
import type { VerifyResult } from "./verify.js";
import { getPaymentIntent } from "../onvo/client.js";

export async function verifyOnvo(order: OrderWithId, secretKey: string): Promise<VerifyResult> {
  if (!order.txHash)
    return { state: "pending", reason: "not confirmed with ONVO yet" };
  if (!secretKey)
    return { state: "pending", reason: "ONVO not configured" };

  try {
    const intent = await getPaymentIntent(order.txHash, secretKey);
    if (intent.status === "succeeded")
      return { state: "confirmed" };
    if (intent.status === "failed" || intent.status === "canceled")
      return { state: "mismatch", reason: `ONVO status ${intent.status}` };
    return { state: "pending", reason: `ONVO status ${intent.status}` };
  }
  catch (error) {
    return { state: "pending", reason: error instanceof Error ? error.message : "ONVO consult failed" };
  }
}
