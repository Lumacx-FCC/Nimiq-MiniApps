/**
 * Real Firebase Auth for email/Google (Part A of account linking).
 *
 * Lives here, not in core-modules: core-modules has zero Firebase dependency
 * and is shared with the framework-agnostic Vue demo app (no Firebase project
 * of its own), so `@core/auth/emailAuth` and `@core/auth/googleAuth` keep
 * their original MVP localStorage/GIS implementations unchanged for that
 * consumer. This file supersedes them for otherme-app only — `core/auth.ts`
 * imports from here instead of `@core/auth/*` for these two providers.
 *
 * Every successful sign-in also swaps the native Firebase session for the
 * canonical one via `resolveServerSession` (see `./session.ts`), which
 * guarantees a `users/{uid}` Firestore profile exists — the same
 * challenge/verify -> custom-token shape the Nimiq wallet path already uses.
 */
import type { AuthUser } from '@core/auth/types'
import type { User } from 'firebase/auth'
import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
} from 'firebase/auth'
import { GOOGLE_LOGIN_ENABLED } from './config'
import { getFirebaseAuth } from './firebase'
import { resolveServerSession } from './session'

// Nimiq Pay's embedded Android WebView (matches the detection already used for
// the Web Share fallback in character/library.ts) blocks Google's OAuth popup
// ("disallowed_useragent") — force the redirect flow there instead.
const IS_WEBVIEW = /\bwv\b/.test(navigator.userAgent)

function toAuthUser(user: User, provider: 'email' | 'google'): AuthUser {
  return {
    provider,
    id: user.uid,
    label: user.email ?? user.displayName ?? user.uid,
    email: user.email ?? undefined,
  }
}

async function finishLogin(user: User, provider: 'email' | 'google'): Promise<AuthUser> {
  try {
    await resolveServerSession(user)
  }
  catch (e) {
    // Non-blocking, same philosophy as the wallet's establishServerSession:
    // the native Firebase sign-in already succeeded and is itself a real,
    // verifiable session — a failed canonical-session swap shouldn't undo it.
    console.warn('[auth] server session resolve failed:', e instanceof Error ? e.message : e)
    return toAuthUser(user, provider)
  }
  // resolveServerSession may have swapped onto a different (canonical) uid if
  // this account was linked into another — read the ACTUAL post-swap session
  // instead of the native `user` captured before the swap, so the credits
  // balance (keyed off the session uid) and any UID shown to the user (e.g.
  // Profile) refer to the account the server actually granted. Same
  // provider-derivation shape as accountLink.ts's commitLink().
  const canonical = getFirebaseAuth().currentUser
  if (!canonical)
    return toAuthUser(user, provider)
  const isGoogle = canonical.providerData.some(p => p.providerId === 'google.com')
  const canonicalProvider = isGoogle ? 'google' : canonical.email ? 'email' : 'nimiq'
  return {
    provider: canonicalProvider,
    id: canonical.uid,
    label: canonical.email ?? canonical.uid,
    email: canonical.email ?? undefined,
    nimiqAddress: canonicalProvider === 'nimiq' ? canonical.uid : undefined,
  }
}

export async function signUpWithEmail(email: string, password: string): Promise<AuthUser> {
  const cred = await createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
  sendEmailVerification(cred.user).catch((e) => {
    console.warn('[auth] verification email failed to send:', e instanceof Error ? e.message : e)
  })
  return finishLogin(cred.user, 'email')
}

export async function loginWithEmail(email: string, password: string): Promise<AuthUser> {
  const cred = await signInWithEmailAndPassword(getFirebaseAuth(), email, password)
  return finishLogin(cred.user, 'email')
}

export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(getFirebaseAuth(), email)
}

/** Re-send the verification link to the currently signed-in email account. */
export async function resendVerificationEmail(): Promise<void> {
  const user = getFirebaseAuth().currentUser
  if (!user)
    throw new Error('Not signed in.')
  await sendEmailVerification(user)
}

/** Live `emailVerified` for the current session, refreshed from Firebase first
 * (the cached token can be stale if verification happened in another tab/
 * after the last sign-in). Null if there's no signed-in user at all. */
export async function checkEmailVerified(): Promise<boolean | null> {
  const auth = getFirebaseAuth()
  if (!auth.currentUser)
    return null
  await auth.currentUser.reload()
  return auth.currentUser.emailVerified
}

export function isGoogleLoginAvailable(): boolean {
  return GOOGLE_LOGIN_ENABLED
}

export async function loginWithGoogle(): Promise<AuthUser> {
  const auth = getFirebaseAuth()
  const provider = new GoogleAuthProvider()

  if (IS_WEBVIEW) {
    await signInWithRedirect(auth, provider)
    // The page navigates away for the redirect round-trip; completeGoogleRedirect()
    // picks the result back up on the next load. Never resolves here.
    return new Promise<AuthUser>(() => {})
  }

  try {
    const cred = await signInWithPopup(auth, provider)
    return await finishLogin(cred.user, 'google')
  }
  catch (e: any) {
    if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider)
      return new Promise<AuthUser>(() => {})
    }
    throw e
  }
}

/**
 * Call once on app boot to pick up a Google sign-in that redirected away and
 * came back (WebView / popup-blocked fallback). Returns null when there was
 * no pending redirect.
 */
export async function completeGoogleRedirect(): Promise<AuthUser | null> {
  const result = await getRedirectResult(getFirebaseAuth())
  if (!result)
    return null
  return finishLogin(result.user, 'google')
}
