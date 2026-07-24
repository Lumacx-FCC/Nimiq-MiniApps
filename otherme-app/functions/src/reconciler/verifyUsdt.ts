/**
 * Verify a claimed USDT-on-Polygon payment against its order (Phase 4, §8).
 *
 * We look up the exact claimed txHash (the claim binds it to this order+user),
 * so there is no address scan and no amount-dust uniqueness to worry about. We
 * assert the receipt succeeded and carries a USDT Transfer log paying the
 * treasury the exact expected amount from the session's payer address, and that
 * it is buried under enough confirmations to be reorg-safe.
 */
import type { OrderWithId } from "../orders/store.js";
import {
  CONFIRMATIONS_USDT,
  ERC20_TRANSFER_TOPIC,
  EVM_TREASURY_ADDRESS,
  USDT_POLYGON_CONTRACT,
} from "../config.js";
import { jsonRpc } from "./rpc.js";
import type { VerifyResult } from "./verify.js";

interface RpcLog {
  address: string;
  topics: string[];
  data: string;
}
interface RpcReceipt {
  status: string; // "0x1" success, "0x0" reverted
  blockNumber: string; // hex
  logs: RpcLog[];
}

/** Last 20 bytes of a 32-byte topic word → lowercased 0x address. */
function topicToAddress(topic: string): string {
  return `0x${topic.slice(-40)}`.toLowerCase();
}

export async function verifyUsdt(order: OrderWithId, rpcUrl: string): Promise<VerifyResult> {
  if (!order.txHash)
    return { state: "mismatch", reason: "no txHash" };
  // Payer binding closes threat E (claiming someone else's tx to the treasury).
  if (!order.payerAddress)
    return { state: "mismatch", reason: "missing payer address" };

  const receipt = await jsonRpc<RpcReceipt | null>(rpcUrl, "eth_getTransactionReceipt", [order.txHash]);
  if (!receipt)
    return { state: "pending", reason: "receipt not available yet" };
  if (receipt.status !== "0x1")
    return { state: "mismatch", reason: "transaction reverted" };

  const treasury = EVM_TREASURY_ADDRESS.toLowerCase();
  const payer = order.payerAddress.toLowerCase();
  const expected = BigInt(order.expectedBaseUnits);

  const transfer = receipt.logs.find(
    log => log.address.toLowerCase() === USDT_POLYGON_CONTRACT
      && log.topics[0]?.toLowerCase() === ERC20_TRANSFER_TOPIC,
  );
  if (!transfer)
    return { state: "mismatch", reason: "no USDT Transfer log" };

  const from = topicToAddress(transfer.topics[1]);
  const to = topicToAddress(transfer.topics[2]);
  const value = BigInt(transfer.data);

  if (to !== treasury)
    return { state: "mismatch", reason: `wrong recipient ${to}` };
  if (from !== payer)
    return { state: "mismatch", reason: `payer mismatch ${from}` };
  if (value !== expected)
    return { state: "mismatch", reason: `amount ${value} != ${expected}` };

  const head = BigInt(await jsonRpc<string>(rpcUrl, "eth_blockNumber", []));
  const confirmations = head - BigInt(receipt.blockNumber);
  if (confirmations < BigInt(CONFIRMATIONS_USDT))
    return { state: "pending", reason: `only ${confirmations} confirmations` };

  return { state: "confirmed" };
}
