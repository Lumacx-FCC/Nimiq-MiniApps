/**
 * Other Me app configuration over the shared FCC core-modules.
 * Import once (main.tsx) before anything touches auth/credits.
 */
import { configure } from '@core/config'
// Single source of truth for treasuries/prices/bonus, shared with the server
// (functions/src/config.ts imports the same file) — see its own header comment.
import { EVM_TREASURY_ADDRESS, NIM_BONUS_MULTIPLIER, NIM_TREASURY_ADDRESS, PACKS } from '../../functions/src/sharedPricing'

configure({
  appId: 'otherme',
  appName: 'Other Me',
  nimTreasuryAddress: NIM_TREASURY_ADDRESS,
  evmTreasuryAddress: EVM_TREASURY_ADDRESS,
  // Regular (pre-discount) prices live in REGULAR_USD below (shown struck
  // through on the Credits page) — after Nov 1st 2026, set PACKS in
  // sharedPricing.ts to the REGULAR_USD values and drop the banner.
  packs: [...PACKS],
  nimBonusMultiplier: NIM_BONUS_MULTIPLIER,
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

/**
 * Show the "Continue with Google" button. Real Firebase-backed Google sign-in
 * (see core/authProviders.ts). Confirmed 2026-08-18: Google sign-in enabled
 * in the Firebase console for otherme-18f5b with an auto-generated Web SDK
 * client (239756970799-...), so the button is live.
 */
export const GOOGLE_LOGIN_ENABLED = true

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
