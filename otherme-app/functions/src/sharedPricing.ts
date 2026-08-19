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

// Team test treasury accounts (same as core-modules demo). Replace for production.
export const NIM_TREASURY_ADDRESS = "NQ52 P5JM 7T15 VFSV 9G8S UEA1 7CRA JVAH U69F";
export const EVM_TREASURY_ADDRESS = "0xdA5727CEb6bc093f22F6d56b75F5B3773Fbdf4D1";

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

export const NIM_BONUS_MULTIPLIER = 1.5;
