/**
 * Verify a claimed NIM payment against its order (Phase 4, §8).
 *
 * Verifies against NIMIQ_RPC_URL (our node) or the public NimiqWatch default
 * (interim; see docs/server-side-credits.md §A). Response shape matches the
 * Albatross RPC `Transaction` type (core-rs-albatross rpc-interface/src/types.rs,
 * serde rename_all = camelCase): `to` (NQ address), `value` (Luna number),
 * `recipientData` (hex bytes), `confirmations` (number, once mined).
 *
 * The client pays payNim(amount, orderId) which tags the tx data with
 * `${appId}:${orderId}` — exactly order.reference — so we match on that tag,
 * the treasury recipient, the amount (Luna, >= with a small tolerance), and a
 * confirmation depth.
 */
import type { OrderWithId } from "../orders/store.js";
import { CONFIRMATIONS_NIM, NIM_TREASURY_ADDRESS } from "../config.js";
import { jsonRpc, type RpcOptions } from "./rpc.js";
import type { VerifyResult } from "./verify.js";

interface NimTx {
  to?: string;
  value?: number | string; // Coin → number (Luna); coerced defensively
  recipientData?: string; // hex-encoded data bytes
  blockNumber?: number;
  confirmations?: number;
}

/** Normalize an NQ address for comparison (drop spaces, upper-case). */
const normAddr = (a: string | undefined) => (a ?? "").replace(/\s+/g, "").toUpperCase();

/** Decode the hex-encoded recipientData to its utf8 string (the `appId:orderId` tag). */
function decodeData(raw: string | undefined): string {
  if (!raw)
    return "";
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0)
    return Buffer.from(hex, "hex").toString("utf8");
  return raw;
}

export async function verifyNim(order: OrderWithId, rpcUrl: string, auth?: RpcOptions["auth"]): Promise<VerifyResult> {
  if (!order.txHash)
    return { state: "mismatch", reason: "no txHash" };

  const opts: RpcOptions = auth ? { auth } : {};
  const tx = await jsonRpc<NimTx | null>(rpcUrl, "getTransactionByHash", [order.txHash], opts);
  if (!tx)
    return { state: "pending", reason: "tx not in history yet" };

  const recipient = normAddr(tx.to);
  if (recipient !== normAddr(NIM_TREASURY_ADDRESS))
    return { state: "mismatch", reason: `wrong recipient ${recipient}` };

  // Freeze-and-require with a 1% floor for rounding drift (§7/§13).
  const value = Number(tx.value);
  const minValue = Math.floor(order.expectedBaseUnits * 0.99);
  if (!Number.isFinite(value) || value < minValue)
    return { state: "mismatch", reason: `value ${tx.value} < ${minValue}` };

  const data = decodeData(tx.recipientData);
  if (data !== order.reference)
    return { state: "mismatch", reason: `reference "${data}" != "${order.reference}"` };

  const confirmations = typeof tx.confirmations === "number"
    ? tx.confirmations
    : (typeof tx.blockNumber === "number"
        ? await jsonRpc<number>(rpcUrl, "getBlockNumber", [], opts) - tx.blockNumber
        : 0);
  if (confirmations < CONFIRMATIONS_NIM)
    return { state: "pending", reason: `only ${confirmations} confirmations` };

  return { state: "confirmed" };
}
