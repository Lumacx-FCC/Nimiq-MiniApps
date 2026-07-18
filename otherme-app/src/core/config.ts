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
  // TESTING PRICES (÷100). Production: $1/60, $5/500, $20/3000.
  packs: [
    { usd: 0.01, credits: 60 },
    { usd: 0.05, credits: 500 },
    { usd: 0.20, credits: 3000 },
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
