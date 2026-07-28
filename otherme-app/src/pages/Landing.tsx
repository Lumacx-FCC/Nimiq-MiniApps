/**
 * Landing page — per "Other Me Landing.PNG" plus the v2 layout revisions:
 *  1. Logo + free character-sheet upload card (no login required)
 *  2. Logged out: "Log in to talk and create" CTA + avatar carousel
 *     Logged in: saved-character gallery with Scene / Video / Talk actions
 *  3. Elena showcase: the 3 ACTIVE feature bubbles sit above the image (never
 *     covering her face); the 3 disabled ones sit below under "Coming Soon".
 */
import {
  ArrowRight, BriefcaseBusiness, ChevronDown, Clapperboard, CloudUpload,
  Images, Mail, MessageCircle, MessagesSquare, MonitorPlay, Share2, Sparkles,
  UserRound, Video, Youtube,
} from 'lucide-react'
import { ChangeEvent, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { listSheets } from '../character/library'
import AppHeader from '../components/AppHeader'
import Lightbox from '../components/Lightbox'

const COPY = {
  en: {
    uploadCta: 'Upload image to generate free Character Sheet',
    uploadHint: 'PNG · JPG · WEBP — 5 free sheet renders, no account needed',
    sampleTag: 'Other Me',
    loginCta: 'Log in to talk and create',
    loginToSeeSaved: 'Log in to see your saved images in the gallery.',
    talkCta: 'Talk and create',
    galleriesCta: 'Galleries',
    myCharacters: 'My characters',
    noCharacters: 'No saved characters yet — upload an image above to create your first one.',
    scene: 'Scene',
    video: 'Video',
    talk: 'Talk',
    comingSoon: 'Coming Soon',
    genScenes: 'Generate Scenes',
    genVideo: 'Generate Video',
    tutorial: 'App Intro',
    collab: 'Professional Collab',
    roleplay: 'Dynamic Roleplay',
    social: 'Social interaction',
    talkingWith: 'TALKING WITH',
    loginFirst: 'Log in first to unlock this feature',
    follow: 'Follow us',
    footer: 'Other Me Labs',
    terms: 'Terms & Conditions',
  },
  es: {
    uploadCta: 'Sube una imagen y genera tu Character Sheet gratis',
    uploadHint: 'PNG · JPG · WEBP — 5 renders gratis, sin cuenta',
    sampleTag: 'Other Me',
    loginCta: 'Inicia sesión para hablar y crear',
    loginToSeeSaved: 'Inicia sesión para ver tus imágenes guardadas en la galería.',
    talkCta: 'Hablar y crear',
    galleriesCta: 'Galerías',
    myCharacters: 'Mis personajes',
    noCharacters: 'Aún no hay personajes guardados — sube una imagen arriba para crear el primero.',
    scene: 'Escena',
    video: 'Video',
    talk: 'Hablar',
    comingSoon: 'Próximamente',
    genScenes: 'Generar Escenas',
    genVideo: 'Generar Video',
    tutorial: 'Intro de la app',
    collab: 'Colaboración Profesional',
    roleplay: 'Roleplay Dinámico',
    social: 'Interacción Social',
    talkingWith: 'HABLANDO CON',
    loginFirst: 'Inicia sesión primero para desbloquear esta función',
    follow: 'Síguenos',
    footer: 'Other Me Labs',
    terms: 'Términos y Condiciones',
  },
} as const

/** Brand marks lucide doesn't ship (simple-icons path data, CC0). */
const BRAND_PATHS = {
  x: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z',
  tiktok: 'M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.6-1.62-.95-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
} as const

function BrandIcon({ path }: { path: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d={path} />
    </svg>
  )
}

/** Terms & conditions, hosted in the public repo until the in-app page ships. */
const TERMS_URL = 'https://github.com/Lumacx-FCC/Nimiq-MiniApps/blob/main/otherme-app/docs/terms-and-conditions.md'

const SOCIALS = [
  { key: 'email', label: 'info@othermeapp.com', href: 'mailto:info@othermeapp.com', icon: <Mail size={14} /> },
  { key: 'x', label: '@OtherMeAppCR', href: 'https://x.com/OtherMeAppCR', icon: <BrandIcon path={BRAND_PATHS.x} /> },
  { key: 'youtube', label: '@OtherMeApp', href: 'https://www.youtube.com/@OtherMeApp', icon: <Youtube size={15} /> },
  { key: 'tiktok', label: '@othermeapp', href: 'https://www.tiktok.com/@othermeapp', icon: <BrandIcon path={BRAND_PATHS.tiktok} /> },
]

const CAROUSEL = [
  { url: '/avatars/kaelen-male.webp', blur: true },
  { url: '/avatars/kaelen-male-ceremonial.webp', blur: true },
  { url: '/avatars/kaelen-female.webp', blur: false },
]

export default function Landing() {
  const { lang, theme } = useSettings()
  const { isLoggedIn } = useAuth()
  const navigate = useNavigate()
  const t = COPY[lang]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [lightbox, setLightbox] = useState<{ src: string, alt: string } | null>(null)
  const characters = useMemo(() => (isLoggedIn ? listSheets() : []), [isLoggedIn])

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file)
      return
    const reader = new FileReader()
    reader.onloadend = () => {
      try {
        sessionStorage.setItem('otherme:pending-reference', String(reader.result))
      }
      catch {
        // Image too large for sessionStorage — the studio lets them re-pick.
      }
      navigate('/create')
    }
    reader.readAsDataURL(file)
  }

  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 3000)
  }

  const openFeature = (route: '/scenes' | '/videos') => {
    if (!isLoggedIn)
      return navigate('/login', { state: { notice: t.loginFirst, redirectTo: route } })
    navigate(route)
  }

  const talkWith = (imageDataUrl: string | null, name: string) => {
    if (imageDataUrl) {
      try {
        sessionStorage.setItem('otherme:avatar-reference', JSON.stringify({ imageDataUrl, name }))
      }
      catch { /* too large — the talk studio lets them re-pick */ }
    }
    navigate('/talk')
  }

  const activeChips = [
    { label: t.genScenes, icon: Clapperboard, onClick: () => openFeature('/scenes') },
    { label: t.genVideo, icon: Video, onClick: () => openFeature('/videos') },
    { label: t.tutorial, icon: MonitorPlay, onClick: () => setShowTutorial(true) },
  ]

  const comingSoonCards = [
    { label: t.collab, icon: BriefcaseBusiness },
    { label: t.roleplay, icon: MessagesSquare },
    { label: t.social, icon: Share2 },
  ]

  return (
    <div className="page-shell">
      <AppHeader />

      {/* ---- Section 1: hero + free character sheet ---- */}
      <section className="om-card text-center mb-5">
        <img
          src={theme === 'dark' ? '/otherme-icon-dark.png' : '/otherme-icon-light.png'}
          alt="Other Me logo"
          className="w-24 h-24 mx-auto mb-2 drop-shadow-lg"
        />
        <h1 className="text-3xl font-extrabold mb-6" style={{ color: 'var(--text-100)' }}>Other Me</h1>

        <button
          className="w-full rounded-2xl border-2 border-dashed p-6 flex flex-col items-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
          style={{ borderColor: 'var(--om-teal)', background: 'var(--highlight-bg)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <span
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg"
            style={{ background: 'var(--om-cta-bg)' }}
          >
            <CloudUpload size={28} />
          </span>
          <span className="font-bold text-base" style={{ color: 'var(--text-100)' }}>{t.uploadCta}</span>
          <span className="text-xs" style={{ color: 'var(--text-40)' }}>{t.uploadHint}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />

        {/* Sample sheet preview (folder card like the mockup) */}
        <div className="relative mt-6 rounded-2xl overflow-hidden shadow-xl">
          <div
            className="absolute top-0 right-0 z-10 px-4 py-1 text-xs font-bold text-white rounded-bl-xl"
            style={{ background: 'var(--om-cta-bg)' }}
          >
            {t.sampleTag}
          </div>
          <img src="/landing/sample-sheet.png" alt="Sample character sheet — Elena Varma" className="w-full h-auto block" />
        </div>
      </section>

      {/* ---- Section 2: login CTA (logged out) / character gallery (logged in) ---- */}
      <section className="om-card mb-5">
        {!isLoggedIn
          ? (
              <div className="text-center">
                <ChevronDown size={20} className="mx-auto mb-4 float-slow" style={{ color: 'var(--om-teal)' }} />
                <button
                  className="om-button w-full text-lg"
                  onClick={() => navigate('/login', { state: { redirectTo: '/gallery' } })}
                >
                  <Sparkles size={18} />
                  {t.loginCta}
                </button>
                <p className="text-xs mt-2 m-0" style={{ color: 'var(--text-60)' }}>{t.loginToSeeSaved}</p>
                <div className="flex items-center justify-center gap-3 mt-8">
                  {CAROUSEL.map((avatar, index) => (
                    <div
                      key={index}
                      className={`sprite-thumb rounded-full shadow-lg ${avatar.blur ? 'blur-[3px] opacity-60 w-16 h-16' : 'w-20 h-20'}`}
                      style={{ backgroundImage: `url(${avatar.url})` }}
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <ArrowRight size={20} className="mx-auto mt-3" style={{ color: 'var(--om-teal)' }} aria-hidden="true" />
              </div>
            )
          : (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-extrabold uppercase tracking-widest m-0" style={{ color: 'var(--text-40)' }}>{t.myCharacters}</h2>
                  <div className="flex items-center gap-1.5">
                    <button className="icon-chip !text-xs" onClick={() => navigate('/gallery')}>
                      <Images size={13} />
                      {t.galleriesCta}
                    </button>
                    <button className="icon-chip !text-xs" onClick={() => navigate('/talk')}>
                      <Sparkles size={13} />
                      {t.talkCta}
                    </button>
                  </div>
                </div>
                {!characters.length && <p className="text-sm m-0" style={{ color: 'var(--text-60)' }}>{t.noCharacters}</p>}
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
                  {characters.map(sheet => (
                    <div key={sheet.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--highlight-bg)' }}>
                      {sheet.imageDataUrl
                        ? <img src={sheet.imageDataUrl} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0 cursor-zoom-in" onClick={() => setLightbox({ src: sheet.imageDataUrl!, alt: sheet.name })} />
                        : <span className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--nq-card)' }}><UserRound size={18} style={{ color: 'var(--om-teal)' }} /></span>}
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-sm truncate m-0">{sheet.name}</p>
                        <p className="text-[11px] truncate m-0" style={{ color: 'var(--text-40)' }}>{sheet.data.alias}</p>
                      </div>
                      {/* Labels collapse to icons on narrow screens so the action
                          chips never overlap the character name. */}
                      <button className="icon-chip !text-[11px] !min-w-0 !px-2.5 shrink-0" title={t.scene} onClick={() => navigate('/scenes', { state: { characterId: sheet.id } })}>
                        <Clapperboard size={13} /><span className="hidden min-[430px]:inline">{t.scene}</span>
                      </button>
                      <button className="icon-chip !text-[11px] !min-w-0 !px-2.5 shrink-0" title={t.video} onClick={() => navigate('/videos', { state: { characterId: sheet.id } })}>
                        <Video size={13} /><span className="hidden min-[430px]:inline">{t.video}</span>
                      </button>
                      <button className="icon-chip !text-[11px] !min-w-0 !px-2.5 shrink-0" title={t.talk} onClick={() => talkWith(sheet.imageDataUrl, sheet.name)}>
                        <MessageCircle size={13} /><span className="hidden min-[430px]:inline">{t.talk}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
      </section>

      {/* ---- Section 3: Elena showcase — active bubbles above, coming soon below ---- */}
      <section className="rounded-3xl overflow-hidden shadow-xl mb-5" style={{ background: 'var(--nq-card)' }}>
        <div className="grid grid-cols-3 gap-2 p-3">
          {activeChips.map(({ label, icon: Icon, onClick }) => (
            <button
              key={label}
              className="rounded-xl px-2 py-3 text-center text-[11px] font-bold flex flex-col items-center gap-1.5 transition-transform active:scale-95 float-slow"
              style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
              onClick={onClick}
            >
              <Icon size={18} style={{ color: 'var(--om-teal)' }} />
              {label}
            </button>
          ))}
        </div>

        <div className="relative">
          <img src="/landing/elena-scene.png" alt="Talking with Elena" className="w-full h-auto block" />
          <div className="absolute bottom-0 inset-x-0 px-4 py-3" style={{ background: 'linear-gradient(transparent, rgba(10,14,25,0.8))' }}>
            <span className="text-[10px] tracking-widest text-white opacity-80">
              {t.talkingWith} <i className="not-italic font-serif text-sm">Elena</i>
            </span>
          </div>
        </div>

        <div className="p-4">
          <p className="text-center text-xl font-extrabold mb-3 flex items-center justify-center gap-2 m-0" style={{ color: 'var(--om-teal)' }}>
            {t.comingSoon}
            <Sparkles size={16} />
          </p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {comingSoonCards.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="rounded-xl px-2 py-3 text-center text-[11px] font-bold flex flex-col items-center gap-1 opacity-50 cursor-not-allowed select-none"
                style={{ background: 'var(--highlight-bg)', color: 'var(--text-60)' }}
                aria-disabled="true"
                title={t.comingSoon}
              >
                <Icon size={16} style={{ color: 'var(--om-teal)' }} />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="text-center pb-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest mb-2" style={{ color: 'var(--text-40)' }}>{t.follow}</p>
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          {SOCIALS.map(social => (
            <a
              key={social.key}
              className="icon-chip !text-xs no-underline"
              href={social.href}
              target={social.key === 'email' ? undefined : '_blank'}
              rel="noopener noreferrer"
            >
              {social.icon}
              {social.label}
            </a>
          ))}
        </div>
        <p className="text-sm font-bold m-0" style={{ color: 'var(--text-60)' }}>{t.footer}</p>
        {/* Interim: the terms live in the repo until the `[…]` placeholders clear
            legal review and a Spanish version exists, at which point this becomes
            an in-app /terms route (see docs/terms-and-conditions.md). */}
        <p className="text-xs mt-1 m-0">
          <a
            className="no-underline hover:underline"
            style={{ color: 'var(--text-40)' }}
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.terms}
          </a>
        </p>
      </footer>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {/* Tutorial video — unmounting the iframe on click-away stops playback. */}
      {showTutorial && (
        <div
          className="fixed inset-0 z-50 grid place-items-center p-4"
          style={{ background: 'rgba(4,8,12,.8)' }}
          onClick={() => setShowTutorial(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--nq-card)' }}
            onClick={event => event.stopPropagation()}
          >
            <div className="aspect-video">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube-nocookie.com/embed/whnIsff4K80?autoplay=1"
                title={t.tutorial}
                style={{ border: 0 }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-full text-white text-sm font-bold shadow-xl z-50"
          style={{ background: 'var(--om-cta-bg)' }}
        >
          {notice}
        </div>
      )}
    </div>
  )
}
