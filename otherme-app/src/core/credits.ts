/**
 * React bridge over core-modules credits. Same MVP ledger (localStorage,
 * client-side grant after wallet tx hash) and same storage keys as the Vue
 * composable — payment logic (USDT Polygon / NIM with bonus) is imported.
 */
import type { CreditPack } from '@core/config'
import type { Quote } from '@core/credits/pricing'
import { getConfig } from '@core/config'
import { payNim } from '@core/credits/payNim'
import { payUsdt } from '@core/credits/payUsdt'
import { quoteNim, quoteUsdt } from '@core/credits/pricing'
import { getNimUsdRate } from '@core/credits/rates'
import { createStore, useStore } from './store'

export interface PurchaseRecord {
  txHash: string
  method: 'usdt' | 'nim'
  credits: number
  amount: number
  at: string
}

interface CreditsState {
  balance: number
  history: PurchaseRecord[]
  isPaying: boolean
  error: string | null
}

const creditsStore = createStore<CreditsState>({ balance: 0, history: [], isPaying: false, error: null })
let loadedForUser: string | null = null

const storageKey = (userId: string) => `${getConfig().appId}:credits:${userId}`

export function loadCreditsFor(userId: string): void {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    const parsed = raw ? JSON.parse(raw) as { balance: number, history: PurchaseRecord[] } : null
    creditsStore.set({ balance: parsed?.balance ?? 0, history: parsed?.history ?? [], isPaying: false, error: null })
  }
  catch {
    creditsStore.set({ balance: 0, history: [], isPaying: false, error: null })
  }
  loadedForUser = userId
}

export function unloadCredits(): void {
  loadedForUser = null
  creditsStore.set({ balance: 0, history: [], isPaying: false, error: null })
}

function persist(): void {
  if (!loadedForUser)
    return
  const { balance, history } = creditsStore.get()
  localStorage.setItem(storageKey(loadedForUser), JSON.stringify({ balance, history }))
}

function grant(record: PurchaseRecord): void {
  creditsStore.update(s => ({
    ...s,
    balance: s.balance + record.credits,
    history: [record, ...s.history].slice(0, 20),
  }))
  persist()
}

async function runPurchase(fn: () => Promise<PurchaseRecord>): Promise<boolean> {
  creditsStore.update(s => ({ ...s, isPaying: true, error: null }))
  try {
    grant(await fn())
    creditsStore.update(s => ({ ...s, isPaying: false }))
    return true
  }
  catch (e) {
    creditsStore.update(s => ({ ...s, isPaying: false, error: e instanceof Error ? e.message : String(e) }))
    return false
  }
}

export const credits = {
  get balance() { return creditsStore.get().balance },
  packs: () => getConfig().packs,
  highlights: () => getConfig().creditHighlights,
  /** Spend credits inside the app. Returns false when balance is short. */
  spend(amount: number): boolean {
    if (creditsStore.get().balance < amount)
      return false
    creditsStore.update(s => ({ ...s, balance: s.balance - amount }))
    persist()
    return true
  },
  quoteUsdt,
  async quoteNimFor(pack: CreditPack): Promise<Quote & { rateIsLive: boolean }> {
    const { rate, isLive } = await getNimUsdRate()
    return { ...quoteNim(pack, rate), rateIsLive: isLive }
  },
  buyWithUsdt: (pack: CreditPack) => runPurchase(async () => {
    const quote = quoteUsdt(pack)
    const txHash = await payUsdt(quote.amount)
    return { txHash, method: 'usdt' as const, credits: quote.credits, amount: quote.amount, at: new Date().toISOString() }
  }),
  buyWithNim: (pack: CreditPack) => runPurchase(async () => {
    const { rate } = await getNimUsdRate()
    const quote = quoteNim(pack, rate)
    const txHash = await payNim(quote.amount, `pack-${pack.usd}usd`)
    return { txHash, method: 'nim' as const, credits: quote.credits, amount: quote.amount, at: new Date().toISOString() }
  }),
}

export function useCredits() {
  const state = useStore(creditsStore)
  return {
    ...credits,
    balance: state.balance,
    history: state.history,
    isPaying: state.isPaying,
    error: state.error,
  }
}
