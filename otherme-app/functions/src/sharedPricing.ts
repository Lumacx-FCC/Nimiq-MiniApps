/**
 * Single source of truth for prices, treasuries, and the NIM bonus — imported
 * by BOTH the server (functions/src/config.ts) and the client
 * (otherme-app/src/core/config.ts, via a relative import into this file).
 *
 * This file must stay side-effect-free and dependency-free (no imports of its
 * own): the client bundles it through Vite/esbuild, the server compiles it
 * through tsc/Node — anything beyond plain literal exports could behave
 * differently across those two toolchains.
 *
 * The server is still authoritative for what it actually charges
 * (`findPack` in config.ts rejects any USD it doesn't recognize) — this file
 * only removes the need to hand-copy the same numbers into two places.
 */

// Production treasury accounts — NIM and Polygon/USDT. Rotated 2026-08-19 off
// the address that had been publicly labeled "test" in the repo's history.
export const NIM_TREASURY_ADDRESS = "NQ45 G5KD DD93 5EJ5 EK0X CTSP 6NCJ FBJ1 BJ69";
export const EVM_TREASURY_ADDRESS = "0x6b6dd19e222068EDdf799eE6fdCA163f14F57AAF";

/**
 * PRODUCTION PRICES (live since 2026-07-27). `usd` is what we actually charge:
 * the early-bird price, 25% off the regular $1 / $5 / $20 until Nov 1st 2026.
 * After Nov 1st: set these to the regular values and drop the client's banner.
 */
export const PACKS = [
  { usd: 0.75, credits: 30 },
  { usd: 3.75, credits: 200 },
  { usd: 15.00, credits: 1000 },
] as const;

/**
 * Regular (non-discounted) prices for the same 3 pack sizes — the early-bird
 * discount in PACKS above doesn't apply to the PayPal/Credit Card rail
 * (backlog 4.7), whose 3 PayPal Hosted Buttons are configured at these fixed
 * prices on PayPal's own side. Same order as PACKS (Starter/Value/Power).
 */
export const REGULAR_PACKS = [
  { usd: 1, credits: 30 },
  { usd: 5, credits: 200 },
  { usd: 20, credits: 1000 },
] as const;

export const NIM_BONUS_MULTIPLIER = 1.5;
