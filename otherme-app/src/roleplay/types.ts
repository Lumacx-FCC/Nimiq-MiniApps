/** Ported from Aeternum lib/types.ts (Firebase-free for the hackathon). */
export type Locale = 'en' | 'es'

export type VoiceName = 'Zubenelgenubi' | 'Puck' | 'Achird' | 'Sulafat' | 'Zephyr' | 'Kore'

export interface AvatarOutfit {
  id: string
  label: { en: string, es: string }
  spriteUrl: string
}

export interface AvatarProfile {
  id: string
  name: string
  alias: string
  gender: 'male' | 'female' | 'custom'
  custom?: boolean
  slot?: number
  summary: { en: string, es: string }
  systemPrompt: string
  outfits: AvatarOutfit[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'avatar'
  text: string
}
