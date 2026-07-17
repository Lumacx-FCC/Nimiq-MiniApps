/**
 * Custom talking avatars — localStorage for the hackathon (sprites stored as
 * data URLs). Post-hackathon migration seam: swap for Firebase Storage +
 * Firestore, same shape Aeternum's persistAvatar used.
 */
import type { AvatarProfile } from './types'

const KEY = 'otherme:avatars'

export function listAvatars(): AvatarProfile[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as AvatarProfile[]
  }
  catch {
    return []
  }
}

export function persistAvatars(avatars: AvatarProfile[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(avatars))
    return true
  }
  catch {
    // Quota exceeded — keep only the newest three avatars' sprites.
    try {
      const slim = avatars.slice(0, 3)
      localStorage.setItem(KEY, JSON.stringify(slim))
      return true
    }
    catch {
      return false
    }
  }
}
