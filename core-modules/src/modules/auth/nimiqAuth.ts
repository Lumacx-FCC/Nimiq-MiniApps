import type { AuthUser } from './types'
import { init } from '@nimiq/mini-app-sdk'

type NimiqApi = Awaited<ReturnType<typeof init>>

let nimiqPromise: Promise<NimiqApi> | null = null

/**
 * Lazily initialize the Nimiq provider. Reused by the credits module so
 * the SDK handshake only happens once per session.
 */
export function getNimiq(): Promise<NimiqApi> {
  nimiqPromise ??= init({ timeout: 10_000 })
  return nimiqPromise
}

/** True when running inside Nimiq Pay (provider injected). */
export function isInsideNimiqPay(): boolean {
  return typeof window !== 'undefined' && 'nimiqPay' in window
}

/**
 * Log in with the Nimiq wallet. Opens the native account-selection dialog.
 * The wallet address is the user identity — no password, no email.
 *
 * MVP note: for a real backend session, follow up with `sign()` on a
 * server-issued challenge to prove address ownership. Client-side only here.
 */
export async function loginWithNimiq(): Promise<AuthUser> {
  const nimiq = await getNimiq()
  const accounts = await nimiq.listAccounts()
  if (!Array.isArray(accounts))
    throw new Error(accounts.error?.message || 'Nimiq wallet returned an error')
  const address = accounts[0]
  if (!address)
    throw new Error('No Nimiq account available')

  return {
    provider: 'nimiq',
    id: address,
    label: `${address.slice(0, 9)}…${address.slice(-4)}`,
    nimiqAddress: address,
  }
}
