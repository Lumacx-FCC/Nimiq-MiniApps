/**
 * Other Me app configuration over the shared FCC core-modules.
 * Import once (main.tsx) before anything touches auth/credits.
 */
import { configure } from '@core/config'

configure({
  appId: 'otherme',
  appName: 'Other Me',
  // Team test treasury accounts (same as core-modules demo). Replace for production.
  nimTreasuryAddress: 'NQ52 P5JM 7T15 VFSV 9G8S UEA1 7CRA JVAH U69F',
  evmTreasuryAddress: '0xdA5727CEb6bc093f22F6d56b75F5B3773Fbdf4D1',
  // PRODUCTION PRICES (live since 2026-07-27). `usd` is what we actually charge:
  // the early-bird price, 25% off the regular rate until Nov 1st 2026. Regular
  // prices live in REGULAR_USD below (shown struck through on the Credits page).
  // After Nov 1st: set these to the REGULAR_USD values and drop the banner.
  // KEEP IN SYNC with functions/src/config.ts PACKS — the server is authoritative.
  packs: [
    { usd: 0.75, credits: 30 },
    { usd: 3.75, credits: 200 },
    { usd: 15.00, credits: 1000 },
  ],
  nimBonusMultiplier: 1.5,
  creditHighlights: [
    '1 minute talking = 1 credit',
    '1 talking avatar = 3 credits',
    '1 scene image = 5 credits',
    '1 video (8s) = 100 credits',
  ],
  paypalEnabled: false,
})

/**
 * Regular (pre-discount) price per pack, keyed by the early-bird price we charge.
 * Display only — struck through next to the live price on the Credits page.
 */
export const REGULAR_USD: Record<number, number> = {
  0.75: 1,
  3.75: 5,
  15: 20,
}

/** One-time starter balance granted the first time an account's ledger is created. */
export const WELCOME_CREDITS = 5
export const FREE_SHEET_GENERATIONS = 5
export const SHEET_RENDER_CREDITS = 1
export const FREE_SCENE_GENERATIONS = 5
export const AVATAR_SPRITE_CREDITS = 3
export const SCENE_CREDITS = 5
export const VIDEO_CREDITS = 100
export const VIDEO_MAX_EDITS = 3
export const TALK_CREDITS_PER_MINUTE = 1
