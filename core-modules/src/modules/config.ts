/**
 * Shared configuration for all FCC mini apps.
 * Every app importing these modules overrides what it needs via `configure()`.
 */

export interface CoreConfig {
  /** App identifier — namespaces credit balances per app. */
  appId: string
  /** Display name shown on the login screen. */
  appName: string
  /** Nimiq address that receives NIM payments (our treasury). */
  nimTreasuryAddress: string
  /** EVM address that receives USDT payments (our treasury). */
  evmTreasuryAddress: string
  /** Google OAuth client ID (Google Identity Services). Empty = Google login hidden. */
  googleClientId: string
  /** Credit packs: USD price and credits granted when paying in USDT. */
  packs: CreditPack[]
  /** Multiplier applied to credits when paying with NIM (150% = 1.5). */
  nimBonusMultiplier: number
  /** What credits buy — shown under the packs. */
  creditHighlights: string[]
  /**
   * PayPal placeholder for browser-only distribution. MUST stay false in the
   * competition build: the rules and the Nimiq mini-app docs prohibit
   * third-party payment providers inside Nimiq Pay.
   */
  paypalEnabled: boolean
  /** Fallback NIM/USD rate when the live price API is unreachable. */
  nimUsdFallbackRate: number
}

export interface CreditPack {
  usd: number
  credits: number
}

const config: CoreConfig = {
  appId: 'fcc-demo',
  appName: 'OtherMe',
  // Team test treasury accounts (owner: LC). Confirm before production launch.
  nimTreasuryAddress: 'NQ52 P5JM 7T15 VFSV 9G8S UEA1 7CRA JVAH U69F',
  evmTreasuryAddress: '0xdA5727CEb6bc093f22F6d56b75F5B3773Fbdf4D1',
  googleClientId: '',
  // TESTING PRICES (÷100). Production: $1/60, $5/500, $20/3000.
  packs: [
    { usd: 0.01, credits: 60 },
    { usd: 0.05, credits: 500 },
    { usd: 0.20, credits: 3000 },
  ],
  nimBonusMultiplier: 1.5,
  creditHighlights: [
    '1 minute talking = 1 credit',
    '1 video (8 seconds) = 100 credits',
  ],
  paypalEnabled: false,
  nimUsdFallbackRate: 0.005,
}

export function configure(overrides: Partial<CoreConfig>): void {
  Object.assign(config, overrides)
}

export function getConfig(): Readonly<CoreConfig> {
  return config
}
