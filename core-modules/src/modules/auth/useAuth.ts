import type { AuthUser } from './types'
import { computed, ref } from 'vue'
import { getConfig } from '../config'
import { loginWithEmail, signUpWithEmail } from './emailAuth'
import { isGoogleLoginAvailable, loginWithGoogle } from './googleAuth'
import { isInsideNimiqPay, loginWithNimiq } from './nimiqAuth'

const STORAGE_KEY = () => `${getConfig().appId}:auth-user`

const user = ref<AuthUser | null>(null)
const isBusy = ref(false)
const error = ref<string | null>(null)

// Restore lazily (not at module scope) so `configure()` has set the appId
// before we touch the storage key.
let restored = false
function ensureRestored(): void {
  if (restored)
    return
  restored = true
  user.value = readStoredUser()
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

function persist(next: AuthUser | null): void {
  if (next)
    localStorage.setItem(STORAGE_KEY(), JSON.stringify(next))
  else
    localStorage.removeItem(STORAGE_KEY())
}

async function runLogin(fn: () => Promise<AuthUser>): Promise<void> {
  isBusy.value = true
  error.value = null
  try {
    user.value = await fn()
    persist(user.value)
  }
  catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
  finally {
    isBusy.value = false
  }
}

/**
 * Shared auth state for any FCC mini app.
 * `import { useAuth } from '<core-modules>/auth'`
 */
export function useAuth() {
  ensureRestored()
  return {
    user: computed(() => user.value),
    isLoggedIn: computed(() => user.value !== null),
    isBusy: computed(() => isBusy.value),
    error: computed(() => error.value),
    canUseNimiq: isInsideNimiqPay,
    canUseGoogle: isGoogleLoginAvailable,
    loginWithNimiq: () => runLogin(loginWithNimiq),
    loginWithGoogle: () => runLogin(loginWithGoogle),
    loginWithEmail: (email: string, password: string) => runLogin(() => loginWithEmail(email, password)),
    signUpWithEmail: (email: string, password: string) => runLogin(() => signUpWithEmail(email, password)),
    logout: () => {
      user.value = null
      persist(null)
    },
  }
}
