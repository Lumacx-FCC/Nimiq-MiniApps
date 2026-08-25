/** Ported from Aeternum lib/types.ts (Firebase-free for the hackathon). */
export type Locale = 'en' | 'es'

export type VoiceName = 'Zubenelgenubi' | 'Puck' | 'Achird' | 'Sulafat' | 'Zephyr' | 'Kore'

/** Talk-stage color themes (Tier 5.4). See roleplay/palettes.ts for the
 * per-avatar default logic, the custom-avatar keyword classifier, and the
 * per-device manual-override store. */
export const PALETTE_IDS = ['default', 'fantasy', 'futuristic', 'fun', 'formal', 'smooth', 'relaxing'] as const
export type PaletteId = typeof PALETTE_IDS[number]

export interface AvatarOutfit {
  id: string
  label: { en: string, es: string }
  spriteUrl: string
}

export interface AvatarProfile {
  id: string
  name: string
  alias: string
  gender: 'male' | 'female' | 'object' | 'custom'
  custom?: boolean
  slot?: number
  /** Classified once at creation time from the generated description (custom
   * avatars only, see roleplay/palettes.ts's classifyPalette). Built-in
   * avatars are unset — their default comes from defaultPaletteFor(). */
  palette?: PaletteId
  summary: { en: string, es: string }
  systemPrompt: string
  outfits: AvatarOutfit[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'avatar'
  text: string
}
