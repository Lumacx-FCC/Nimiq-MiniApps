/**
 * Video Generation — 8-second clips of saved characters via
 * gemini-omni-flash-preview (Interactions API, server-proxied). 100 credits
 * per video; up to 3 free conversational edits refine the same clip through
 * previous_interaction_id. Gallery persists in IndexedDB.
 */
import { Camera, Download, MessageSquarePlus, RefreshCw, Save, Share2, Trash2, Video, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { apiUrl } from '../core/api'
import { credits as creditsApi, useCredits } from '../core/credits'
import { VIDEO_CREDITS, VIDEO_MAX_EDITS } from '../core/config'
import { compileVideoPrompt } from '../character/fields'
import { compressImageDataUrl, downloadDataUrl, listSheets, shareDataUrl } from '../character/library'
import { SavedScene, SavedVideo, deleteMedia, listMedia, saveMedia } from '../core/mediaStore'
import AppHeader from '../components/AppHeader'
import CollapsibleCard from '../components/CollapsibleCard'
import ReferencePicker, { PickedReference } from '../components/ReferencePicker'
import ErrorNotice from '../components/ErrorNotice'
import MicButton from '../components/MicButton'

function splitDataUrl(dataUrl: string): { base64: string, mimeType: string } {
  const [header, base64] = dataUrl.split(',')
  return { base64, mimeType: header.match(/data:(.*?);/)?.[1] || 'image/png' }
}

const VIDEO_REFERENCE_KEY = 'otherme:video-reference'

const COPY = {
  en: {
    title: 'Video Creator',
    pickCharacter: 'Character',
    noCharacter: 'No character (free prompt)',
    noneSaved: 'No saved characters yet — create one first and press Save.',
    goCreate: 'Create a character',
    describe: 'Scene action',
    placeholder: 'e.g. Walking slowly through a crowded market, checking over their shoulder with intense suspicion',
    generate: `Generate Video · ${VIDEO_CREDITS} credits`,
    generating: 'Filming your clip (this takes a minute)…',
    insufficient: `You need ${VIDEO_CREDITS} credits to generate a video`,
    result: 'Your video',
    editTitle: (used: number) => `Conversational edit (${used}/${VIDEO_MAX_EDITS} used, free)`,
    editPlaceholder: 'e.g. Make it night time and add heavy rainfall',
    editButton: 'Apply edit',
    editsExhausted: 'All 3 edits used — generate a new video to continue.',
    save: 'Save',
    saved: 'Saved to your video gallery',
    share: 'Share',
    download: 'Download',
    snapshot: 'Snapshot',
    snapshotName: 'Snapshot',
    snapshotSaved: 'Frame saved to your scenes — use it as a reference anytime.',
    gallery: 'My videos',
    empty: 'No videos yet — describe an action above and generate.',
    failed: 'Video generation failed',
    clipSpec: '~8-second cinematic clip · Gemini Omni Flash',
  },
  es: {
    title: 'Creador de Videos',
    pickCharacter: 'Personaje',
    noCharacter: 'Sin personaje (prompt libre)',
    noneSaved: 'Aún no hay personajes guardados — crea uno primero y presiona Guardar.',
    goCreate: 'Crear un personaje',
    describe: 'Acción de la escena',
    placeholder: 'ej. Caminando lentamente por un mercado, mirando sobre su hombro con sospecha',
    generate: `Generar Video · ${VIDEO_CREDITS} créditos`,
    generating: 'Filmando tu clip (toma un minuto)…',
    insufficient: `Necesitas ${VIDEO_CREDITS} créditos para generar un video`,
    result: 'Tu video',
    editTitle: (used: number) => `Edición conversacional (${used}/${VIDEO_MAX_EDITS} usadas, gratis)`,
    editPlaceholder: 'ej. Hazlo de noche y agrega lluvia intensa',
    editButton: 'Aplicar edición',
    editsExhausted: 'Las 3 ediciones usadas — genera un nuevo video para continuar.',
    save: 'Guardar',
    saved: 'Guardado en tu galería de videos',
    share: 'Compartir',
    download: 'Descargar',
    snapshot: 'Captura',
    snapshotName: 'Captura',
    snapshotSaved: 'Fotograma guardado en tus escenas — úsalo como referencia cuando quieras.',
    gallery: 'Mis videos',
    empty: 'Aún no hay videos — describe una acción arriba y genera.',
    failed: 'Falló la generación del video',
    clipSpec: 'Clip cinematográfico de ~8s · Gemini Omni Flash',
  },
} as const

export default function Videos() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const { balance } = useCredits()

  const characters = useMemo(() => listSheets(), [])
  const state = (location.state || {}) as { characterId?: string, seedPrompt?: string }
  const [references, setReferences] = useState<PickedReference[]>(() => {
    const initial: PickedReference[] = []
    // Scene → Video handoff: the generated scene image rides along as a reference.
    let sceneHandoff = false
    try {
      const raw = sessionStorage.getItem(VIDEO_REFERENCE_KEY)
      if (raw) {
        sessionStorage.removeItem(VIDEO_REFERENCE_KEY)
        const { imageDataUrl, name } = JSON.parse(raw) as { imageDataUrl: string, name?: string }
        if (imageDataUrl) {
          initial.push({ id: `scene-${Date.now().toString(36)}`, name: name || 'Scene', imageDataUrl, kind: 'scene' })
          sceneHandoff = true
        }
      }
    }
    catch { /* malformed handoff — ignore */ }
    // Only auto-attach a default character when no scene image came along.
    const sheetId = state.characterId ?? (sceneHandoff ? undefined : characters[0]?.id)
    const sheet = characters.find(item => item.id === sheetId)
    if (sheet?.imageDataUrl)
      initial.unshift({ id: sheet.id, name: sheet.name, imageDataUrl: sheet.imageDataUrl, sheet })
    return initial
  })
  const [action, setAction] = useState(state.seedPrompt ?? '')
  const [isGenerating, setIsGenerating] = useState(false)
  const [current, setCurrent] = useState<{ dataUrl: string, interactionId: string | null, editsUsed: number } | null>(null)
  const [editText, setEditText] = useState('')
  const [gallery, setGallery] = useState<SavedVideo[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [savedScenes, setSavedScenes] = useState<SavedScene[]>([])
  const [notice, setNotice] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  // Which video is being shared (re-encoding the footer runs ~clip length).
  const [sharingKey, setSharingKey] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  async function shareVideo(dataUrl: string, filename: string, key: string): Promise<void> {
    setSharingKey(key)
    try {
      await shareDataUrl(dataUrl, filename, { footer: true })
    }
    finally {
      setSharingKey(null)
    }
  }

  /**
   * Capture the current video frame (pause first for a clean grab) and save it
   * as a Scene — so a great still becomes a reusable reference for another video
   * or a scene edit. Same-origin data URL → canvas is taint-free.
   */
  async function snapshot(): Promise<void> {
    const v = videoRef.current
    if (!v || !v.videoWidth)
      return
    v.pause()
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height)
    const imageDataUrl = await compressImageDataUrl(canvas.toDataURL('image/webp', 0.92))
    const scene: SavedScene = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: `${t.snapshotName} ${new Date().toLocaleTimeString()}`,
      characterName: null,
      prompt: action.trim() || 'Video snapshot',
      imageDataUrl,
      savedAt: new Date().toISOString(),
    }
    await saveMedia('scenes', scene)
    setSavedScenes(await listMedia<SavedScene>('scenes'))
    setNotice({ text: t.snapshotSaved, type: 'success' })
  }

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/videos', noticeKey: 'unlockFeature' } })
  }, [isLoggedIn, navigate, lang])

  useEffect(() => {
    listMedia<SavedVideo>('videos').then(setGallery).catch(() => setGallery([]))
    listMedia<SavedScene>('scenes').then(setSavedScenes).catch(() => setSavedScenes([]))
  }, [])

  const flash = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type })
    // Errors render as the ErrorNotice modal — dismiss on click only, so the
    // user has time to actually read it instead of a timer clearing it early.
    if (type !== 'error')
      window.setTimeout(() => setNotice(null), 4500)
  }

  const buildPrompt = () => {
    const firstSheet = references.find(reference => reference.sheet)?.sheet
    const base = firstSheet
      ? compileVideoPrompt(firstSheet.data, action.trim())
      : `Cinematic video scene: ${action.trim()}`
    const subjectRefs = references.filter(reference => reference.kind !== 'scene')
    const sceneRef = references.find(reference => reference.kind === 'scene')
    const anchor = subjectRefs.length
      ? `\nPreserve the exact identity, appearance and styling of every subject shown in the ${subjectRefs.length} attached character reference image${subjectRefs.length === 1 ? '' : 's'}.`
      : ''
    const setting = sceneRef
      ? `\nUse the attached scene image as the setting: match its location, lighting, color palette and mood throughout the shot.`
      : ''
    return `${base}${anchor}${setting}\nDuration: approximately 8 seconds. Single continuous cinematic shot.`
  }

  const callVideoApi = async (prompt: string, previousInteractionId: string | null) => {
    const payload: Record<string, unknown> = { prompt }
    if (previousInteractionId)
      payload.previousInteractionId = previousInteractionId
    else if (references.length)
      payload.referenceImages = references.map(reference => splitDataUrl(reference.imageDataUrl))
    const response = await fetch(apiUrl('/api/generate-video'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await response.json()
    if (!response.ok || !json.videoBase64)
      throw new Error(json.error || 'Generation failed')
    return { dataUrl: `data:${json.mimeType || 'video/mp4'};base64,${json.videoBase64}`, interactionId: json.interactionId as string | null }
  }

  const generate = async () => {
    if (!action.trim())
      return
    if (creditsApi.balance < VIDEO_CREDITS)
      return flash(t.insufficient, 'error')
    setIsGenerating(true)
    try {
      const { dataUrl, interactionId } = await callVideoApi(buildPrompt(), null)
      creditsApi.spend(VIDEO_CREDITS)
      setCurrent({ dataUrl, interactionId, editsUsed: 0 })
      setEditText('')
    }
    catch (error) {
      flash(`${t.failed}: ${error instanceof Error ? error.message : error}`, 'error')
    }
    finally {
      setIsGenerating(false)
    }
  }

  const applyEdit = async () => {
    if (!current || !editText.trim() || current.editsUsed >= VIDEO_MAX_EDITS)
      return
    setIsGenerating(true)
    try {
      const { dataUrl, interactionId } = await callVideoApi(editText.trim(), current.interactionId)
      setCurrent({ dataUrl, interactionId, editsUsed: current.editsUsed + 1 })
      setEditText('')
    }
    catch (error) {
      flash(`${t.failed}: ${error instanceof Error ? error.message : error}`, 'error')
    }
    finally {
      setIsGenerating(false)
    }
  }

  const saveVideo = async () => {
    if (!current)
      return
    const video: SavedVideo = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: action.trim().slice(0, 60) || 'Video',
      characterName: references.map(reference => reference.name).join(', ') || null,
      prompt: action.trim(),
      videoDataUrl: current.dataUrl,
      interactionId: current.interactionId,
      editsUsed: current.editsUsed,
      savedAt: new Date().toISOString(),
    }
    try {
      await saveMedia('videos', video)
      setGallery(await listMedia<SavedVideo>('videos'))
      flash(t.saved)
    }
    catch {
      flash(t.failed, 'error')
    }
  }

  const removeVideo = async (id: string) => {
    await deleteMedia('videos', id).catch(() => undefined)
    setGallery(await listMedia<SavedVideo>('videos'))
  }

  return (
    <div className="page-shell wide">
      <AppHeader title={t.title} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="om-card">
            <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.pickCharacter}</h2>
            {!characters.length && <p className="text-sm mb-3" style={{ color: 'var(--text-60)' }}>{t.noneSaved} <button className="bg-transparent border-none underline cursor-pointer font-bold p-0" style={{ color: 'var(--om-teal)' }} onClick={() => navigate('/create')}>{t.goCreate}</button></p>}
            <ReferencePicker characters={characters} scenes={savedScenes} value={references} onChange={setReferences} lang={lang} />
          </section>

          <section className="om-card">
            <h2 className="text-sm font-extrabold uppercase tracking-widest mb-1" style={{ color: 'var(--text-40)' }}>{t.describe}</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-40)' }}>{t.clipSpec}</p>
            <div className="relative">
              <textarea
                className="w-full rounded-xl p-3 pr-10 text-sm resize-y min-h-[90px] outline-none"
                style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
                value={action}
                placeholder={t.placeholder}
                onChange={e => setAction(e.target.value)}
              />
              <MicButton
                lang={lang}
                className="absolute top-2 right-2 icon-chip !min-h-0 !min-w-0 !p-1.5"
                onStart={() => setAction('')}
                onResult={text => setAction(current => (current ? `${current} ${text}` : text))}
              />
            </div>
            <button className="om-button w-full mt-4" disabled={isGenerating || !action.trim()} onClick={generate}>
              {isGenerating ? <RefreshCw size={17} className="animate-spin" /> : <Wand2 size={17} />}
              {isGenerating ? t.generating : t.generate}
            </button>
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-40)' }}>
              {lang === 'es' ? 'Saldo' : 'Balance'}: {balance} · {t.editTitle(0)}
            </p>
          </section>

          {current && (
            <section className="om-card">
              <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.result}</h2>
              <video ref={videoRef} src={current.dataUrl} controls playsInline className="w-full rounded-xl shadow-lg" />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="om-button green flex-1 !min-h-[42px] !text-sm" onClick={saveVideo}><Save size={15} />{t.save}</button>
                <button className="icon-chip" onClick={() => downloadDataUrl(current.dataUrl, 'otherme-video.mp4')}><Download size={14} />{t.download}</button>
                <button className="icon-chip" disabled={sharingKey === 'current'} onClick={() => void shareVideo(current.dataUrl, 'otherme-video.mp4', 'current')}>
                  {sharingKey === 'current' ? <RefreshCw size={14} className="animate-spin" /> : <Share2 size={14} />}{t.share}
                </button>
                <button className="icon-chip" onClick={() => void snapshot()} title={t.snapshot}><Camera size={14} />{t.snapshot}</button>
              </div>

              <div className="mt-4">
                <h3 className="text-[11px] font-extrabold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-60)' }}>
                  <MessageSquarePlus size={13} />{t.editTitle(current.editsUsed)}
                </h3>
                {current.editsUsed < VIDEO_MAX_EDITS && current.interactionId
                  ? (
                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded-xl p-2.5 text-sm outline-none"
                          style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
                          value={editText}
                          placeholder={t.editPlaceholder}
                          onChange={e => setEditText(e.target.value)}
                          disabled={isGenerating}
                        />
                        <button className="om-button blue !min-h-[40px] !text-xs !px-4" disabled={isGenerating || !editText.trim()} onClick={applyEdit}>
                          {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : t.editButton}
                        </button>
                      </div>
                    )
                  : <p className="text-xs" style={{ color: 'var(--text-40)' }}>{t.editsExhausted}</p>}
              </div>
            </section>
          )}
        </div>

        <CollapsibleCard
          title={t.gallery}
          open={galleryOpen}
          onToggle={() => setGalleryOpen(!galleryOpen)}
          icon={<Video size={14} className="shrink-0" />}
          className="h-fit min-w-0"
        >
          {!gallery.length && <p className="text-sm" style={{ color: 'var(--text-40)' }}>{t.empty}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[560px] overflow-y-auto pr-1">
            {gallery.map(video => (
              <div key={video.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--highlight-bg)' }}>
                <video src={video.videoDataUrl} controls className="w-full max-h-64" />
                <div className="p-2 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold truncate m-0">{video.name}</p>
                    {video.characterName && <p className="text-[10px] m-0" style={{ color: 'var(--text-40)' }}>{video.characterName}</p>}
                  </div>
                  <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" onClick={() => downloadDataUrl(video.videoDataUrl, `${video.name.replace(/\s+/g, '-')}.mp4`)}><Download size={12} /></button>
                  <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" disabled={sharingKey === video.id} onClick={() => void shareVideo(video.videoDataUrl, `${video.name.replace(/\s+/g, '-')}.mp4`, video.id)}>
                    {sharingKey === video.id ? <RefreshCw size={12} className="animate-spin" /> : <Share2 size={12} />}
                  </button>
                  <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" onClick={() => void removeVideo(video.id)}><Trash2 size={12} style={{ color: 'var(--nimiq-red)' }} /></button>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>

      {notice && notice.type === 'error'
        ? <ErrorNotice message={notice.text} lang={lang} onClose={() => setNotice(null)} />
        : notice && (
          <div className={`nq-notice ${notice.type} fixed bottom-6 left-1/2 -translate-x-1/2 z-50 shadow-xl max-w-md`} role="status" style={{ background: 'var(--nq-card)' }}>
            {notice.text}
          </div>
          )}
    </div>
  )
}
