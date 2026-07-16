import { getConfig } from '../config'

const CACHE_MS = 60_000
let cached: { rate: number, at: number } | null = null

/**
 * Current NIM/USD rate from CoinGecko, cached for a minute.
 * Falls back to the configured static rate when the API is unreachable
 * (the quote screen still works offline; final pricing is server-verified
 * in the full project).
 */
export async function getNimUsdRate(): Promise<{ rate: number, isLive: boolean }> {
  if (cached && Date.now() - cached.at < CACHE_MS)
    return { rate: cached.rate, isLive: true }

  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd')
    if (!res.ok)
      throw new Error(`price API ${res.status}`)
    const data = await res.json() as { 'nimiq-2'?: { usd?: number } }
    const rate = data['nimiq-2']?.usd
    if (!rate || rate <= 0)
      throw new Error('price API returned no rate')
    cached = { rate, at: Date.now() }
    return { rate, isLive: true }
  }
  catch {
    return { rate: getConfig().nimUsdFallbackRate, isLive: false }
  }
}
