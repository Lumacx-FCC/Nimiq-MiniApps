/**
 * Phase 4 background reconciler (§8). Scans `submitted` orders and verifies each
 * claimed tx on-chain, then:
 *   confirmed → atomic grant (grantOrder)
 *   mismatch  → mark failed now (wrong amount/recipient/payer/reference/reverted)
 *   pending   → keep retrying until the grace window / attempt cap lapses, then fail
 *
 * USDT verifies against Polygon (public RPC by default). NIM verifies only when
 * NIMIQ_RPC_URL is set; otherwise NIM orders are left untouched and keep the
 * temporary client record-purchase grant (see docs §A). Runs on a clean network
 * — no Avast CA shim needed.
 */
import {
  POLYGON_RPC_DEFAULT,
  RECONCILE_BATCH,
  RECONCILE_GRACE_MS,
  RECONCILE_MAX_ATTEMPTS,
} from "../config.js";
import {
  grantOrder,
  listPendingOrders,
  listSubmittedOrders,
  setOrderStatus,
  touchOrder,
  type OrderWithId,
} from "../orders/store.js";
import { verifyNim } from "./verifyNim.js";
import { verifyUsdt } from "./verifyUsdt.js";
import type { VerifyResult } from "./verify.js";

export interface ReconcileSummary {
  scanned: number;
  granted: number;
  failed: number;
  pending: number;
  skipped: number;
  expired: number;
}

function nimAuth(): { user: string; pass: string } | undefined {
  const user = process.env.NIMIQ_RPC_USER;
  const pass = process.env.NIMIQ_RPC_PASS;
  return user && pass ? { user, pass } : undefined;
}

async function verifyOrder(order: OrderWithId): Promise<VerifyResult | { state: "skipped" }> {
  if (order.method === "usdt") {
    const url = process.env.POLYGON_RPC_URL || POLYGON_RPC_DEFAULT;
    return verifyUsdt(order, url);
  }
  // NIM
  const url = process.env.NIMIQ_RPC_URL;
  if (!url)
    return { state: "skipped" }; // dormant until our node RPC is live
  return verifyNim(order, url, nimAuth());
}

/** True once an order has been trying too long / too often to keep waiting. */
function exhausted(order: OrderWithId): boolean {
  const since = order.submittedAt ?? order.createdAt;
  return Date.now() - since > RECONCILE_GRACE_MS || order.attempts >= RECONCILE_MAX_ATTEMPTS;
}

export async function runReconcile(): Promise<ReconcileSummary> {
  const orders = await listSubmittedOrders(RECONCILE_BATCH);
  const summary: ReconcileSummary = { scanned: orders.length, granted: 0, failed: 0, pending: 0, skipped: 0, expired: 0 };

  for (const order of orders) {
    try {
      const result = await verifyOrder(order);

      if (result.state === "skipped") {
        summary.skipped++;
        continue;
      }
      if (result.state === "confirmed") {
        const { granted } = await grantOrder(order.id);
        summary.granted += granted ? 1 : 0;
        continue;
      }
      if (result.state === "mismatch") {
        await setOrderStatus(order.id, "failed", { failedReason: result.reason?.slice(0, 200) });
        summary.failed++;
        continue;
      }
      // pending
      if (exhausted(order)) {
        await setOrderStatus(order.id, "failed", { failedReason: `timeout: ${result.reason ?? "unconfirmed"}`.slice(0, 200) });
        summary.failed++;
      }
      else {
        await touchOrder(order.id);
        summary.pending++;
      }
    }
    catch (err) {
      // Transient RPC error — bump the attempt and retry next pass, unless the
      // order has already been waiting too long.
      console.error(`[reconcile] order ${order.id} check failed:`, err);
      if (exhausted(order)) {
        await setOrderStatus(order.id, "failed", { failedReason: "verification error / timeout" });
        summary.failed++;
      }
      else {
        await touchOrder(order.id);
        summary.pending++;
      }
    }
  }

  // Sweep abandoned `pending` orders — created but never claimed (e.g. a
  // gas-failed tap that threw before claim). They're never scanned for grants,
  // so expire them past their TTL rather than let them accumulate. Never grants,
  // never touches money.
  try {
    const stale = await listPendingOrders(RECONCILE_BATCH);
    for (const order of stale) {
      if (Date.now() > order.expiresAt) {
        await setOrderStatus(order.id, "expired");
        summary.expired++;
      }
    }
  }
  catch (err) {
    console.error("[reconcile] pending sweep failed:", err);
  }

  return summary;
}
