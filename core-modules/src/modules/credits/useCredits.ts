import type { CreditPack } from '../config'
import type { Quote } from './pricing'
import { computed, ref } from 'vue'
import { getConfig } from '../config'
import { payNim } from './payNim'
import { isPaypalEnabled, payPaypal } from './payPaypal'
import { payUsdt } from './payUsdt'
import { quoteNim, quoteUsdt } from './pricing'
import { getNimUsdRate } from './rates'

export interface PurchaseRecord {
  txHash: string
  method: 'usdt' | 'nim' | 'paypal'
  credits: number
  amount: number
  at: string
}

const balance = ref(0)
const history = ref<PurchaseRecord[]>([])
const isPaying = ref(false)
const error = ref<string | null>(null)
let loadedForUser: string | null = null

const storageKey = (userId: string) => `${getConfig().appId}:credits:${userId}`

/**
 * MVP ledger: credits live in localStorage, granted client-side once the
 * wallet returns a tx hash. The full project replaces `grant()` with a
 * backend call that verifies the tx on-chain before crediting — never
 * trust the client for balances in production.
 */
function load(userId: string): void {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    const parsed = raw ? JSON.parse(raw) as { balance: number, history: PurchaseRecord[] } : null
    balance.value = parsed?.balance ?? 0
    history.value = parsed?.history ?? []
  }
  catch {
    balance.value = 0
    history.value = []
  }
  loadedForUser = userId
}

function persist(): void {
  if (!loadedForUser)
    return
  localStorage.setItem(storageKey(loadedForUser), JSON.stringify({
    balance: balance.value,
    history: history.value,
  }))
}

function grant(record: PurchaseRecord): void {
  balance.value += record.credits
  history.value = [record, ...history.value].slice(0, 20)
  persist()
}

async function runPurchase(fn: () => Promise<PurchaseRecord>): Promise<void> {
  isPaying.value = true
  error.value = null
  try {
    grant(await fn())
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    isPaying.value = false
  }
}

export function useCredits() {
  return {
    balance: computed(() => balance.value),
    history: computed(() => history.value),
    isPaying: computed(() => isPaying.value),
    error: computed(() => error.value),
    packs: () => getConfig().packs,
    highlights: () => getConfig().creditHighlights,
    isPaypalEnabled,
    /** Call after login / user switch. */
    loadFor: load,
    /** Spend credits inside the app. Returns false when balance is short. */
    spend: (amount: number): boolean => {
      if (balance.value < amount)
        return false
      balance.value -= amount
      persist()
      return true
    },
    quoteUsdt,
    quoteNimFor: async (pack: CreditPack): Promise<Quote & { rateIsLive: boolean }> => {
      const { rate, isLive } = await getNimUsdRate()
      return { ...quoteNim(pack, rate), rateIsLive: isLive }
    },
    buyWithUsdt: (pack: CreditPack) => runPurchase(async () => {
      const quote = quoteUsdt(pack)
      const txHash = await payUsdt(quote.amount)
      return { txHash, method: 'usdt', credits: quote.credits, amount: quote.amount, at: new Date().toISOString() }
    }),
    buyWithNim: (pack: CreditPack) => runPurchase(async () => {
      const { rate } = await getNimUsdRate()
      const quote = quoteNim(pack, rate)
      const txHash = await payNim(quote.amount, `pack-${pack.usd}usd`)
      return { txHash, method: 'nim', credits: quote.credits, amount: quote.amount, at: new Date().toISOString() }
    }),
    buyWithPaypal: (pack: CreditPack) => runPurchase(async () => {
      const txHash = await payPaypal(pack.usd)
      return { txHash, method: 'paypal', credits: pack.credits, amount: pack.usd, at: new Date().toISOString() }
    }),
  }
}
