/**
 * React bridge over core-modules auth. Same behavior and storage keys as the
 * Vue `useAuth` composable — provider logic is imported, not reimplemented.
 */
import type { AuthUser } from '@core/auth/types'
import { isInsideNimiqPay, loginWithNimiq } from '@core/auth/nimiqAuth'
import { getConfig } from '@core/config'
import { completeGoogleRedirect, isGoogleLoginAvailable, loginWithEmail, loginWithGoogle, requestPasswordReset, signUpWithEmail } from './authProviders'
import { createStore, useStore } from './store'
import { loadCreditsFor } from './credits'
import { clearServerSession, establishServerSession } from './session'

export type { AuthUser }

const STORAGE_KEY = () => `${getConfig().appId}:auth-user`

interface AuthState {
  user: AuthUser | null
  isBusy: boolean
  error: string | null
}

function readStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY())
    return raw ? JSON.parse(raw) as AuthUser : null
  }
  catch {
    return null
  }
}

const authStore = createStore<AuthState>({ user: readStoredUser(), isBusy: false, error: null })

// Keep credits in sync with the restored session.
if (authStore.get().user)
  loadCreditsFor(authStore.get().user!.id)

// Pick up a Google sign-in that redirected away and came back (WebView /
// popup-blocked fallback in loginWithGoogle). No-op when there was no pending
// redirect. Runs once per page load, before any component reads the store.
completeGoogleRedirect().then((user) => {
  if (!user)
    return
  persist(user)
  loadCreditsFor(user.id)
  authStore.set({ user, isBusy: false, error: null })
}).catch((e) => {
  console.warn('[auth] google redirect completion failed:', e instanceof Error ? e.message : e)
})

function persist(next: AuthUser | null): void {
  if (next)
    localStorage.setItem(STORAGE_KEY(), JSON.stringify(next))
  else
    localStorage.removeItem(STORAGE_KEY())
}

async function runLogin(fn: () => Promise<AuthUser>): Promise<boolean> {
  authStore.update(s => ({ ...s, isBusy: true, error: null }))
  try {
    const user = await fn()
    persist(user)
    loadCreditsFor(user.id)
    authStore.set({ user, isBusy: false, error: null })
    return true
  }
  catch (e) {
    authStore.update(s => ({ ...s, isBusy: false, error: e instanceof Error ? e.message : String(e) }))
    return false
  }
}

export const auth = {
  get user() { return authStore.get().user },
  get isLoggedIn() { return authStore.get().user !== null },
  canUseNimiq: isInsideNimiqPay,
  canUseGoogle: isGoogleLoginAvailable,
  loginWithNimiq: async () => {
    const ok = await runLogin(loginWithNimiq)
    // Additive: prove wallet ownership to the backend for a verified session.
    // Non-blocking — local login already succeeded; a failed/declined proof
    // (or an undeployed server) must not undo it. Server becomes authoritative
    // for the credits ledger in a later phase.
    if (ok) {
      establishServerSession().catch((e) => {
        console.warn('[session] server session not established:', e instanceof Error ? e.message : e)
      })
    }
    return ok
  },
  loginWithGoogle: () => runLogin(loginWithGoogle),
  loginWithEmail: (email: string, password: string) => runLogin(() => loginWithEmail(email, password)),
  signUpWithEmail: (email: string, password: string) => runLogin(() => signUpWithEmail(email, password)),
  requestPasswordReset,
  /** Apply any AuthUser-producing action (e.g. accountLink.commitLink) through
   * the same persist + credits-reload + store-update path as a normal login. */
  syncSession: (fn: () => Promise<AuthUser>) => runLogin(fn),
  logout: () => {
    persist(null)
    authStore.set({ user: null, isBusy: false, error: null })
    void clearServerSession()
  },
}

export function useAuth() {
  const state = useStore(authStore)
  return {
    ...auth,
    user: state.user,
    isLoggedIn: state.user !== null,
    isBusy: state.isBusy,
    error: state.error,
  }
}
