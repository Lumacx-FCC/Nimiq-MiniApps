import type { AuthUser } from './types'
import { getConfig } from '../config'

/**
 * Email + password auth.
 *
 * MVP: accounts live in localStorage with salted SHA-256 hashes so the flow
 * is fully testable offline. THIS IS NOT PRODUCTION AUTH — client storage
 * can't keep secrets. Production swaps these three functions for Firebase
 * Authentication calls (see README "Production backend"); the signatures
 * already match that shape.
 */

interface StoredAccount {
  salt: string
  hash: string
}

const accountsKey = () => `${getConfig().appId}:email-accounts`

function readAccounts(): Record<string, StoredAccount> {
  try {
    return JSON.parse(localStorage.getItem(accountsKey()) ?? '{}')
  }
  catch {
    return {}
  }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  if (crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')
  }
  // Plain-HTTP LAN testing has no crypto.subtle — dev-only FNV fallback.
  let h = 0x811C9DC5
  for (const byte of data) h = Math.imul(h ^ byte, 0x01000193) >>> 0
  return `fnv-${h.toString(16)}`
}

function toUser(email: string): AuthUser {
  return { provider: 'email', id: email.toLowerCase(), label: email, email }
}

function validate(email: string, password: string): void {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error('Please enter a valid email address.')
  if (password.length < 8)
    throw new Error('Password must be at least 8 characters.')
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  validate(email, password)
  const accounts = readAccounts()
  const key = email.toLowerCase()
  if (accounts[key])
    throw new Error('An account with this email already exists. Try logging in.')

  const salt = crypto.randomUUID?.() ?? String(Math.random()).slice(2)
  accounts[key] = { salt, hash: await hashPassword(password, salt) }
  localStorage.setItem(accountsKey(), JSON.stringify(accounts))
  return toUser(email)
}

export async function loginWithEmail(email: string, password: string): Promise<AuthUser> {
  validate(email, password)
  const account = readAccounts()[email.toLowerCase()]
  if (!account || account.hash !== await hashPassword(password, account.salt))
    throw new Error('Wrong email or password.')
  return toUser(email)
}
