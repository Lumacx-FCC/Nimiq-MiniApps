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
   * PayPal placeholder. The Mini Apps Competition rules and the Nimiq
   * mini-app docs prohibit third-party payment providers inside Nimiq Pay —
   * keep this false for any app/build that only targets that context (this
   * demo app included). An app distributed outside Nimiq Pay too (otherme-app)
   * may set this true and additionally gate visibility per signed-in identity
   * (e.g. hidden for wallet sign-ins) rather than relying on this flag alone.
   */
  paypalEnabled: boolean
  /** PayPal REST app client ID — public/embeddable by design (same posture as
   * a Firebase web API key), used to load the PayPal JS SDK client-side.
   * Empty when `paypalEnabled` is false. */
  paypalClientId: string
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
  paypalClientId: '',
  nimUsdFallbackRate: 0.005,
}

export function configure(overrides: Partial<CoreConfig>): void {
  Object.assign(config, overrides)
}

export function getConfig(): Readonly<CoreConfig> {
  return config
}
