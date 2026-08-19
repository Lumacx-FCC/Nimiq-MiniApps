/**
 * Server-authoritative payment config (Phase 3+). The server — not the client —
 * decides prices, treasuries, and the amount owed for an order.
 *
 * Treasuries, prices, and the NIM bonus now live in `sharedPricing.ts`, the
 * single source both this file and the client's `src/core/config.ts` import —
 * no more hand-copying two files in sync. NIM_TREASURY_ADDRESS/
 * EVM_TREASURY_ADDRESS are still the shared test pair — replace before real
 * purchases should count as revenue.
 */
export { EVM_TREASURY_ADDRESS, NIM_BONUS_MULTIPLIER, NIM_TREASURY_ADDRESS, PACKS } from "./sharedPricing.js";
import { PACKS } from "./sharedPricing.js";

export const NIM_USD_FALLBACK_RATE = 0.005;
export const LUNA_PER_NIM = 100_000;
export const USDT_DECIMALS = 6;

/** How long an order can be paid before it expires. */
export const ORDER_TTL_MS = 30 * 60 * 1000;

/* ------------------------------------------------------------------ */
/* Phase 4 — on-chain reconciler                                       */
/* ------------------------------------------------------------------ */

/** USDT (PoS) contract on Polygon — the token the client transfers to us. */
export const USDT_POLYGON_CONTRACT = "0xc2132d05d31c914a87c6611c10748aeb04b58e8f";
/** keccak256("Transfer(address,address,uint256)") — ERC-20 Transfer log topic. */
export const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
/** Public Polygon RPC used when POLYGON_RPC_URL is unset. */
export const POLYGON_RPC_DEFAULT = "https://polygon-rpc.com";

/**
 * Public Nimiq Albatross RPC used when NIMIQ_RPC_URL is unset. NimiqWatch runs a
 * history node (answers getTransactionByHash for older txs). A third-party RPC is
 * a trust + availability dependency, accepted as a known, permanent tradeoff — a
 * self-hosted RPC VM was considered and cancelled (backlog Tier 2.4). Set
 * NIMIQ_RPC_URL to override if NimiqWatch becomes unreliable; set to "" to
 * disable NIM verification (orders stay skipped).
 */
export const NIMIQ_RPC_DEFAULT = "https://rpc.nimiqwatch.com";

/** Confirmation depth before a payment is considered final (reorg safety). */
export const CONFIRMATIONS_USDT = 5;
export const CONFIRMATIONS_NIM = 5;

/** Reconciler bounds: give up after this many checks or once past the grace. */
export const RECONCILE_MAX_ATTEMPTS = 40;
/** How long after submission to keep retrying before marking an order failed. */
export const RECONCILE_GRACE_MS = 20 * 60 * 1000;
/** Orders processed per scheduled pass. */
export const RECONCILE_BATCH = 25;

/** App id used in the NIM transaction data tag (`<appId>:<orderId>`). */
export const APP_ID = "otherme";

export function findPack(usd: number): { usd: number; credits: number } | null {
  return PACKS.find(p => Math.abs(p.usd - usd) < 1e-9) ?? null;
}

/** NIM/USD from CoinGecko (same source as the client), with a static fallback. */
export async function getNimUsdRate(): Promise<number> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd");
    if (!res.ok)
      throw new Error(String(res.status));
    const data = await res.json() as { "nimiq-2"?: { usd?: number } };
    const rate = data["nimiq-2"]?.usd;
    if (!rate || rate <= 0)
      throw new Error("no rate");
    return rate;
  }
  catch {
    return NIM_USD_FALLBACK_RATE;
  }
}
