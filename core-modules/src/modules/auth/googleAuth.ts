import type { AuthUser } from './types'
import { getConfig } from '../config'

/**
 * Google login via Google Identity Services (GIS).
 *
 * IMPORTANT WebView caveat: Google blocks OAuth inside embedded WebViews
 * ("disallowed_useragent"). Inside Nimiq Pay this may fail depending on the
 * host WebView settings. Nimiq wallet login is our primary identity; Google
 * is a secondary option that fully works when the app is opened in a normal
 * browser. Production plan: backend redirect flow opened in the external
 * browser, deep-linking back into the mini app.
 */

declare global {
  interface Window {
    google?: any
  }
}

let gisLoaded: Promise<void> | null = null

function loadGis(): Promise<void> {
  gisLoaded ??= new Promise((resolve, reject) => {
    if (window.google?.accounts)
      return resolve()
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'))
    document.head.appendChild(script)
  })
  return gisLoaded
}

function decodeJwtPayload(jwt: string): Record<string, any> {
  const base64 = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export function isGoogleLoginAvailable(): boolean {
  return getConfig().googleClientId.length > 0
}

export async function loginWithGoogle(): Promise<AuthUser> {
  const clientId = getConfig().googleClientId
  if (!clientId)
    throw new Error('Google login is not configured (missing googleClientId)')

  await loadGis()

  const credential = await new Promise<string>((resolve, reject) => {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response: { credential?: string }) => {
        if (response.credential)
          resolve(response.credential)
        else
          reject(new Error('Google sign-in returned no credential'))
      },
    })
    window.google.accounts.id.prompt((notification: any) => {
      if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.())
        reject(new Error('Google sign-in unavailable here. If you are inside Nimiq Pay, use the Nimiq wallet login.'))
    })
  })

  // MVP: decode client-side for display. Production: send the credential
  // (ID token) to our backend and verify the signature there.
  const claims = decodeJwtPayload(credential)

  return {
    provider: 'google',
    id: claims.sub,
    label: claims.email ?? claims.name ?? 'Google user',
    email: claims.email,
  }
}
