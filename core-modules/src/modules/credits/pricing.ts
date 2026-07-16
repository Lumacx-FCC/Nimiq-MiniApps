import type { CreditPack } from '../config'
import { getConfig } from '../config'

export interface Quote {
  pack: CreditPack
  method: 'usdt' | 'nim'
  /** Credits granted after payment (NIM gets the bonus multiplier). */
  credits: number
  /** Amount to pay, in the payment currency's display unit (USDT or NIM). */
  amount: number
}

/** $5 USDT = 300 credits (per config). */
export function quoteUsdt(pack: CreditPack): Quote {
  return { pack, method: 'usdt', credits: pack.credits, amount: pack.usd }
}

/**
 * Paying with NIM grants 150% of the pack's credits (per config).
 * The NIM amount is the pack's USD price converted at the given rate.
 */
export function quoteNim(pack: CreditPack, nimUsdRate: number): Quote {
  const { nimBonusMultiplier } = getConfig()
  return {
    pack,
    method: 'nim',
    credits: Math.round(pack.credits * nimBonusMultiplier),
    amount: pack.usd / nimUsdRate,
  }
}
