/**
 * One-time, client-side gate shown before a user's first photo upload
 * (Character Studio's own upload, and ReferencePicker's upload used by
 * Scenes/Videos) — not a server-enforced legal gate like the purchase
 * Terms checkpoint (credits/store.ts's termsAcceptedAt), just a disclosure
 * so the storage/retention language in /terms section 4 is seen before,
 * not after, a photo leaves the device.
 */
const KEY = 'otherme:upload-consent-accepted'

export function hasAcceptedUploadConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  }
  catch {
    return false
  }
}

export function acceptUploadConsent(): void {
  try {
    localStorage.setItem(KEY, '1')
  }
  catch { /* private browsing / quota — re-prompt next time, not fatal */ }
}
