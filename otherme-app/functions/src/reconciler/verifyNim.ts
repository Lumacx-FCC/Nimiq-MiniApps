/**
 * Verify a claimed NIM payment against its order (Phase 4, §8).
 *
 * DORMANT until NIMIQ_RPC_URL is set (there is no free public Nimiq Albatross
 * RPC — we stand up our own node; see docs/server-side-credits.md §A). Until
 * then NIM keeps the temporary client record-purchase grant. The exact RPC
 * response field names are finalized against the live node on first bring-up
 * (validate-nim.mjs), so recipient/data are read defensively here.
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
  toAddress?: string;
  recipient?: string;
  value?: number;
  data?: string;
  recipientData?: string;
  blockNumber?: number;
  confirmations?: number;
}

/** Normalize an NQ address for comparison (drop spaces, upper-case). */
const normAddr = (a: string | undefined) => (a ?? "").replace(/\s+/g, "").toUpperCase();

/** Decode the on-chain data field to a string (hex or already-utf8). */
function decodeData(raw: string | undefined): string {
  if (!raw)
    return "";
  const hex = raw.startsWith("0x") ? raw.slice(2) : raw;
  if (/^[0-9a-fA-F]+$/.test(hex) && hex.length % 2 === 0) {
    const utf8 = Buffer.from(hex, "hex").toString("utf8");
    // Prefer the decoded form when it looks like our `appId:orderId` tag.
    if (utf8.includes(":"))
      return utf8;
  }
  return raw;
}

export async function verifyNim(order: OrderWithId, rpcUrl: string, auth?: RpcOptions["auth"]): Promise<VerifyResult> {
  if (!order.txHash)
    return { state: "mismatch", reason: "no txHash" };

  const opts: RpcOptions = auth ? { auth } : {};
  const tx = await jsonRpc<NimTx | null>(rpcUrl, "getTransactionByHash", [order.txHash], opts);
  if (!tx)
    return { state: "pending", reason: "tx not in history yet" };

  const recipient = normAddr(tx.to ?? tx.toAddress ?? tx.recipient);
  if (recipient !== normAddr(NIM_TREASURY_ADDRESS))
    return { state: "mismatch", reason: `wrong recipient ${recipient}` };

  // Freeze-and-require with a 1% floor for rounding drift (§7/§13).
  const minValue = Math.floor(order.expectedBaseUnits * 0.99);
  if (typeof tx.value !== "number" || tx.value < minValue)
    return { state: "mismatch", reason: `value ${tx.value} < ${minValue}` };

  const data = decodeData(tx.data ?? tx.recipientData);
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
