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
import { doc, onSnapshot } from 'firebase/firestore'
import { WELCOME_CREDITS } from './config'
import { serverUrl } from './api'
import { getFirebaseDb } from './firebase'
import { getSessionToken, onSessionChange } from './session'
import { createStore, useStore } from './store'

export interface PurchaseRecord {
  txHash: string
  method: 'usdt' | 'nim'
  credits: number
  amount: number
  at: string
}

/**
 * Phase 4 — NIM server-verified cutover.
 *
 * true: session NIM purchases go through the same server-verified confirming
 * path as USDT (order → pay → claim → onSnapshot → reconciler grants). The
 * reconciler verifies against NIMIQ_RPC_URL / the public NimiqWatch default.
 *
 * Trade-off: NIM (the primary rail) now depends on that RPC being reachable —
 * an outage makes NIM purchases wait then fail rather than granting. Flip back
 * to false to restore the instant record-purchase grant if the interim RPC is
 * unreliable; our own node (docs §A) removes the dependency.
 */
const NIM_SERVER_VERIFIED = true

/**
 * Purchase state machine for the confirming-payment UI (§12). USDT session
 * purchases are granted by the on-chain reconciler, not the client, so the flow
 * advances submitted → confirming → granted (driven by the order doc snapshot),
 * escalating to `slow` on a client timer only.
 */
export type PurchaseStatus = 'idle' | 'approving' | 'submitted' | 'confirming' | 'slow' | 'granted' | 'failed'

export interface PurchaseFlow {
  status: PurchaseStatus
  method?: 'usdt' | 'nim'
  credits?: number
  amount?: number
  txHash?: string
  orderId?: string
  error?: string | null
}

interface CreditsState {
  balance: number
  history: PurchaseRecord[]
  isPaying: boolean
  error: string | null
  flow: PurchaseFlow
}

const IDLE_FLOW: PurchaseFlow = { status: 'idle' }

const creditsStore = createStore<CreditsState>({ balance: 0, history: [], isPaying: false, error: null, flow: IDLE_FLOW })
let loadedForUser: string | null = null

const storageKey = (userId: string) => `${getConfig().appId}:credits:${userId}`

export function loadCreditsFor(userId: string): void {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) {
      // First session for this account — welcome credits fund the starter renders.
      creditsStore.set({ balance: WELCOME_CREDITS, history: [], isPaying: false, error: null, flow: IDLE_FLOW })
      loadedForUser = userId
      persist()
      return
    }
    const parsed = JSON.parse(raw) as { balance: number, history: PurchaseRecord[] }
    creditsStore.set({ balance: parsed.balance ?? 0, history: parsed.history ?? [], isPaying: false, error: null, flow: IDLE_FLOW })
  }
  catch {
    creditsStore.set({ balance: 0, history: [], isPaying: false, error: null, flow: IDLE_FLOW })
  }
  loadedForUser = userId
}

export function unloadCredits(): void {
  loadedForUser = null
  stopWatch()
  creditsStore.set({ balance: 0, history: [], isPaying: false, error: null, flow: IDLE_FLOW })
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

/* ------------------------------------------------------------------ */
/* Server ledger (Phase 2) — authoritative when a wallet session exists */
/* ------------------------------------------------------------------ */

/** Authenticated call to the credits backend. Null when there's no session. */
async function authedFetch(path: string, body?: unknown): Promise<any | null> {
  const token = await getSessionToken()
  if (!token)
    return null // email/Google login or no server session — stay localStorage-only
  const res = await fetch(serverUrl(path), {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return res.json().catch(() => null)
}

/** Adopt the server's authoritative balance into the local cache. */
function adoptServerBalance(data: any | null): void {
  if (data && typeof data.balance === 'number') {
    creditsStore.update(s => ({ ...s, balance: data.balance }))
    persist()
  }
}

/**
 * Sync with the server ledger. On first ever call it imports the current local
 * balance (one-time, guarded server-side); afterwards the server balance wins.
 * No-op without a session (localStorage stays authoritative).
 */
async function syncFromServer(): Promise<void> {
  try {
    adoptServerBalance(await authedFetch('/api/credits/migrate', { localBalance: creditsStore.get().balance }))
  }
  catch {
    // Offline / server down — keep the local cache; nothing depends on this.
  }
}

async function reconcileSpend(amount: number, kind: string): Promise<void> {
  try {
    // 402 (insufficient) still returns the authoritative balance to adopt.
    adoptServerBalance(await authedFetch('/api/credits/spend', { amount, kind }))
  }
  catch { /* keep optimistic local balance */ }
}

async function reconcilePurchase(record: PurchaseRecord): Promise<void> {
  try {
    adoptServerBalance(await authedFetch('/api/credits/record-purchase', {
      txHash: record.txHash,
      credits: record.credits,
      method: record.method,
      amount: record.amount,
    }))
  }
  catch { /* keep optimistic local balance */ }
}

// Sync whenever a wallet session appears (login) or is restored (reload).
onSessionChange((address) => {
  if (address)
    void syncFromServer()
})

interface ServerOrder {
  orderId: string
  method: 'nim' | 'usdt'
  expectedAmount: number
  expectedRecipient: string
  credits: number
}

async function createServerOrder(method: 'nim' | 'usdt', packUsd: number): Promise<ServerOrder> {
  const data = await authedFetch('/api/orders', { method, packUsd })
  if (!data || data.error)
    throw new Error(data?.error || 'Could not create the payment order')
  return data as ServerOrder
}

async function claimServerOrder(orderId: string, txHash: string, payerAddress?: string): Promise<void> {
  await authedFetch(`/api/orders/${orderId}/claim`, { txHash, payerAddress })
}

/**
 * Execute a purchase and return the record to grant.
 *
 * With a wallet session (Phase 3): create a server order (server fixes the
 * amount + a reference), pay that amount tagging the tx with the order id, then
 * claim it — recording the tx for Phase 4's on-chain reconciler. Credits are
 * still granted now via the temporary record-purchase path in runPurchase;
 * Phase 4 moves granting to the verified reconciler.
 *
 * Without a session (email/Google login): legacy client-only quote + pay.
 */
async function purchase(method: 'nim' | 'usdt', pack: CreditPack): Promise<PurchaseRecord> {
  const at = new Date().toISOString()
  const token = await getSessionToken()

  if (token) {
    const order = await createServerOrder(method, pack.usd)
    let txHash: string
    let payerAddress: string | undefined
    if (method === 'nim') {
      txHash = await payNim(order.expectedAmount, order.orderId)
    }
    else {
      const paid = await payUsdt(order.expectedAmount)
      txHash = paid.txHash
      payerAddress = paid.from
    }
    await claimServerOrder(order.orderId, txHash, payerAddress)
    return { txHash, method, credits: order.credits, amount: order.expectedAmount, at }
  }

  // Legacy client-only path (no server session).
  if (method === 'nim') {
    const { rate } = await getNimUsdRate()
    const quote = quoteNim(pack, rate)
    const txHash = await payNim(quote.amount, `pack-${pack.usd}usd`)
    return { txHash, method: 'nim', credits: quote.credits, amount: quote.amount, at }
  }
  const quote = quoteUsdt(pack)
  const paid = await payUsdt(quote.amount)
  return { txHash: paid.txHash, method: 'usdt', credits: quote.credits, amount: quote.amount, at }
}

async function runPurchase(fn: () => Promise<PurchaseRecord>): Promise<boolean> {
  creditsStore.update(s => ({ ...s, isPaying: true, error: null }))
  try {
    const record = await fn()
    grant(record)
    void reconcilePurchase(record) // dual-write to the server ledger
    creditsStore.update(s => ({ ...s, isPaying: false }))
    return true
  }
  catch (e) {
    creditsStore.update(s => ({ ...s, isPaying: false, error: e instanceof Error ? e.message : String(e) }))
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Phase 4 — server-verified purchase (reconciler is the sole granter) */
/* ------------------------------------------------------------------ */

function setFlow(patch: Partial<PurchaseFlow>): void {
  creditsStore.update(s => ({ ...s, flow: { ...s.flow, ...patch } }))
}

let orderUnsub: (() => void) | null = null
let slowTimer: ReturnType<typeof setTimeout> | null = null

function stopWatch(): void {
  orderUnsub?.()
  orderUnsub = null
  if (slowTimer) {
    clearTimeout(slowTimer)
    slowTimer = null
  }
}

/**
 * Watch the order doc: the reconciler flips it to `granted` (or `failed`) after
 * verifying the payment on-chain. That snapshot — not the client — drives the
 * confirming UI to its terminal state. The 90s timer only escalates the *copy*
 * from `confirming` to `slow`; it never grants.
 */
function watchOrder(orderId: string): void {
  stopWatch()
  slowTimer = setTimeout(() => {
    creditsStore.update(s => (s.flow.status === 'confirming' ? { ...s, flow: { ...s.flow, status: 'slow' } } : s))
  }, 90_000)

  orderUnsub = onSnapshot(
    doc(getFirebaseDb(), 'orders', orderId),
    (snap) => {
      const status = (snap.data() as { status?: string } | undefined)?.status
      if (status === 'granted') {
        stopWatch()
        void authedFetch('/api/credits/balance').then(adoptServerBalance)
        creditsStore.update((s) => {
          const rec: PurchaseRecord = {
            txHash: s.flow.txHash || '',
            method: s.flow.method || 'usdt',
            credits: s.flow.credits || 0,
            amount: s.flow.amount || 0,
            at: new Date().toISOString(),
          }
          return { ...s, isPaying: false, history: [rec, ...s.history].slice(0, 20), flow: { ...s.flow, status: 'granted' } }
        })
      }
      else if (status === 'failed' || status === 'expired') {
        stopWatch()
        creditsStore.update(s => ({ ...s, isPaying: false, flow: { ...s.flow, status: 'failed' } }))
      }
    },
    () => { /* snapshot error (offline/rules) — leave the flow; user can dismiss/retry */ },
  )
}

/**
 * Server-verified purchase flow (§8/§12). Create an order, pay the server-fixed
 * amount tagging the tx with the order id, claim it, then WAIT for the on-chain
 * reconciler to grant — the client never grants and never calls record-purchase.
 * `isPaying` stays true through `confirming` so the pack buttons stay disabled.
 */
async function runServerPurchase(method: 'usdt' | 'nim', pack: CreditPack): Promise<boolean> {
  stopWatch()
  creditsStore.update(s => ({ ...s, isPaying: true, error: null, flow: { status: 'approving', method } }))
  try {
    const order = await createServerOrder(method, pack.usd)
    setFlow({ credits: order.credits, amount: order.expectedAmount })

    let txHash: string
    let payerAddress: string | undefined
    if (method === 'nim') {
      txHash = await payNim(order.expectedAmount, order.orderId)
    }
    else {
      const paid = await payUsdt(order.expectedAmount)
      txHash = paid.txHash
      payerAddress = paid.from
    }

    setFlow({ status: 'submitted', orderId: order.orderId, txHash })
    await claimServerOrder(order.orderId, txHash, payerAddress)
    setFlow({ status: 'confirming' })
    watchOrder(order.orderId)
    return true
  }
  catch (e) {
    // Failure before/at payment: nothing was granted, so reset to idle with a
    // message. A tx that actually broadcast is still reconciled server-side.
    stopWatch()
    const msg = e instanceof Error ? e.message : String(e)
    creditsStore.update(s => ({ ...s, isPaying: false, error: msg, flow: { status: 'idle', error: msg } }))
    return false
  }
}

export const credits = {
  get balance() { return creditsStore.get().balance },
  packs: () => getConfig().packs,
  highlights: () => getConfig().creditHighlights,
  /**
   * Spend credits inside the app. Optimistic local decrement for instant UX,
   * then dual-writes to the server ledger (which reconciles the authoritative
   * balance back). Returns false when the local balance is short. `kind` labels
   * the spend in the server ledger.
   */
  spend(amount: number, kind = 'spend'): boolean {
    if (creditsStore.get().balance < amount)
      return false
    creditsStore.update(s => ({ ...s, balance: s.balance - amount }))
    persist()
    void reconcileSpend(amount, kind)
    return true
  },
  quoteUsdt,
  async quoteNimFor(pack: CreditPack): Promise<Quote & { rateIsLive: boolean }> {
    const { rate, isLive } = await getNimUsdRate()
    return { ...quoteNim(pack, rate), rateIsLive: isLive }
  },
  /**
   * USDT is fully cut over: a wallet session pays through the server-verified
   * flow (reconciler grants). Without a session (email/Google) it falls back to
   * the legacy client-only path.
   */
  async buyWithUsdt(pack: CreditPack): Promise<boolean> {
    const token = await getSessionToken()
    return token ? runServerPurchase('usdt', pack) : runPurchase(() => purchase('usdt', pack))
  },
  /**
   * NIM stays on the temporary claim + record-purchase grant until our Nimiq
   * node RPC is live (NIM_SERVER_VERIFIED). Then it takes the same server-
   * verified confirming flow as USDT.
   */
  async buyWithNim(pack: CreditPack): Promise<boolean> {
    if (NIM_SERVER_VERIFIED) {
      const token = await getSessionToken()
      if (token)
        return runServerPurchase('nim', pack)
    }
    return runPurchase(() => purchase('nim', pack))
  },
  /** Dismiss the confirming/terminal purchase UI back to idle. */
  resetPurchase(): void {
    stopWatch()
    creditsStore.update(s => ({ ...s, isPaying: false, flow: IDLE_FLOW }))
  },
}

export function useCredits() {
  const state = useStore(creditsStore)
  return {
    ...credits,
    balance: state.balance,
    history: state.history,
    isPaying: state.isPaying,
    error: state.error,
    flow: state.flow,
  }
}
