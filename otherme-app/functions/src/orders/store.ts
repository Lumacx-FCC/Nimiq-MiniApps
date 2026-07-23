/**
 * Payment intents / orders (Phase 3).
 *
 *   orders/{orderId}
 *     userId, method, packUsd, credits,
 *     expectedAmount      display units the client pays (NIM or USDT)
 *     expectedBaseUnits   Luna (NIM) or 6-decimal units (USDT) — for Phase 4
 *     expectedRecipient   treasury for the rail
 *     reference           `<appId>:<orderId>` — the NIM data tag Phase 4 checks
 *     status, txHash?, payerAddress?, attempts, createdAt, expiresAt
 *
 * The server computes the amount owed from its own PACKS + NIM rate (never a
 * client-supplied amount) and freezes it into the order. Phase 4's reconciler
 * verifies the claimed tx against these fields on-chain.
 */
import { getFirestore } from "firebase-admin/firestore";
import {
  APP_ID,
  EVM_TREASURY_ADDRESS,
  findPack,
  getNimUsdRate,
  LUNA_PER_NIM,
  NIM_BONUS_MULTIPLIER,
  NIM_TREASURY_ADDRESS,
  ORDER_TTL_MS,
  USDT_DECIMALS,
} from "../config.js";

export type OrderMethod = "nim" | "usdt";
export type OrderStatus = "pending" | "submitted" | "confirmed" | "granted" | "failed" | "expired";

export interface OrderDoc {
  userId: string;
  method: OrderMethod;
  packUsd: number;
  credits: number;
  expectedAmount: number;
  expectedBaseUnits: number;
  expectedRecipient: string;
  reference: string;
  status: OrderStatus;
  txHash?: string;
  payerAddress?: string | null;
  attempts: number;
  createdAt: number;
  expiresAt: number;
  submittedAt?: number;
}

export interface OrderView {
  orderId: string;
  method: OrderMethod;
  expectedAmount: number;
  expectedRecipient: string;
  credits: number;
}

const orders = () => getFirestore().collection("orders");

export async function createOrder(userId: string, method: OrderMethod, packUsd: number): Promise<OrderView | { error: string }> {
  const pack = findPack(packUsd);
  if (!pack)
    return { error: "Unknown credit pack" };

  const isNim = method === "nim";
  const credits = isNim ? Math.round(pack.credits * NIM_BONUS_MULTIPLIER) : pack.credits;

  let expectedAmount: number;
  let expectedBaseUnits: number;
  let expectedRecipient: string;
  if (isNim) {
    const rate = await getNimUsdRate(); // frozen into the order
    expectedAmount = pack.usd / rate;
    expectedBaseUnits = Math.round(expectedAmount * LUNA_PER_NIM);
    expectedRecipient = NIM_TREASURY_ADDRESS;
  }
  else {
    expectedAmount = pack.usd;
    expectedBaseUnits = Math.round(pack.usd * 10 ** USDT_DECIMALS);
    expectedRecipient = EVM_TREASURY_ADDRESS;
  }

  const ref = orders().doc();
  const now = Date.now();
  const doc: OrderDoc = {
    userId,
    method,
    packUsd: pack.usd,
    credits,
    expectedAmount,
    expectedBaseUnits,
    expectedRecipient,
    // The client pays payNim(amount, orderId) → data tag `<appId>:<orderId>`.
    reference: `${APP_ID}:${ref.id}`,
    status: "pending",
    attempts: 0,
    createdAt: now,
    expiresAt: now + ORDER_TTL_MS,
  };
  await ref.set(doc);

  return { orderId: ref.id, method, expectedAmount, expectedRecipient, credits };
}

/**
 * Attach the paid tx to the order so Phase 4's reconciler can verify it.
 * Marks the order 'submitted'. Idempotent-ish: re-claiming a pending/submitted
 * order updates the tx; a resolved order (granted/failed) is rejected.
 */
export async function claimOrder(
  userId: string,
  orderId: string,
  txHash: string,
  payerAddress?: string,
): Promise<{ ok: boolean; error?: string }> {
  const ref = orders().doc(orderId);
  return getFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists)
      return { ok: false, error: "Order not found" };
    const order = snap.data() as OrderDoc;
    if (order.userId !== userId)
      return { ok: false, error: "Order belongs to another account" };
    if (order.status !== "pending" && order.status !== "submitted")
      return { ok: false, error: `Order already ${order.status}` };

    tx.update(ref, {
      status: "submitted",
      txHash,
      payerAddress: payerAddress ?? null,
      submittedAt: Date.now(),
    });
    return { ok: true };
  });
}
