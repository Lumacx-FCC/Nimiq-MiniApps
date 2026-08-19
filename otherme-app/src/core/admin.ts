/**
 * Client side of the admin-only credit grant endpoint
 * (functions/src/admin/routes.ts). The `admin` custom claim is the real gate —
 * this module only calls the endpoint and reads the claim to decide what to
 * render; a non-admin token still gets a 403 from the server either way.
 */
import { serverUrl } from './api'
import { getFirebaseAuth } from './firebase'

/** Pass `force: true` right after granting the claim (via
 * functions/scripts/set-admin-claim.mjs) so it's picked up without a full
 * sign-out/sign-in — the cached token otherwise won't reflect it until it
 * naturally expires. Everyday callers (e.g. the header link) can use the
 * cached token; it's already fresh for anyone who didn't just get the claim. */
export async function isAdmin(force = false): Promise<boolean> {
  const user = getFirebaseAuth().currentUser
  if (!user)
    return false
  const result = await user.getIdTokenResult(force)
  return result.claims.admin === true
}

export interface GrantCreditsResult {
  balance: number
  alreadyGranted: boolean
}

export async function grantCredits(address: string, credits: number, note: string, dedupeKey: string): Promise<GrantCreditsResult> {
  const user = getFirebaseAuth().currentUser
  if (!user)
    throw new Error('Not signed in.')
  const token = await user.getIdToken()
  const res = await fetch(serverUrl('/api/admin/grant-credits'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ address, credits, note, dedupeKey }),
  })
  const data = await res.json().catch(() => ({})) as any
  if (!res.ok)
    throw new Error(data?.error || `Request failed (${res.status})`)
  return data as GrantCreditsResult
}
