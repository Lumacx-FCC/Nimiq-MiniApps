/**
 * Server-authoritative payment config (Phase 3+). The server — not the client —
 * decides prices, treasuries, and the amount owed for an order.
 *
 * KEEP IN SYNC with otherme-app/src/core/config.ts (packs, treasuries, bonus).
 * These are the test values; replace treasuries + prices for production.
 */
export const NIM_TREASURY_ADDRESS = "NQ52 P5JM 7T15 VFSV 9G8S UEA1 7CRA JVAH U69F";
export const EVM_TREASURY_ADDRESS = "0xdA5727CEb6bc093f22F6d56b75F5B3773Fbdf4D1";

export const NIM_BONUS_MULTIPLIER = 1.5;
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
 * history node (answers getTransactionByHash for older txs) — INTERIM only,
 * until our own node is up (see docs/server-side-credits.md §A). A third-party
 * RPC is a trust + availability dependency; override it with the NIMIQ_RPC_URL
 * secret pointing at our VM once that's live. Set to "" to disable NIM
 * verification (orders stay skipped).
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

/** Test credit packs (÷5). Keep in sync with the client config. */
export const PACKS = [
  { usd: 0.20, credits: 60 },
  { usd: 1.00, credits: 500 },
  { usd: 4.00, credits: 3000 },
] as const;

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
