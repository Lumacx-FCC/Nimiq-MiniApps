/**
 * FCC Nimiq core modules — single import surface for all our mini apps.
 *
 * Usage in any app:
 *   import { configure, useAuth, useCredits } from '<core-modules>/src/modules'
 *   configure({ appId: 'aeternum', nimTreasuryAddress: '...', evmTreasuryAddress: '0x...' })
 */

export { configure, getConfig } from './config'
export type { CoreConfig, CreditPack } from './config'

export { useAuth } from './auth/useAuth'
export type { AuthUser, AuthProvider } from './auth/types'
export { isInsideNimiqPay } from './auth/nimiqAuth'

export { useTheme } from './theme'
export type { Theme } from './theme'

export { useCredits } from './credits/useCredits'
export type { PurchaseRecord } from './credits/useCredits'
export type { Quote } from './credits/pricing'
