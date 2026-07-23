/**
 * Server session (Phase 1 of the credits migration).
 *
 * Establishes a verified backend session for a Nimiq wallet:
 *   getNimiq().listAccounts → POST /api/auth/challenge → wallet.sign(message)
 *   → POST /api/auth/verify → signInWithCustomToken(token)
 *
 * Nimiq Pay stays the auth authority — it performs the actual signing; the
 * server only verifies it. Reuses the shared getNimiq() handshake (same wallet
 * connection as login/payments — no second connection).
 *
 * ADDITIVE for now: login still succeeds on the existing localStorage flow even
 * if this fails (server not yet deployed / offline). Later phases make the
 * server session authoritative for the credits ledger. `getSessionToken()`
 * returns a fresh Firebase ID token to attach to /api/* calls when present.
 */
import { getNimiq } from '@core/auth/nimiqAuth'
import { signInWithCustomToken, signOut } from 'firebase/auth'
import { serverUrl } from './api'
import { getFirebaseAuth } from './firebase'

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({})) as any
  if (!res.ok)
    throw new Error(data?.error || `Request failed (${res.status})`)
  return data as T
}

/**
 * Prove ownership of the connected Nimiq address and sign in to Firebase.
 * Returns the verified address on success. Throws with a user-facing message.
 */
export async function establishServerSession(): Promise<string> {
  const nimiq = await getNimiq()

  const accounts = await nimiq.listAccounts()
  if (!Array.isArray(accounts))
    throw new Error(accounts.error?.message || 'Nimiq wallet returned an error')
  const address = accounts[0]
  if (!address)
    throw new Error('No Nimiq account available')

  // 1. One-shot challenge bound to this address.
  const { message } = await postJson<{ message: string }>(
    serverUrl('/api/auth/challenge'),
    { address },
  )

  // 2. Nimiq Pay signs it (native approval dialog).
  const signed = await nimiq.sign(message)
  if (typeof signed !== 'object' || !('signature' in signed))
    throw new Error((signed as any)?.error?.message || 'Wallet did not return a signature')

  // 3. Server verifies the signature and mints a Firebase custom token.
  const { token } = await postJson<{ token: string }>(
    serverUrl('/api/auth/verify'),
    { address, publicKey: signed.publicKey, signature: signed.signature },
  )

  // 4. Exchange for a Firebase session.
  await signInWithCustomToken(getFirebaseAuth(), token)
  return address
}

/** Current Firebase ID token (auto-refreshed), or null if no server session. */
export async function getSessionToken(): Promise<string | null> {
  const user = getFirebaseAuth().currentUser
  return user ? user.getIdToken() : null
}

/** True when a verified server session is active. */
export function hasServerSession(): boolean {
  return getFirebaseAuth().currentUser !== null
}

export async function clearServerSession(): Promise<void> {
  try {
    await signOut(getFirebaseAuth())
  }
  catch {
    // Best effort — clearing local auth state should never block logout.
  }
}
