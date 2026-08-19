/**
 * Account linking (Part B) — client side. Pairs with functions/src/account/.
 *
 * "Reauth" for unlinkSecondary is deliberately simple: re-run whichever login
 * the caller is currently using (loginWithNimiq/loginWithEmail/loginWithGoogle
 * from core/auth.ts) right before calling this. That refreshes Firebase's
 * `auth_time` claim, which is what the server's requireFreshUid actually
 * checks — no separate reauthenticateWithCredential/-Popup plumbing needed.
 * If a Google reauth picks a *different* account by mistake, the server-side
 * uid just won't match the expected canonical uid and the unlink cleanly
 * fails ("that account isn't linked to yours") rather than doing anything
 * unsafe.
 */
import type { AuthUser } from '@core/auth/types'
import { signInWithCustomToken } from 'firebase/auth'
import { serverUrl } from './api'
import { getFirebaseAuth } from './firebase'
import { getSessionToken } from './session'

async function authedPost<T>(path: string, body: unknown): Promise<T> {
  const token = await getSessionToken()
  if (!token)
    throw new Error('Not signed in.')
  const res = await fetch(serverUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as any
  if (!res.ok)
    throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

async function authedGet<T>(path: string): Promise<T> {
  const token = await getSessionToken()
  if (!token)
    throw new Error('Not signed in.')
  const res = await fetch(serverUrl(path), { headers: { Authorization: `Bearer ${token}` } })
  const data = await res.json().catch(() => ({})) as any
  if (!res.ok)
    throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

export interface LinkedAccount {
  uid: string
  provider: 'nimiq' | 'email' | 'google' | 'unknown'
}

export interface AccountOverview {
  balance: number
  primaryProvider: string | null
  linkedAccounts: LinkedAccount[]
}

/** Balance + linked-identity summary for the Profile page. Defensive against
 * an older-deployed backend that predates linkedAccounts/primaryProvider. */
export async function getAccountOverview(): Promise<AccountOverview> {
  const data = await authedGet<Partial<AccountOverview>>('/api/credits/balance')
  return { balance: data.balance ?? 0, primaryProvider: data.primaryProvider ?? null, linkedAccounts: data.linkedAccounts ?? [] }
}

export interface StartLinkResult {
  code: string
  expiresAt: number
}

/** Generate a pairing code on the currently signed-in (canonical) account. */
export function startLink(): Promise<StartLinkResult> {
  return authedPost<StartLinkResult>('/api/account/link/start', {})
}

export interface PreviewLinkResult {
  ticketId: string
  sourceProvider: 'nimiq' | 'email' | 'google'
  sourceBalance: number
  targetBalance: number
  mergedTotal: number
  expiresAt: number
}

/** Preview redeeming a code on the currently signed-in account. Commits nothing. */
export function previewLink(code: string): Promise<PreviewLinkResult> {
  return authedPost<PreviewLinkResult>('/api/account/link/redeem-preview', { code })
}

/** Commit a previewed link and swap this session to the (now-canonical) account. */
export async function commitLink(ticketId: string): Promise<AuthUser> {
  const { token } = await authedPost<{ token: string; uid: string }>('/api/account/link/commit', { ticketId })
  const cred = await signInWithCustomToken(getFirebaseAuth(), token)
  const user = cred.user
  // The signed-in User's profile (email, linked providers) reflects the
  // underlying account record, not just this custom-token sign-in — so this
  // still resolves to the canonical account's real identity, not a blank one.
  const isGoogle = user.providerData.some(p => p.providerId === 'google.com')
  const provider = isGoogle ? 'google' : user.email ? 'email' : 'nimiq'
  return {
    provider,
    id: user.uid,
    label: user.email ?? user.uid,
    email: user.email ?? undefined,
    nimiqAddress: provider === 'nimiq' ? user.uid : undefined,
  }
}

/** Unlink `secondaryUid` from the canonical account currently signed in.
 * Caller must have freshly re-authenticated (see module doc) first. */
export async function unlinkSecondary(secondaryUid: string): Promise<void> {
  await authedPost('/api/account/unlink', { secondaryUid })
  // A successful unlink revokes the canonical uid's own refresh tokens
  // server-side (belt-and-suspenders after removing a link) — which
  // invalidates the very (cached) ID token this request just used. Force a
  // fresh one now, or the next call (e.g. reloading the profile) spuriously
  // 401s on a token that's technically still cached but now server-revoked.
  await getFirebaseAuth().currentUser?.getIdToken(true)
}
