/**
 * Talk-stage color themes (Tier 5.4) — palette CSS lives in styles/roleplay.css
 * under `.rp-root[data-rp-palette='...']`; this module only decides WHICH
 * palette applies to a given avatar and lets the user override that per
 * device via a dropdown.
 */
import type { AvatarProfile, PaletteId } from './types'
import { PALETTE_IDS } from './types'

export const PALETTE_LABELS: Record<PaletteId, { en: string, es: string }> = {
  default: { en: 'Default', es: 'Predeterminado' },
  fantasy: { en: 'Fantasy', es: 'Fantasía' },
  futuristic: { en: 'Futuristic', es: 'Futurista' },
  fun: { en: 'Fun', es: 'Divertido' },
  formal: { en: 'Formal', es: 'Formal' },
  smooth: { en: 'Smooth', es: 'Suave' },
  relaxing: { en: 'Relaxing', es: 'Relajante' },
}

/**
 * Keyword buckets for classifying a custom avatar's generated description
 * into a palette. No bucket for 'default' — it's the fallback when nothing
 * else matches (or when the score is tied at zero), per the product call:
 * "if there's no clear keyword set it up as Default Theme."
 */
const KEYWORDS: Partial<Record<PaletteId, string[]>> = {
  fantasy: [
    'elf', 'elves', 'elven', 'dragon', 'sword', 'wizard', 'sorcer', 'witch', 'knight',
    'kingdom', 'castle', 'rune', 'myth', 'legend', 'quest', 'spell', 'enchant',
    'warrior', 'realm', 'prophecy', 'ritual', 'dwarf', 'orc', 'fae', 'fairy',
    'magic', 'sorcery', 'throne', 'bard', 'druid', 'sorceress',
  ],
  futuristic: [
    'robot', 'cyborg', 'android', 'cyber', 'neon', 'hologram', 'space', 'galaxy',
    'starship', 'laser', 'mech', 'drone', 'quantum', 'nano', 'sci-fi', 'scifi',
    'future', 'circuit', 'digital', 'hacker', 'synth', 'starfleet', 'interstellar',
  ],
  fun: [
    'playful', 'silly', 'goofy', 'cartoon', 'whimsical', 'quirky', 'cheerful',
    'comic', 'prank', 'joke', 'bubbly', 'cute', 'mascot', 'clown', 'party',
    'giggle', 'wacky', 'jolly',
  ],
  formal: [
    'professional', 'executive', 'business', 'elegant', 'refined', 'corporate',
    'diplomat', 'butler', 'sophisticated', 'distinguished', 'poised', 'etiquette',
    'ambassador', 'formal',
  ],
  smooth: [
    'jazz', 'smooth', 'suave', 'charming', 'sultry', 'laid-back', 'laid back',
    'velvet', 'lounge', 'groove', 'mellow', 'crooner', 'debonair',
  ],
  relaxing: [
    'calm', 'peaceful', 'serene', 'gentle', 'cozy', 'soothing', 'tranquil',
    'meditat', 'spa', 'zen', 'quiet', 'comfort', 'wholesome', 'homely', 'restful',
  ],
}

/** Scores a free-text character description against each palette's keyword
 * bucket and returns the best match, or 'default' if nothing scores above 0. */
export function classifyPalette(text: string): PaletteId {
  const haystack = text.toLowerCase()
  let best: PaletteId = 'default'
  let bestScore = 0
  for (const id of PALETTE_IDS) {
    const words = KEYWORDS[id]
    if (!words)
      continue
    const score = words.reduce((count, word) => count + (haystack.includes(word) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      best = id
    }
  }
  return best
}

/**
 * Built-in avatars get a curated, fixed palette (Nimiquerys -> Default, since
 * he's the app's own mascot; Kaelen Thorne -> Fantasy, matching his lore).
 * Custom avatars use whatever classifyPalette() decided at creation time
 * (avatar.palette), falling back to 'default' if it's ever missing.
 */
export function defaultPaletteFor(avatar: AvatarProfile): PaletteId {
  if (avatar.custom)
    return avatar.palette ?? 'default'
  if (avatar.id === 'kaelen-female' || avatar.id === 'kaelen-male')
    return 'fantasy'
  return 'default'
}

const OVERRIDE_KEY = 'otherme:avatar-palette-overrides'

/** Per-device manual override, keyed by avatar id — covers built-ins too
 * (they have no `palette` field of their own to mutate). Local-only by
 * design: it's a display preference, not data worth cloud-syncing. */
export function readPaletteOverrides(): Record<string, PaletteId> {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || '{}')
  }
  catch {
    return {}
  }
}

export function writePaletteOverride(avatarId: string, palette: PaletteId): Record<string, PaletteId> {
  const next = { ...readPaletteOverrides(), [avatarId]: palette }
  try {
    localStorage.setItem(OVERRIDE_KEY, JSON.stringify(next))
  }
  catch { /* quota/private-browsing — override just won't survive a reload */ }
  return next
}
