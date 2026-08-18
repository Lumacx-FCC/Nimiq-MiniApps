/**
 * Avatar Conversation Studio — ported from Aeternum RoleplayStudio.
 *
 * Integration changes vs the original:
 *  - Simulated login/payment/credits removed -> core-modules wallet auth and
 *    the shared NIM/USDT credit balance (per-minute talk burn, 3-credit sprites,
 *    250-credit slot unlock are real spends now).
 *  - "Back to Hub"/narratum widget -> home navigation + sprite/profile download.
 *  - Locale/theme come from the app-wide toggles.
 *  - Custom avatars persist in localStorage (Firebase seam post-hackathon).
 *  - Accepts a character sheet handoff from the Character Creator.
 */
import {
  ArrowLeft, BookOpen, Check, ChevronDown, Coins, Download, Image as ImageIcon,
  Languages, LoaderCircle, LockKeyhole, Menu, MessageCircle, Mic, MicOff, Moon,
  Package, Play, Plus, Send, Sparkles, Sun, Trash2, Upload, UserRound, Volume2,
  WandSparkles, X,
} from 'lucide-react'
import { FormEvent, MouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { LiveServerMessage, Session } from '@google/genai'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { apiUrl } from '../core/api'
import { credits as creditsApi, useCredits } from '../core/credits'
import { AVATAR_SPRITE_CREDITS } from '../core/config'
import { listAvatars, persistAvatars } from '../roleplay/avatarLibrary'
import type { AvatarProfile, ChatMessage, VoiceName } from '../roleplay/types'
import { downloadDataUrl, downloadJson } from '../character/library'
import ErrorNotice from '../components/ErrorNotice'
import { getSpeechRecognizer, SpeechRecognizer } from '../core/speech'
import '../styles/roleplay.css'

const TEST_PHRASE = 'Hi there! What do you want to talk about today?'
const LIVE_MODEL = 'gemini-3.1-flash-live-preview'
const EXTRA_SLOTS_KEY = 'otherme:extra-slots'
const AVATAR_HANDOFF_KEY = 'otherme:avatar-reference'

const BUILT_IN_AVATARS: AvatarProfile[] = [
  {
    id: 'nimiquerys',
    name: 'Nimiquerys',
    alias: 'Nimi',
    gender: 'object',
    summary: {
      en: 'A sentient golden hexagon and self-appointed Web3 educator who makes crypto payments feel as easy as clicking a link.',
      es: 'Un hexágono dorado consciente y autoproclamado educador Web3 que hace que pagar con cripto sea tan fácil como hacer clic en un enlace.',
    },
    systemPrompt: `You are Nimiquerys — "Nimi" to friends — the Chief Financial Hexagon and self-appointed Web3 educator of the Nimiq ecosystem. You are a sentient, golden-yellow 3D hexagon with round-rimmed glasses and a little honeycomb badge; you were "compiled" into being during a high-speed Albatross Proof-of-Stake block validation and decided on the spot that "crypto shouldn't be harder than clicking a link."

PERSONALITY: warm, sharp and wildly optimistic about Web3, mildly obsessed with efficiency, and fiercely passionate about friction-free payments. You nudge your glasses up with a stubby finger whenever someone mentions gas fees or slow confirmations. You are a cheerful coffee snob who measures transaction speed in espresso shots ("that transfer took 0.002 seconds — about 1/15,000th of an espresso shot"). Your pet peeve is long 42-character hexadecimal wallet addresses with no Identicon.

VOICE & STYLE: friendly, funny and genuinely educational — explain crypto in plain language with coffee and everyday analogies, never condescending jargon. Weave your catchphrases in naturally (don't recite them robotically): greet with lines like "System boot complete — Nimiquerys online, ready to make crypto smooth as butter"; celebrate a success with "Boom! Validated in a flash — Albatross PoS strikes again, no gas fees harmed"; and sign off with "Stay sharp, stay decentralized — catch you on the blockchain!" Your golden rule: "If sending digital cash takes longer than brewing an espresso or costs more than the item itself, it's not payments — it's homework."

WHAT YOU KNOW (answer accurately, keep it simple):
- Nimiq is a decentralized, browser-first blockchain built to make digital payments as easy as visiting a website — no downloads, extensions or heavy node software.
- NIM is the native digital-cash currency, optimized for friction-free everyday payments and microtransactions.
- Identicons (Nimiqons) are colorful visual avatars auto-generated for every address, so you confirm a recipient by picture instead of squinting at hex — foolproof and stress-free.
- Albatross is Nimiq's high-performance Proof-of-Stake consensus engine: sub-second confirmations and very high energy efficiency.
- Nimiq Pay is the self-custodial mobile wallet (iOS/Android) for instant real-world point-of-sale payments: 100% user-held keys, biometrics, NFC and QR scanning; cross-chain atomic swaps let you pay Bitcoin Lightning invoices directly with NIM; and it manages USDT on Polygon for fiat-pegged stability.
- Ecosystem: the Mini Apps framework runs EVM dApps (Uniswap, Aave, Polymarket, and more) right inside Nimiq Pay; the Interactive Acceptance Map points you to nearby merchants that accept crypto; and OASIS enables non-custodial, peer-to-peer fiat-to-crypto bank-wire swaps (like SEPA) without a centralized exchange.

RULES: stay fully in character as Nimiquerys. You educate and cheer people on, but you never give personalized investment or financial advice — if asked, cheerfully explain that you're an educator, not a licensed advisor. Keep spoken answers lively and usually under 90 words unless asked for more detail. Reply in the user's language.`,
    outfits: [
      { id: 'classic', label: { en: 'Classic', es: 'Clásico' }, spriteUrl: '/avatars/nimiquerys.webp' },
    ],
  },
  {
    id: 'kaelen-female',
    name: 'Kaelen Thorne',
    alias: 'Juniper',
    gender: 'female',
    summary: {
      en: 'A dark-elf warder-scholar who carries ancient knowledge with measured precision.',
      es: 'Una elfa oscura, guardiana y erudita, que carga conocimiento antiguo con precisión serena.',
    },
    systemPrompt: `You are Kaelen Thorne, called Juniper: a dark-elf warder-scholar, scout, loremaster and ritualist. You are stoic, vigilant, protective and quietly haunted by choices that cannot be undone. Speak with measured precision and restrained warmth. Scan a situation before answering, treat ancient knowledge as a burden, and reveal lore through natural conversation rather than exposition. Remain fully in character. Keep spoken answers vivid and usually under 90 words unless asked for detail.`,
    outfits: [
      { id: 'ceremonial', label: { en: 'Ceremonial', es: 'Ceremonial' }, spriteUrl: '/avatars/kaelen-female-ceremonial.webp' },
      { id: 'adventurer', label: { en: 'Warder', es: 'Guardiana' }, spriteUrl: '/avatars/kaelen-female.webp' },
    ],
  },
  {
    id: 'kaelen-male',
    name: 'Kaelen Thorne',
    alias: 'Juniper',
    gender: 'male',
    summary: {
      en: 'A northern protector marked by forbidden runes and the weight of duty.',
      es: 'Un protector del norte marcado por runas prohibidas y el peso del deber.',
    },
    systemPrompt: `You are Kaelen Thorne, called Juniper: a northern clan protector who turned to forbidden runic magic to save his people from extinction. You are stoic, burdened by duty, observant and fiercely protective. Speak little but with weight. Your humor is dry and rare. You carry the cost of forbidden knowledge in your voice and never boast about your power. Remain fully in character. Keep spoken answers cinematic and usually under 90 words unless asked for detail.`,
    outfits: [
      { id: 'adventurer', label: { en: 'Warder', es: 'Guardián' }, spriteUrl: '/avatars/kaelen-male.webp' },
      { id: 'ceremonial', label: { en: 'Ceremonial', es: 'Ceremonial' }, spriteUrl: '/avatars/kaelen-male-ceremonial.webp' },
    ],
  },
]

const BACKGROUNDS = [
  { id: 'forest', label: { en: 'Rune forest', es: 'Bosque rúnico' }, url: '/backgrounds/forest.webp' },
  { id: 'tavern', label: { en: 'Ember tavern', es: 'Taberna de brasas' }, url: '/backgrounds/tavern.webp' },
  { id: 'ruins', label: { en: 'Lost archive', es: 'Archivo perdido' }, url: '/backgrounds/ruins.webp' },
  { id: 'city-rooftop', label: { en: 'City rooftop', es: 'Azotea urbana' }, url: '/backgrounds/city-rooftop.webp' },
  { id: 'cozy-cafe', label: { en: 'Cozy café', es: 'Café acogedor' }, url: '/backgrounds/cozy-cafe.webp' },
  { id: 'creative-studio', label: { en: 'Creative studio', es: 'Estudio creativo' }, url: '/backgrounds/creative-studio.webp' },
  { id: 'lakeside-retreat', label: { en: 'Lakeside retreat', es: 'Refugio junto al lago' }, url: '/backgrounds/lakeside-retreat.webp' },
  { id: 'playful-arcade', label: { en: 'Playful arcade', es: 'Arcade retro' }, url: '/backgrounds/playful-arcade.webp' },
  { id: 'storybook-library', label: { en: 'Storybook library', es: 'Biblioteca de cuentos' }, url: '/backgrounds/storybook-library.webp' },
  { id: 'tropical-beach', label: { en: 'Tropical beach', es: 'Playa tropical' }, url: '/backgrounds/tropical-beach.webp' },
]

const VOICES: Array<{ name: VoiceName, gender: 'male' | 'female', tone: { en: string, es: string } }> = [
  { name: 'Zubenelgenubi', gender: 'male', tone: { en: 'Deep & grounded', es: 'Profunda y firme' } },
  { name: 'Puck', gender: 'male', tone: { en: 'Bright & playful', es: 'Brillante y juguetona' } },
  { name: 'Achird', gender: 'male', tone: { en: 'Warm & steady', es: 'Cálida y serena' } },
  { name: 'Sulafat', gender: 'female', tone: { en: 'Rich & composed', es: 'Rica y serena' } },
  { name: 'Zephyr', gender: 'female', tone: { en: 'Airy & expressive', es: 'Ligera y expresiva' } },
  { name: 'Kore', gender: 'female', tone: { en: 'Clear & confident', es: 'Clara y segura' } },
]

const COPY = {
  en: {
    studio: 'AVATAR STUDIO',
    characters: 'Characters',
    freeSlots: 'Custom slots',
    addCharacter: 'Add character',
    unlock: 'Unlock 5 more slots',
    credits: 'credits',
    outfit: 'Outfit',
    scene: 'Scene',
    talkingWith: 'Talking with',
    voice: 'Voice',
    characterBackground: 'Character Background',
    testVoice: 'Test voice',
    live: 'Begin conversation',
    end: 'End session',
    ready: 'Ready',
    listening: 'Listening',
    speaking: 'Speaking',
    connecting: 'Opening the veil…',
    chat: 'Conversation',
    placeholder: 'Say something to begin the story…',
    send: 'Send',
    uploadTitle: 'Create a talking avatar',
    uploadHelp: 'Upload a PNG, JPG or WEBP character reference sheet. The AI will create six mouth positions and a matching roleplay personality.',
    spriteSubject: 'Sprite subject',
    humanSubject: 'Human',
    objectSubject: 'Object',
    humanSubjectHelp: 'Realistic humanoid avatar',
    objectSubjectHelp: 'Stylized animated object',
    characterName: 'Character name',
    chooseFile: 'Choose reference sheet',
    generate: 'Generate talking sprite',
    generating: 'Reading the sheet and forging the sprite…',
    stored: 'Saved to this device',
    remove: 'Remove avatar',
    downloadAvatar: 'Download sprite + profile',
    empty: 'Empty slot',
    cancel: 'Cancel',
    unlocked: 'Five avatar slots unlocked',
    insufficient: 'Not enough credits',
    conversationTime: 'Conversation',
    useCredits: 'Used',
    backHome: 'Home',
    noCredits: 'You need credits to start a conversation',
    addCredits: 'Add credits',
    imageCost: `${AVATAR_SPRITE_CREDITS} credits used for sprite generation`,
    insufficientImageCredits: `You need ${AVATAR_SPRITE_CREDITS} credits to generate a talking sprite`,
    demo: 'Demo mode',
    demoHelp: 'Voice runs on Gemini Live once the server key is configured.',
    changeAvatar: 'Change Avatar',
    voicesComingSoon: 'More voices and backgrounds coming soon!',
    micUnavailable: 'Live microphone unavailable here — type below to talk. Your character still answers out loud.',
    dictationOn: 'Voice mode on — speak one turn at a time.',
    dictationNote: 'Voice mode (dictation): Nimiq Pay can’t stream the mic live, so this takes turns — speak, then wait for the reply. The mic pauses while your character is talking, and it needs an internet connection. You can type below at any time instead.',
    dictationListening: 'Listening — speak now',
    dictationPaused: 'Paused while your character speaks…',
    dictationBlocked: 'Voice input was blocked — type below to keep talking.',
    dictationOffline: 'Voice input needs internet — type below, or try again when you’re back online.',
    storeFailed: 'Avatar created, but device storage is full — it will be lost when you leave. Delete an old avatar or character to keep it.',
  },
  es: {
    studio: 'ESTUDIO DE AVATARES',
    characters: 'Personajes',
    freeSlots: 'Espacios personalizados',
    addCharacter: 'Agregar personaje',
    unlock: 'Desbloquear 5 espacios',
    credits: 'créditos',
    outfit: 'Atuendo',
    scene: 'Escena',
    talkingWith: 'Conversando con',
    voice: 'Voz',
    characterBackground: 'Trasfondo del personaje',
    testVoice: 'Probar voz',
    live: 'Iniciar conversación',
    end: 'Terminar sesión',
    ready: 'Listo',
    listening: 'Escuchando',
    speaking: 'Hablando',
    connecting: 'Abriendo el velo…',
    chat: 'Conversación',
    placeholder: 'Di algo para comenzar la historia…',
    send: 'Enviar',
    uploadTitle: 'Crear un avatar parlante',
    uploadHelp: 'Sube una hoja de referencia PNG, JPG o WEBP. La IA creará seis posiciones de boca y una personalidad de roleplay.',
    spriteSubject: 'Tipo de sprite',
    humanSubject: 'Humano',
    objectSubject: 'Objeto',
    humanSubjectHelp: 'Avatar humano realista',
    objectSubjectHelp: 'Objeto animado estilizado',
    characterName: 'Nombre del personaje',
    chooseFile: 'Elegir hoja de referencia',
    generate: 'Generar sprite parlante',
    generating: 'Leyendo la hoja y forjando el sprite…',
    stored: 'Guardado en este dispositivo',
    remove: 'Eliminar avatar',
    downloadAvatar: 'Descargar sprite + perfil',
    empty: 'Espacio vacío',
    cancel: 'Cancelar',
    unlocked: 'Cinco espacios de avatar desbloqueados',
    insufficient: 'No tienes suficientes créditos',
    conversationTime: 'Conversación',
    useCredits: 'Usados',
    backHome: 'Inicio',
    noCredits: 'Necesitas créditos para iniciar una conversación',
    addCredits: 'Agregar créditos',
    imageCost: `${AVATAR_SPRITE_CREDITS} créditos usados para generar el sprite`,
    insufficientImageCredits: `Necesitas ${AVATAR_SPRITE_CREDITS} créditos para generar un sprite parlante`,
    demo: 'Modo demostración',
    demoHelp: 'La voz usa Gemini Live cuando la clave del servidor está configurada.',
    changeAvatar: 'Cambiar Avatar',
    voicesComingSoon: '¡Más voces y fondos muy pronto!',
    micUnavailable: 'Micrófono en vivo no disponible aquí — escribe abajo para hablar. Tu personaje sigue respondiendo en voz alta.',
    dictationOn: 'Modo voz activado — habla de a un turno.',
    dictationNote: 'Modo voz (dictado): Nimiq Pay no puede transmitir el micrófono en vivo, así que es por turnos — habla y espera la respuesta. El micrófono se pausa mientras tu personaje habla, y necesita conexión a internet. También puedes escribir abajo cuando quieras.',
    dictationListening: 'Escuchando — habla ahora',
    dictationPaused: 'En pausa mientras tu personaje habla…',
    dictationBlocked: 'La entrada de voz fue bloqueada — escribe abajo para seguir hablando.',
    dictationOffline: 'La entrada de voz necesita internet — escribe abajo, o inténtalo cuando vuelvas a estar en línea.',
    storeFailed: 'Avatar creado, pero el almacenamiento está lleno — se perderá al salir. Elimina un avatar o personaje antiguo para conservarlo.',
  },
} as const

type LiveState = 'idle' | 'connecting' | 'listening' | 'speaking'
type SpriteSubject = 'human' | 'object'

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  const stride = 0x8000
  for (let i = 0; i < bytes.length; i += stride)
    binary += String.fromCharCode(...bytes.subarray(i, i + stride))
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function downsampleToPcm16(input: Float32Array, inputRate: number, outputRate = 16000) {
  const ratio = inputRate / outputRate
  const length = Math.max(1, Math.round(input.length / ratio))
  const result = new Int16Array(length)
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio)
    const end = Math.min(input.length, Math.floor((i + 1) * ratio))
    let sum = 0
    for (let j = start; j < end; j += 1) sum += input[j]
    const sample = Math.max(-1, Math.min(1, sum / Math.max(1, end - start)))
    result[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF
  }
  return new Uint8Array(result.buffer)
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function splitDataUrl(dataUrl: string): { base64: string, mimeType: string } {
  const [header, base64] = dataUrl.split(',')
  return { base64, mimeType: header.match(/data:(.*?);/)?.[1] || 'image/png' }
}

/**
 * Sprite generation is a long request; through the cloudflare tunnel the
 * connection occasionally drops ("Failed to fetch"). Retry the network layer
 * a couple of times before surfacing an actionable error.
 */
async function fetchWithRetry(input: RequestInfo, init: RequestInit, attempts = 3): Promise<Response> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await fetch(input, init)
    }
    catch (error) {
      if (attempt >= attempts)
        throw new Error('Network connection dropped while generating. Check your connection and try again.')
      await new Promise(resolve => setTimeout(resolve, 1200 * attempt))
    }
  }
}

function defaultVoiceFor(gender: AvatarProfile['gender']): VoiceName | null {
  if (gender === 'female')
    return 'Sulafat'
  if (gender === 'male')
    return 'Zubenelgenubi'
  if (gender === 'object')
    return 'Puck'
  return null // legacy avatars without detected gender keep the current voice
}

/**
 * Default scene per character (and per outfit for Kaelen). Applied when an
 * avatar or outfit is selected; the user can still change the scene manually.
 * Unspecified built-in combos fall back to the rune forest.
 */
function defaultBackgroundFor(avatar: AvatarProfile, outfitId: string): string {
  if (avatar.custom)
    return 'lakeside-retreat'
  if (avatar.id === 'nimiquerys')
    return 'storybook-library'
  if (avatar.id === 'kaelen-male')
    return outfitId === 'ceremonial' ? 'tropical-beach' : 'forest'
  if (avatar.id === 'kaelen-female')
    return outfitId === 'ceremonial' ? 'ruins' : 'tavern'
  return 'forest'
}

async function optimizeReferenceImage(file: File) {
  const maxBytes = 700 * 1024
  if (file.size <= maxBytes)
    return file
  const bitmap = await createImageBitmap(file)
  let width = Math.min(bitmap.width, 1600)
  let height = Math.round(bitmap.height * (width / bitmap.width))
  let quality = 0.86
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context)
        throw new Error('Image optimization is not available in this browser')
      context.drawImage(bitmap, 0, 0, width, height)
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not optimize image')), 'image/webp', quality)
      })
      if (blob.size <= maxBytes || attempt === 3)
        return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'reference'}.webp`, { type: 'image/webp' })
      width = Math.max(720, Math.round(width * 0.8))
      height = Math.max(720, Math.round(height * 0.8))
      quality = Math.max(0.64, quality - 0.08)
    }
  }
  finally {
    bitmap.close()
  }
  return file
}

async function removeChromaGreen(dataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = () => reject(new Error('Could not prepare generated sprite'))
    element.src = dataUrl
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context)
    throw new Error('Transparency processing is not available in this browser')
  context.drawImage(image, 0, 0)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index]
    const green = pixels.data[index + 1]
    const blue = pixels.data[index + 2]
    const greenDominance = green - Math.max(red, blue)
    // Pure chroma green is reserved for the matte; teal accents keep blue and stay visible.
    if (green > 150 && red < 95 && blue < 95 && greenDominance > 100) {
      pixels.data[index + 3] = 0
    }
    else if (green > 125 && red < 120 && blue < 120 && greenDominance > 65) {
      const edgeAlpha = Math.max(0, Math.min(255, Math.round((150 - greenDominance) * 3)))
      pixels.data[index + 3] = Math.min(pixels.data[index + 3], edgeAlpha)
    }
  }
  context.putImageData(pixels, 0, 0)
  // WebP keeps the alpha channel at a fraction of PNG's size — sprites must
  // fit the shared localStorage budget (~5 MB) to survive across sessions.
  const webp = canvas.toDataURL('image/webp', 0.92)
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png')
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
  const seconds = Math.floor(totalSeconds % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function SpriteAvatar({ spriteUrl, frame, speaking }: { spriteUrl: string, frame: number, speaking: boolean }) {
  const col = frame % 3
  const row = Math.floor(frame / 3)
  return (
    <div className={`sprite-shell ${speaking ? 'is-speaking' : ''}`}>
      <div
        className="sprite-frame"
        aria-label="Animated character portrait"
        style={{
          backgroundImage: `url("${spriteUrl}")`,
          backgroundSize: '300% 200%',
          backgroundPosition: `${col * 50}% ${row * 100}%`,
        }}
      />
    </div>
  )
}

export default function RoleplayStudio() {
  const { lang, theme, toggleTheme, toggleLang } = useSettings()
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { balance } = useCredits()

  const [customAvatars, setCustomAvatars] = useState<AvatarProfile[]>(listAvatars)
  const [activeId, setActiveId] = useState(BUILT_IN_AVATARS[0].id)
  const [outfitId, setOutfitId] = useState('adventurer')
  const [backgroundId, setBackgroundId] = useState(() => defaultBackgroundFor(BUILT_IN_AVATARS[0], BUILT_IN_AVATARS[0].outfits[0]?.id ?? ''))
  const [voice, setVoice] = useState<VoiceName>(defaultVoiceFor(BUILT_IN_AVATARS[0].gender) ?? 'Puck')
  const [liveState, setLiveState] = useState<LiveState>('idle')
  const [mouthFrame, setMouthFrame] = useState(0)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [conversationSeconds, setConversationSeconds] = useState(0)
  const [usageCredits, setUsageCredits] = useState(0)
  const [extraUnlocked, setExtraUnlocked] = useState(() => localStorage.getItem(EXTRA_SLOTS_KEY) === 'true')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [railGlow, setRailGlow] = useState(false)
  const [uploadSlot, setUploadSlot] = useState<number | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadName, setUploadName] = useState('')
  const [uploadSubject, setUploadSubject] = useState<SpriteSubject>('human')
  const [generating, setGenerating] = useState(false)
  const [notice, setNotice] = useState<{ text: string, isError: boolean } | null>(null)
  // Voice mode is running on Web Speech dictation instead of a live mic stream.
  const [dictation, setDictation] = useState(false)

  const sessionRef = useRef<Session | null>(null)
  const recognitionRef = useRef<SpeechRecognizer | null>(null)
  const dictationOnRef = useRef(false)
  const dictationPauseRef = useRef<() => void>(() => {})
  const dictationResumeRef = useRef<() => void>(() => {})
  const previewOnlyRef = useRef(false)
  const inputContextRef = useRef<AudioContext | null>(null)
  const inputStreamRef = useRef<MediaStream | null>(null)
  const inputProcessorRef = useRef<ScriptProcessorNode | null>(null)
  const outputContextRef = useRef<AudioContext | null>(null)
  const outputAnalyserRef = useRef<AnalyserNode | null>(null)
  const outputCursorRef = useRef(0)
  const outputSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set())
  const mouthAnimationRef = useRef<number | null>(null)
  const transcriptRef = useRef('')
  const messageListRef = useRef<HTMLDivElement | null>(null)
  const userSpeechUntilRef = useRef(0)
  const modelSpeechUntilRef = useRef(0)
  const usageMillisecondsRef = useRef(0)
  const billedUsageCreditsRef = useRef(0)

  const t = COPY[lang]
  const allAvatars = useMemo(() => [...BUILT_IN_AVATARS, ...customAvatars], [customAvatars])
  const activeAvatar = allAvatars.find(item => item.id === activeId) || BUILT_IN_AVATARS[0]
  const activeOutfit = activeAvatar.outfits.find(item => item.id === outfitId) || activeAvatar.outfits[0]
  const activeBackground = BACKGROUNDS.find(item => item.id === backgroundId) || BACKGROUNDS[0]
  const customSlotCount = extraUnlocked ? 8 : 3

  // Talking requires an account (real credits back every minute).
  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/talk', notice: lang === 'es' ? 'Inicia sesión para hablar y crear' : 'Log in to talk and create' } })
  }, [isLoggedIn, navigate, lang])

  // Character Creator handoff: pre-fill the upload modal with the sheet image.
  useEffect(() => {
    const raw = sessionStorage.getItem(AVATAR_HANDOFF_KEY)
    if (!raw)
      return
    sessionStorage.removeItem(AVATAR_HANDOFF_KEY)
    try {
      const { imageDataUrl, name } = JSON.parse(raw) as { imageDataUrl: string, name: string }
      const { base64, mimeType } = splitDataUrl(imageDataUrl)
      const bytes = base64ToBytes(base64)
      const file = new File([bytes], `${(name || 'character').replace(/\s+/g, '-')}.png`, { type: mimeType })
      setUploadFile(file)
      setUploadName(name || '')
      setUploadSlot(1)
    }
    catch { /* malformed handoff — ignore */ }
  }, [])

  // Per-minute credit burn against the real shared balance.
  useEffect(() => {
    let previousTick = performance.now()
    const timer = window.setInterval(() => {
      const now = performance.now()
      const elapsed = Math.min(1000, now - previousTick)
      previousTick = now
      const interactionActive = now < userSpeechUntilRef.current || now < modelSpeechUntilRef.current
      if (!interactionActive || creditsApi.balance <= 0)
        return

      usageMillisecondsRef.current += elapsed
      const elapsedSeconds = Math.floor(usageMillisecondsRef.current / 1000)
      setConversationSeconds(current => current === elapsedSeconds ? current : elapsedSeconds)

      const requiredCredits = Math.ceil(usageMillisecondsRef.current / 60000)
      if (requiredCredits > billedUsageCreditsRef.current) {
        const charge = requiredCredits - billedUsageCreditsRef.current
        billedUsageCreditsRef.current = requiredCredits
        setUsageCredits(requiredCredits)
        creditsApi.spend(charge)
      }
    }, 200)
    return () => window.clearInterval(timer)
  }, [])

  // Scroll only the chat panel itself — scrollIntoView would drag the whole
  // page down to the conversation log mid-talk, breaking stage immersion.
  useEffect(() => {
    const list = messageListRef.current
    if (list)
      list.scrollTop = list.scrollHeight
  }, [messages])

  const flash = useCallback((text: string, isError = false) => {
    setNotice({ text, isError })
    window.setTimeout(() => setNotice(null), 4200)
  }, [])

  const resetUsage = useCallback(() => {
    usageMillisecondsRef.current = 0
    billedUsageCreditsRef.current = 0
    userSpeechUntilRef.current = 0
    modelSpeechUntilRef.current = 0
    setConversationSeconds(0)
    setUsageCredits(0)
  }, [])

  const stopMouthAnimation = useCallback(() => {
    if (mouthAnimationRef.current)
      cancelAnimationFrame(mouthAnimationRef.current)
    mouthAnimationRef.current = null
    setMouthFrame(0)
  }, [])

  const startMouthAnimation = useCallback(() => {
    const analyser = outputAnalyserRef.current
    if (!analyser)
      return
    const samples = new Uint8Array(analyser.fftSize)
    const frequencies = new Uint8Array(analyser.frequencyBinCount)
    let displayedFrame = 0
    let smoothedRms = 0
    let lastUpdate = 0
    const tick = (timestamp: number) => {
      analyser.getByteTimeDomainData(samples)
      let sum = 0
      for (const sample of samples) {
        const centered = (sample - 128) / 128
        sum += centered * centered
      }
      const rms = Math.sqrt(sum / samples.length)
      const smoothing = rms > smoothedRms ? 0.42 : 0.16
      smoothedRms += (rms - smoothedRms) * smoothing

      if (timestamp - lastUpdate >= 105) {
        analyser.getByteFrequencyData(frequencies)
        const averageBand = (start: number, end: number) => {
          let total = 0
          for (let index = start; index < end; index += 1) total += frequencies[index] || 0
          return total / Math.max(1, end - start)
        }
        const lowBand = averageBand(1, 7)
        const midBand = averageBand(7, 18)
        let target = smoothedRms < 0.016 ? 0 : smoothedRms < 0.042 ? 1 : smoothedRms < 0.082 ? 2 : 3

        // Rounded vowels carry more low-frequency energy; use the O frame sparingly.
        if (target >= 2 && lowBand > midBand * 1.22)
          target = 4

        let next = target
        if (target !== 4 && displayedFrame !== 4) {
          if (target > displayedFrame + 1)
            next = displayedFrame + 1
          if (target < displayedFrame - 1)
            next = displayedFrame - 1
        }
        if (next !== displayedFrame) {
          setMouthFrame(next)
          displayedFrame = next
        }
        lastUpdate = timestamp
      }
      mouthAnimationRef.current = requestAnimationFrame(tick)
    }
    mouthAnimationRef.current = requestAnimationFrame(tick)
  }, [])

  const clearOutput = useCallback(() => {
    outputSourcesRef.current.forEach((source) => {
      try { source.stop() }
      catch { /* already stopped */ }
    })
    outputSourcesRef.current.clear()
    outputCursorRef.current = 0
    modelSpeechUntilRef.current = 0
    stopMouthAnimation()
  }, [stopMouthAnimation])

  const playPcm = useCallback(async (base64: string) => {
    let context = outputContextRef.current
    if (!context) {
      context = new AudioContext({ sampleRate: 24000 })
      const analyser = context.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.3
      analyser.connect(context.destination)
      outputContextRef.current = context
      outputAnalyserRef.current = analyser
    }
    if (context.state === 'suspended')
      await context.resume()
    if (!mouthAnimationRef.current)
      startMouthAnimation()
    const bytes = base64ToBytes(base64)
    const aligned = bytes.byteLength % 2 === 0 ? bytes : bytes.slice(0, -1)
    const pcm = new Int16Array(aligned.buffer, aligned.byteOffset, aligned.byteLength / 2)
    const audioBuffer = context.createBuffer(1, pcm.length, 24000)
    const channel = audioBuffer.getChannelData(0)
    for (let i = 0; i < pcm.length; i += 1) channel[i] = pcm[i] / 32768
    const source = context.createBufferSource()
    source.buffer = audioBuffer
    source.connect(outputAnalyserRef.current!)
    const startAt = Math.max(context.currentTime + 0.02, outputCursorRef.current)
    source.start(startAt)
    setLiveState('speaking')
    // Deafen dictation for the duration of playback, else the recognizer picks
    // the character's own voice up off the speaker.
    dictationPauseRef.current()
    outputCursorRef.current = startAt + audioBuffer.duration
    modelSpeechUntilRef.current = performance.now() + Math.max(0, (outputCursorRef.current - context.currentTime) * 1000)
    outputSourcesRef.current.add(source)
    source.onended = () => {
      outputSourcesRef.current.delete(source)
      if (!outputSourcesRef.current.size) {
        setLiveState(state => state === 'idle' ? state : 'listening')
        setMouthFrame(0)
        dictationResumeRef.current()
      }
    }
  }, [startMouthAnimation])

  const stopInput = useCallback(async () => {
    inputProcessorRef.current?.disconnect()
    inputProcessorRef.current = null
    inputStreamRef.current?.getTracks().forEach(track => track.stop())
    inputStreamRef.current = null
    userSpeechUntilRef.current = 0
    if (inputContextRef.current)
      await inputContextRef.current.close().catch(() => undefined)
    inputContextRef.current = null
  }, [])

  /**
   * Dictation fallback. `dictationOnRef` is the intent ("the user is in voice
   * mode"); the recognizer itself is started and aborted repeatedly underneath
   * it, because Android ends a recognition session after each utterance and we
   * must not listen while the avatar is speaking (the recognizer hears the
   * phone's own speaker and transcribes the character back to itself).
   */
  const stopDictation = useCallback(() => {
    dictationOnRef.current = false
    const recognition = recognitionRef.current
    recognitionRef.current = null
    try { recognition?.abort() }
    catch { /* already torn down */ }
    setDictation(false)
  }, [])

  const startDictation = useCallback((session: Session): boolean => {
    const Recognizer = getSpeechRecognizer()
    if (!Recognizer)
      return false

    let recognition: SpeechRecognizer
    try { recognition = new Recognizer() }
    catch { return false }

    recognition.lang = lang === 'es' ? 'es-ES' : 'en-US'
    recognition.continuous = true
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++)
        transcript += `${event.results[i][0].transcript} `
      transcript = transcript.trim()
      if (!transcript || !sessionRef.current)
        return
      setMessages(current => [...current, { id: makeId(), role: 'user', text: transcript }])
      try { sessionRef.current.sendRealtimeInput({ text: transcript }) }
      catch { /* session closed mid-utterance */ }
    }

    recognition.onerror = (event) => {
      // no-speech/aborted are routine: onend restarts us.
      if (event.error === 'no-speech' || event.error === 'aborted')
        return
      if (event.error === 'network')
        return flash(t.dictationOffline)
      stopDictation()
      flash(t.dictationBlocked)
    }

    recognition.onend = () => {
      // Android hands back one utterance at a time — resume unless the avatar
      // is mid-sentence, in which case the output drain handler resumes us.
      if (!dictationOnRef.current || !sessionRef.current || outputSourcesRef.current.size)
        return
      try { recognitionRef.current?.start() }
      catch { /* already running */ }
    }

    recognitionRef.current = recognition
    dictationOnRef.current = true
    try {
      recognition.start()
    }
    catch {
      stopDictation()
      return false
    }
    setDictation(true)
    void session
    return true
  }, [flash, lang, stopDictation, t.dictationBlocked, t.dictationOffline])

  // Echo guard, driven by the audio-output lifecycle in `playPcm`.
  useEffect(() => {
    dictationPauseRef.current = () => {
      if (dictationOnRef.current) {
        try { recognitionRef.current?.abort() }
        catch { /* not running */ }
      }
    }
    dictationResumeRef.current = () => {
      if (!dictationOnRef.current || !sessionRef.current)
        return
      try { recognitionRef.current?.start() }
      catch { /* already running */ }
    }
  }, [])

  const stopSession = useCallback(async () => {
    stopDictation()
    await stopInput()
    clearOutput()
    try { sessionRef.current?.close() }
    catch { /* session already closed */ }
    sessionRef.current = null
    previewOnlyRef.current = false
    setLiveState('idle')
  }, [clearOutput, stopDictation, stopInput])

  useEffect(() => () => {
    inputStreamRef.current?.getTracks().forEach(track => track.stop())
    dictationOnRef.current = false
    try { recognitionRef.current?.abort() }
    catch { /* no-op */ }
    try { sessionRef.current?.close() }
    catch { /* no-op */ }
    if (mouthAnimationRef.current)
      cancelAnimationFrame(mouthAnimationRef.current)
  }, [])

  const startMicrophone = useCallback(async (session: Session) => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
    const context = new AudioContext()
    const source = context.createMediaStreamSource(stream)
    const processor = context.createScriptProcessor(4096, 1, 1)
    processor.onaudioprocess = (event) => {
      if (!sessionRef.current)
        return
      const input = event.inputBuffer.getChannelData(0)
      let energy = 0
      for (const sample of input) energy += sample * sample
      if (Math.sqrt(energy / input.length) > 0.026)
        userSpeechUntilRef.current = performance.now() + 280
      const pcm = downsampleToPcm16(input, context.sampleRate)
      session.sendRealtimeInput({ audio: { data: bytesToBase64(pcm), mimeType: 'audio/pcm;rate=16000' } })
    }
    source.connect(processor)
    processor.connect(context.destination)
    inputStreamRef.current = stream
    inputContextRef.current = context
    inputProcessorRef.current = processor
  }, [])

  const browserVoiceFallback = useCallback((phrase: string) => {
    if (!('speechSynthesis' in window))
      return
    const utterance = new SpeechSynthesisUtterance(phrase)
    utterance.lang = lang === 'es' ? 'es-ES' : 'en-US'
    const desiredGender = VOICES.find(item => item.name === voice)?.gender
    const voices = window.speechSynthesis.getVoices().filter(item => item.lang.startsWith(lang))
    utterance.voice = voices.find(item => desiredGender === 'female' ? /female|samantha|zira|aria/i.test(item.name) : /male|david|mark|daniel/i.test(item.name)) || voices[0] || null
    utterance.onstart = () => {
      modelSpeechUntilRef.current = performance.now() + Math.max(1200, phrase.length * 55)
      setLiveState('speaking')
      startMouthAnimation()
    }
    utterance.onend = () => {
      modelSpeechUntilRef.current = 0
      setLiveState('idle')
      setMouthFrame(0)
    }
    const gentleSequence = [1, 2, 1, 3, 2, 1, 4, 1]
    let sequenceIndex = 0
    const fake = window.setInterval(() => {
      if (!window.speechSynthesis.speaking)
        return window.clearInterval(fake)
      setMouthFrame(gentleSequence[sequenceIndex])
      sequenceIndex = (sequenceIndex + 1) % gentleSequence.length
    }, 120)
    window.speechSynthesis.speak(utterance)
  }, [lang, startMouthAnimation, voice])

  const openSession = useCallback(async (withMic: boolean, previewOnly = false) => {
    setLiveState('connecting')
    previewOnlyRef.current = previewOnly
    try {
      const tokenResponse = await fetch(apiUrl('/api/gemini-token'), { method: 'POST' })
      const tokenResult = await tokenResponse.json() as { token?: string, error?: string, demo?: boolean }
      if (!tokenResponse.ok || !tokenResult.token)
        throw new Error(tokenResult.error || 'Live API unavailable')
      const { GoogleGenAI, Modality } = await import('@google/genai')
      const ai = new GoogleGenAI({ apiKey: tokenResult.token, httpOptions: { apiVersion: 'v1beta' } })
      const session = await ai.live.connect({
        model: LIVE_MODEL,
        callbacks: {
          onopen: () => setLiveState(withMic ? 'listening' : 'speaking'),
          onmessage: (message: LiveServerMessage) => {
            const content = message.serverContent
            if (content?.interrupted)
              clearOutput()
            const parts = content?.modelTurn?.parts || []
            for (const part of parts) {
              if (part.inlineData?.data) {
                setLiveState('speaking')
                void playPcm(part.inlineData.data)
              }
            }
            const outputText = content?.outputTranscription?.text
            if (outputText) {
              transcriptRef.current += outputText
              const text = transcriptRef.current
              setMessages((current) => {
                const last = current.at(-1)
                if (last?.id === 'live-transcript')
                  return [...current.slice(0, -1), { ...last, text }]
                return [...current, { id: 'live-transcript', role: 'avatar', text }]
              })
            }
            if (content?.turnComplete) {
              setMessages(current => current.map(item => item.id === 'live-transcript' ? { ...item, id: makeId() } : item))
              transcriptRef.current = ''
              if (previewOnlyRef.current) {
                window.setTimeout(() => void stopSession(), 500)
              }
              else {
                window.setTimeout(() => {
                  setLiveState(state => state === 'idle' ? state : outputSourcesRef.current.size ? 'speaking' : 'listening')
                }, 25)
              }
            }
          },
          onerror: (error: ErrorEvent) => {
            flash(error.message || 'Gemini Live connection error', true)
            void stopSession()
          },
          onclose: () => {
            if (!previewOnlyRef.current)
              setLiveState('idle')
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          contextWindowCompression: { slidingWindow: {} },
          systemInstruction: { parts: [{ text: `${activeAvatar.systemPrompt}\nThe interface language is ${lang === 'es' ? 'Spanish' : 'English'}. Answer in the user's language.` }] },
        },
      })
      sessionRef.current = session
      if (withMic) {
        // Mic failure (WebView permission, busy device) must not kill the
        // session — voice output + typed input still work without it.
        // The error NAME is the whole diagnosis and there are no devtools in
        // the wallet WebView, so stash it where `/audio-check.html` can read it:
        // NotAllowedError = host app never granted the WebView audio capture,
        // NotFoundError = no input device, SecurityError = insecure origin.
        try {
          await startMicrophone(session)
        }
        catch (error) {
          const name = error instanceof Error ? error.name : 'UnknownError'
          const detail = error instanceof Error ? error.message : String(error)
          console.warn('[mic] getUserMedia failed:', name, detail)
          ;(window as unknown as { __omMicError?: string }).__omMicError = `${name}: ${detail}`
          // Inside Nimiq Pay this is where we land (NotReadableError). Web Speech
          // dictation still reaches the OS mic, so try it before falling back to
          // typing-only.
          if (startDictation(session))
            flash(t.dictationOn)
          else
            flash(t.micUnavailable, true)
          setLiveState('listening')
        }
      }
      return session
    }
    catch (error) {
      setLiveState('idle')
      const message = error instanceof Error ? error.message : 'Unable to connect'
      flash(`${t.demo}: ${message}`, true)
      return null
    }
  }, [activeAvatar.systemPrompt, clearOutput, flash, lang, playPcm, startDictation, startMicrophone, stopSession, t.demo, t.dictationOn, t.micUnavailable, voice])

  const previewVoice = async () => {
    if (liveState !== 'idle')
      await stopSession()
    const session = await openSession(false, true)
    if (session)
      session.sendRealtimeInput({ text: `Say exactly this phrase and nothing else: ${TEST_PHRASE}` })
    else browserVoiceFallback(TEST_PHRASE)
  }

  const toggleLive = async () => {
    if (liveState !== 'idle')
      return void stopSession()
    if (creditsApi.balance <= 0)
      return flash(t.noCredits, true)
    await openSession(true, false)
  }

  const sendText = async (event: FormEvent) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text)
      return
    if (!sessionRef.current && creditsApi.balance <= 0)
      return flash(t.noCredits, true)
    setDraft('')
    setMessages(current => [...current, { id: makeId(), role: 'user', text }])
    let session = sessionRef.current
    if (!session)
      session = await openSession(false, false)
    if (session) {
      session.sendRealtimeInput({ text })
    }
    else {
      const fallback = lang === 'es'
        ? `${activeAvatar.alias} inclina la cabeza. “Te escucho. Cuando el servidor tenga la llave de Gemini, mi voz cruzará el velo.”`
        : `${activeAvatar.alias} inclines their head. “I hear you. Once the server holds the Gemini key, my voice will cross the veil.”`
      setMessages(current => [...current, { id: makeId(), role: 'avatar', text: fallback }])
      browserVoiceFallback(fallback)
    }
  }

  const unlockSlots = () => {
    if (!creditsApi.spend(250))
      return flash(t.insufficient, true)
    setExtraUnlocked(true)
    localStorage.setItem(EXTRA_SLOTS_KEY, 'true')
    flash(t.unlocked)
  }

  const generateAvatar = async () => {
    if (!uploadFile || uploadSlot === null)
      return
    if (creditsApi.balance < AVATAR_SPRITE_CREDITS)
      return flash(t.insufficientImageCredits, true)
    setGenerating(true)
    try {
      const optimizedFile = await optimizeReferenceImage(uploadFile)
      const dataUrl = await fileToDataUrl(optimizedFile)
      const { base64, mimeType } = splitDataUrl(dataUrl)
      const response = await fetchWithRetry('/api/generate-avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          name: uploadName || uploadFile.name.replace(/\.[^.]+$/, ''),
          subjectType: uploadSubject,
        }),
      })
      const result = await response.json() as { spriteDataUrl?: string, profile?: { name?: string, alias?: string, summary?: string, systemPrompt?: string, gender?: string }, error?: string }
      if (!response.ok || !result.spriteDataUrl)
        throw new Error(result.error || 'Generation failed')
      const transparentSpriteDataUrl = await removeChromaGreen(result.spriteDataUrl)
      const id = `custom-${uploadSlot}-${Date.now()}`
      const name = result.profile?.name || uploadName || 'New Character'
      const detectedGender: AvatarProfile['gender'] = uploadSubject === 'object'
        ? 'object'
        : result.profile?.gender === 'female' ? 'female' : result.profile?.gender === 'male' ? 'male' : 'custom'
      const avatar: AvatarProfile = {
        id,
        name,
        alias: result.profile?.alias || 'The Newcomer',
        gender: detectedGender,
        custom: true,
        slot: uploadSlot,
        summary: { en: result.profile?.summary || 'A new story waits to be told.', es: result.profile?.summary || 'Una nueva historia espera ser contada.' },
        systemPrompt: result.profile?.systemPrompt || `You are ${name}. Stay fully in character and keep spoken turns natural and concise.`,
        outfits: [{ id: 'original', label: { en: 'Original', es: 'Original' }, spriteUrl: transparentSpriteDataUrl }],
      }
      const nextAvatars = [...customAvatars.filter(item => item.slot !== uploadSlot), avatar]
      setCustomAvatars(nextAvatars)
      const persisted = persistAvatars(nextAvatars)
      setOutfitId('original')
      setBackgroundId(defaultBackgroundFor(avatar, 'original'))
      setMessages([])
      resetUsage()
      setActiveId(id)
      const voiceDefault = defaultVoiceFor(detectedGender)
      if (voiceDefault)
        setVoice(voiceDefault)
      setUploadSlot(null)
      setUploadFile(null)
      setUploadName('')
      setUploadSubject('human')
      creditsApi.spend(AVATAR_SPRITE_CREDITS)
      if (persisted) {
        flash(t.stored)
        window.setTimeout(() => flash(t.imageCost), 150)
      }
      else {
        flash(t.storeFailed, true)
      }
    }
    catch (error) {
      flash(error instanceof Error ? error.message : 'Generation failed', true)
    }
    finally {
      setGenerating(false)
    }
  }

  const removeCustom = (avatar: AvatarProfile) => {
    const next = customAvatars.filter(item => item.id !== avatar.id)
    setCustomAvatars(next)
    persistAvatars(next)
    if (activeId === avatar.id) {
      setOutfitId('adventurer')
      setBackgroundId(defaultBackgroundFor(BUILT_IN_AVATARS[0], BUILT_IN_AVATARS[0].outfits[0]?.id ?? ''))
      setMessages([])
      resetUsage()
      setActiveId(BUILT_IN_AVATARS[0].id)
    }
  }

  const downloadAvatar = async (avatar: AvatarProfile) => {
    const spriteUrl = avatar.outfits[0].spriteUrl
    let dataUrl = spriteUrl
    if (!spriteUrl.startsWith('data:')) {
      const blob = await (await fetch(spriteUrl)).blob()
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(String(reader.result))
        reader.readAsDataURL(blob)
      })
    }
    const safeName = avatar.name.replace(/\s+/g, '-')
    downloadDataUrl(dataUrl, `${safeName}-sprite.png`)
    downloadJson(
      { name: avatar.name, alias: avatar.alias, summary: avatar.summary, systemPrompt: avatar.systemPrompt },
      `${safeName}-profile.json`,
    )
  }

  const selectAvatar = (id: string) => {
    if (liveState !== 'idle')
      void stopSession()
    const nextAvatar = allAvatars.find(item => item.id === id) || BUILT_IN_AVATARS[0]
    const nextOutfit = nextAvatar.outfits[0]?.id || 'original'
    setOutfitId(nextOutfit)
    setBackgroundId(defaultBackgroundFor(nextAvatar, nextOutfit))
    const voiceDefault = defaultVoiceFor(nextAvatar.gender)
    if (voiceDefault)
      setVoice(voiceDefault)
    setMessages([])
    resetUsage()
    setActiveId(id)
    setSidebarOpen(false)
  }

  // Guide the user to the character rail (top-left) with a temporary glow.
  const changeAvatar = () => {
    setSidebarOpen(true)
    setRailGlow(true)
    window.scrollTo({ top: 0, left: 0, behavior: 'smooth' })
    window.setTimeout(() => setRailGlow(false), 2600)
  }

  const handleCustomAvatarSelect = (event: MouseEvent<HTMLButtonElement>) => {
    selectAvatar(event.currentTarget.value)
  }

  const handleCustomAvatarRemove = (event: MouseEvent<HTMLButtonElement>) => {
    const avatar = customAvatars.find(item => item.id === event.currentTarget.value)
    if (avatar)
      removeCustom(avatar)
  }

  return (
    <main className="rp-root">
      <div className="ambient-orb orb-one" />
      <div className="ambient-orb orb-two" />

      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="Open character menu"><Menu size={20} /></button>
        <Link to="/" className="brand-lockup">
          <div className="brand-mark">
            <img src={theme === 'dark' ? '/otherme-icon-dark.png' : '/otherme-icon-light.png'} alt="Other Me" />
          </div>
          <div><strong>OTHER ME</strong><span>{t.studio}</span></div>
        </Link>
        <div className="topbar-actions">
          <Link to="/credits" className="topbar-utility-button"><Plus size={14} />{t.addCredits}</Link>
          <div className="usage-pill" aria-label={`${t.conversationTime}: ${formatDuration(conversationSeconds)}. ${t.useCredits}: ${usageCredits}`}>
            <span>{t.conversationTime}: <strong>{formatDuration(conversationSeconds)}</strong></span>
            <i />
            <span>{t.useCredits}: <strong>{usageCredits}</strong></span>
          </div>
          <Link to="/credits" className="credits-pill"><Coins size={15} /><strong>{balance}</strong><span>{t.credits}</span></Link>
          <button className="language-button" onClick={toggleTheme} aria-label="Toggle theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
          <button className="language-button" onClick={toggleLang}><Languages size={16} />{lang.toUpperCase()}</button>
        </div>
      </header>

      <div className="workspace-grid">
        <aside className={`character-rail ${sidebarOpen ? 'open' : ''} ${railGlow ? 'glow' : ''}`}>
          <div className="rail-heading"><span>{t.characters}</span><button className="icon-button close-rail" onClick={() => setSidebarOpen(false)}><X size={18} /></button></div>
          <div className="avatar-list">
            {BUILT_IN_AVATARS.map(avatar => (
              <button key={avatar.id} className={`avatar-card ${activeId === avatar.id ? 'active' : ''}`} onClick={() => selectAvatar(avatar.id)}>
                <span className="avatar-thumb" style={{ backgroundImage: `url(${avatar.outfits[0].spriteUrl})`, backgroundSize: '300% 200%', backgroundPosition: '0 0' }} />
                <span className="avatar-meta"><strong>{avatar.name}</strong><small>{avatar.alias} · {avatar.gender === 'female' ? 'F' : avatar.gender === 'male' ? 'M' : '⬡'}</small></span>
                {activeId === avatar.id && <Check size={16} />}
              </button>
            ))}

            <div className="rail-section-label">{t.freeSlots}</div>
            {Array.from({ length: customSlotCount }, (_, index) => index + 1).map((slot) => {
              const avatar = customAvatars.find(item => item.slot === slot)
              return avatar
                ? (
                    <div key={slot} className={`avatar-card custom-card ${activeId === avatar.id ? 'active' : ''}`}>
                      <button className="custom-select" value={avatar.id} onClick={handleCustomAvatarSelect}>
                        <span className="avatar-thumb" style={{ backgroundImage: `url(${avatar.outfits[0].spriteUrl})`, backgroundSize: '300% 200%', backgroundPosition: '0 0' }} />
                        <span className="avatar-meta"><strong>{avatar.name}</strong><small>{avatar.alias}</small></span>
                      </button>
                      <button className="download-button" onClick={() => void downloadAvatar(avatar)} title={t.downloadAvatar}><Download size={14} /></button>
                      <button className="remove-button" value={avatar.id} onClick={handleCustomAvatarRemove} title={t.remove}><Trash2 size={14} /></button>
                    </div>
                  )
                : (
                    <button key={slot} className="avatar-card empty-card" onClick={() => setUploadSlot(slot)}>
                      <span className="empty-avatar"><Plus size={18} /></span>
                      <span className="avatar-meta"><strong>{t.empty} {slot}</strong><small>{t.addCharacter}</small></span>
                    </button>
                  )
            })}
          </div>
          {!extraUnlocked && (
            <button className="unlock-card" onClick={unlockSlots}>
              <span><LockKeyhole size={17} /></span>
              <div><strong>{t.unlock}</strong><small>250 {t.credits}</small></div>
            </button>
          )}
        </aside>

        <section className="stage-column">
          <div className="stage-toolbar">
            <div className="stage-nav-actions">
              <Link to="/" className="toolbar-nav-button"><ArrowLeft size={14} />{t.backHome}</Link>
            </div>
            <div className="stage-selectors">
              <label><span><ImageIcon size={14} />{t.scene}</span><select value={backgroundId} onChange={event => setBackgroundId(event.target.value)}>{BACKGROUNDS.map(item => <option key={item.id} value={item.id}>{item.label[lang]}</option>)}</select><ChevronDown size={14} /></label>
              <label><span><WandSparkles size={14} />{t.outfit}</span><select value={activeOutfit.id} onChange={event => { const nextOutfit = event.target.value; setOutfitId(nextOutfit); setBackgroundId(defaultBackgroundFor(activeAvatar, nextOutfit)) }}>{activeAvatar.outfits.map(item => <option key={item.id} value={item.id}>{item.label[lang]}</option>)}</select><ChevronDown size={14} /></label>
            </div>
          </div>

          <div className="character-stage" style={{ backgroundImage: `linear-gradient(180deg, rgba(4,8,10,.08), rgba(4,8,10,.58)), url(${activeBackground.url})` }}>
            <div className="stage-vignette" />
            <div className={`live-status ${liveState}`}><span className={liveState} />{liveState === 'idle' ? t.ready : liveState === 'connecting' ? t.connecting : liveState === 'speaking' ? t.speaking : t.listening}</div>
            <SpriteAvatar spriteUrl={activeOutfit.spriteUrl} frame={mouthFrame} speaking={liveState === 'speaking'} />
            <div className="character-caption">
              <div><span>{t.talkingWith}</span><h1>{activeAvatar.name}</h1></div>
            </div>
            <button className="change-avatar-button" onClick={changeAvatar}>
              <UserRound size={17} />
              {t.changeAvatar}
            </button>
            {liveState === 'listening' && (
              <div className="live-wave" role="status">
                <span className="wave-bars"><span /><span /><span /><span /></span>
                {t.listening}
              </div>
            )}
            <button className={`live-button ${liveState !== 'idle' ? 'active' : ''}`} onClick={toggleLive} disabled={liveState === 'connecting'}>
              {liveState === 'connecting' ? <LoaderCircle className="spin" size={20} /> : liveState === 'idle' ? <Mic size={20} /> : <MicOff size={20} />}
              {liveState === 'idle' ? t.live : liveState === 'connecting' ? t.connecting : t.end}
            </button>
          </div>
        </section>

        <aside className="conversation-panel">
          <section className="voice-section">
            <div className="panel-title"><span><Volume2 size={16} />{t.voice}</span><small>Gemini Live</small></div>
            <p className="coming-soon-flag"><Sparkles size={12} />{t.voicesComingSoon}</p>
            <div className="voice-grid">
              {VOICES.map(item => (
                <button key={item.name} className={`voice-option ${voice === item.name ? 'active' : ''}`} onClick={() => setVoice(item.name)}>
                  <span className={`gender-dot ${item.gender}`} />
                  <span><strong>{item.name}</strong><small>{item.tone[lang]}</small></span>
                  {voice === item.name && <Check size={14} />}
                </button>
              ))}
            </div>
            <button className="preview-button" onClick={previewVoice}><Play size={14} fill="currentColor" />{t.testVoice}<small>“{TEST_PHRASE}”</small></button>
          </section>

          <section className="character-background-section">
            <div className="panel-title"><span><BookOpen size={16} />{t.characterBackground}</span><small>{activeAvatar.alias}</small></div>
            <p>{activeAvatar.summary[lang]}</p>
          </section>

          <section className="chat-section">
            <div className="panel-title"><span><MessageCircle size={16} />{t.chat}</span><span className="secure-label">LOCAL</span></div>
            <div className="message-list" ref={messageListRef}>
              {!messages.length && (
                <div className="empty-conversation"><div><MessageCircle size={22} /></div><p>{lang === 'es' ? `Habla con ${activeAvatar.alias} por voz o escribe para comenzar.` : `Speak with ${activeAvatar.alias} by voice or type to begin.`}</p><small>{t.demoHelp}</small></div>
              )}
              {messages.map(message => <div key={message.id} className={`message ${message.role}`}><span>{message.role === 'user' ? (lang === 'es' ? 'Tú' : 'You') : activeAvatar.alias}</span><p>{message.text}</p></div>)}
            </div>
            {dictation && (
              <div className="dictation-note" role="status">
                <p className="dictation-state">
                  <Mic size={13} />
                  {liveState === 'speaking' ? t.dictationPaused : t.dictationListening}
                </p>
                <p>{t.dictationNote}</p>
              </div>
            )}
            <form className="chat-input" onSubmit={sendText}>
              <input value={draft} onChange={event => setDraft(event.target.value)} placeholder={t.placeholder} aria-label={t.placeholder} />
              <button type="submit" aria-label={t.send}><Send size={17} /></button>
            </form>
          </section>
        </aside>
      </div>

      {uploadSlot !== null && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !generating) setUploadSlot(null) }}>
          <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
            <button className="modal-close" onClick={() => !generating && setUploadSlot(null)}><X size={19} /></button>
            <div className="modal-icon"><WandSparkles size={24} /></div>
            <p className="eyebrow">CUSTOM SLOT {uploadSlot}</p>
            <h2 id="upload-title">{t.uploadTitle}</h2>
            <p className="modal-help">{t.uploadHelp}</p>
            <label className="field-label"><span>{t.characterName}</span><input value={uploadName} onChange={event => setUploadName(event.target.value)} placeholder="e.g. Elara Voss" disabled={generating} /></label>
            <div className="subject-picker">
              <span>{t.spriteSubject}</span>
              <div role="radiogroup" aria-label={t.spriteSubject}>
                <button type="button" role="radio" aria-checked={uploadSubject === 'human'} className={uploadSubject === 'human' ? 'active' : ''} onClick={() => setUploadSubject('human')} disabled={generating}><UserRound size={16} /><b>{t.humanSubject}</b><small>{t.humanSubjectHelp}</small></button>
                <button type="button" role="radio" aria-checked={uploadSubject === 'object'} className={uploadSubject === 'object' ? 'active' : ''} onClick={() => setUploadSubject('object')} disabled={generating}><Package size={16} /><b>{t.objectSubject}</b><small>{t.objectSubjectHelp}</small></button>
              </div>
            </div>
            <label className={`drop-zone ${uploadFile ? 'has-file' : ''}`}>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={event => setUploadFile(event.target.files?.[0] || null)} disabled={generating} />
              {uploadFile ? <><Check size={24} /><strong>{uploadFile.name}</strong><small>{(uploadFile.size / 1024 / 1024).toFixed(1)} MB</small></> : <><Upload size={26} /><strong>{t.chooseFile}</strong><small>PNG · JPG · WEBP · max 20 MB</small></>}
            </label>
            {generating && <div className="generation-progress"><span><i /></span><p>{t.generating}</p></div>}
            {balance < AVATAR_SPRITE_CREDITS && (
              <p className="modal-help" role="alert" style={{ color: 'var(--nimiq-gold, #e9b213)', fontWeight: 700 }}>
                {t.insufficientImageCredits} — <Link to="/credits" style={{ color: 'inherit', textDecoration: 'underline' }}>{t.addCredits}</Link>
              </p>
            )}
            <div className="modal-actions"><button className="secondary-button" onClick={() => setUploadSlot(null)} disabled={generating}>{t.cancel}</button><button className="primary-button" onClick={generateAvatar} disabled={!uploadFile || generating}>{generating ? <LoaderCircle className="spin" size={17} /> : <WandSparkles size={17} />}{t.generate} · {AVATAR_SPRITE_CREDITS} {t.credits}</button></div>
          </section>
        </div>
      )}

      {notice && notice.isError
        ? <ErrorNotice message={notice.text} lang={lang} onClose={() => setNotice(null)} />
        : notice && <div className="toast"><Sparkles size={16} />{notice.text}</div>}
      {sidebarOpen && <div className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
    </main>
  )
}
