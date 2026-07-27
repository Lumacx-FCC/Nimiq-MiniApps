/**
 * Scene Generation — cinematic images of saved characters via gpt-image-2
 * (character sheet image goes along as identity reference). 5 free scenes,
 * then 5 credits each. Gallery persists in IndexedDB.
 */
import { Clapperboard, Download, RefreshCw, Save, Share2, Trash2, Video, Wand2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { apiUrl } from '../core/api'
import { credits as creditsApi, useCredits } from '../core/credits'
import { FREE_SCENE_GENERATIONS, SCENE_CREDITS } from '../core/config'
import { RenderStyle, styleDirective } from '../character/fields'
import { downloadDataUrl, listSheets, shareDataUrl } from '../character/library'
import { SavedScene, deleteMedia, listMedia, saveMedia } from '../core/mediaStore'
import AppHeader from '../components/AppHeader'
import CollapsibleCard from '../components/CollapsibleCard'
import Lightbox from '../components/Lightbox'
import ReferencePicker, { PickedReference } from '../components/ReferencePicker'

const FREE_SCENES_KEY = 'otherme:free-scenes'
const VIDEO_REFERENCE_KEY = 'otherme:video-reference'

const COPY = {
  en: {
    title: 'Scene Creator',
    pickCharacter: 'Character',
    noCharacter: 'No character (scene only)',
    noneSaved: 'No saved characters yet — create one first and press Save.',
    goCreate: 'Create a character',
    describe: 'Describe the scene',
    placeholder: 'e.g. Standing on a cliff at dawn, wind in their coat, ruins burning in the valley below',
    styleTitle: 'Render style',
    generate: `Generate Scene`,
    generating: 'Painting the scene…',
    freeLeft: (n: number) => `${n} free scene${n === 1 ? '' : 's'} left`,
    thenCost: `then ${SCENE_CREDITS} credits each`,
    cost: `${SCENE_CREDITS} credits`,
    insufficient: `You need ${SCENE_CREDITS} credits to generate a scene`,
    result: 'Your scene',
    save: 'Save',
    share: 'Share',
    saved: 'Saved to your scene gallery',
    download: 'Download',
    makeVideo: 'Animate as video',
    gallery: 'My scenes',
    empty: 'No scenes yet — describe one above and generate.',
    failed: 'Scene generation failed',
    styleRealistic: 'Realistic',
    styleAnimated: 'Animated',
    styleCustom: 'Custom',
    stylePlaceholder: 'One-line style description',
  },
  es: {
    title: 'Creador de Escenas',
    pickCharacter: 'Personaje',
    noCharacter: 'Sin personaje (solo escena)',
    noneSaved: 'Aún no hay personajes guardados — crea uno primero y presiona Guardar.',
    goCreate: 'Crear un personaje',
    describe: 'Describe la escena',
    placeholder: 'ej. De pie en un acantilado al amanecer, viento en su abrigo, ruinas ardiendo en el valle',
    styleTitle: 'Estilo de render',
    generate: 'Generar Escena',
    generating: 'Pintando la escena…',
    freeLeft: (n: number) => `${n} escena${n === 1 ? '' : 's'} gratis restante${n === 1 ? '' : 's'}`,
    thenCost: `luego ${SCENE_CREDITS} créditos c/u`,
    cost: `${SCENE_CREDITS} créditos`,
    insufficient: `Necesitas ${SCENE_CREDITS} créditos para generar una escena`,
    result: 'Tu escena',
    save: 'Guardar',
    share: 'Compartir',
    saved: 'Guardada en tu galería de escenas',
    download: 'Descargar',
    makeVideo: 'Animar como video',
    gallery: 'Mis escenas',
    empty: 'Aún no hay escenas — describe una arriba y genera.',
    failed: 'Falló la generación de la escena',
    styleRealistic: 'Realista',
    styleAnimated: 'Animado',
    styleCustom: 'Personalizado',
    stylePlaceholder: 'Descripción de estilo en una línea',
  },
} as const

function splitDataUrl(dataUrl: string): { base64: string, mimeType: string } {
  const [header, base64] = dataUrl.split(',')
  return { base64, mimeType: header.match(/data:(.*?);/)?.[1] || 'image/png' }
}

function compileScenePrompt(references: PickedReference[], description: string, style: RenderStyle): string {
  const anchors = references
    .filter(reference => reference.sheet)
    .map(reference => `- ${reference.sheet!.data.name} (${reference.sheet!.data.alias}): ${reference.sheet!.data.eyes} eyes; ${reference.sheet!.data.hair} hair; build: ${reference.sheet!.data.build}; wearing ${reference.sheet!.data.garment1}.`)
  const identity = references.length
    ? `FEATURED SUBJECTS: preserve the exact identity, face, proportions, costume and styling of every subject shown in the ${references.length} reference image${references.length === 1 ? '' : 's'} — no reinterpretation.${anchors.length ? `\nAppearance anchors:\n${anchors.join('\n')}` : ''}`
    : 'No specific character — compose the scene freely.'
  return `Create ONE cinematic scene illustration, film-frame quality, production-ready.
${identity}
SCENE: ${description}
COMPOSITION: intentional cinematic framing, dramatic lighting, rich atmosphere, high detail, coherent perspective. Single image, no text, no panels, no borders.
${styleDirective(style)}`
}

export default function Scenes() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoggedIn } = useAuth()
  const { balance } = useCredits()

  const characters = useMemo(() => listSheets(), [])
  const preselect = (location.state as { characterId?: string } | null)?.characterId
  const [references, setReferences] = useState<PickedReference[]>(() => {
    const sheet = characters.find(item => item.id === (preselect ?? characters[0]?.id))
    return sheet?.imageDataUrl ? [{ id: sheet.id, name: sheet.name, imageDataUrl: sheet.imageDataUrl, sheet }] : []
  })
  const [description, setDescription] = useState('')
  const [renderStyle, setRenderStyle] = useState<RenderStyle>({ mode: 'animated', customText: '' })
  const [isGenerating, setIsGenerating] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [gallery, setGallery] = useState<SavedScene[]>([])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [notice, setNotice] = useState<{ text: string, type: 'success' | 'error' } | null>(null)
  const [lightbox, setLightbox] = useState<{ src: string, alt: string } | null>(null)
  const [freeUsed, setFreeUsed] = useState(() => {
    const value = Number(localStorage.getItem(FREE_SCENES_KEY))
    return Number.isFinite(value) && value >= 0 ? value : 0
  })

  const freeLeft = Math.max(0, FREE_SCENE_GENERATIONS - freeUsed)

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/scenes', notice: lang === 'es' ? 'Inicia sesión primero para desbloquear esta función' : 'Log in first to unlock this feature' } })
  }, [isLoggedIn, navigate, lang])

  useEffect(() => {
    listMedia<SavedScene>('scenes').then(setGallery).catch(() => setGallery([]))
  }, [])

  const flash = (text: string, type: 'success' | 'error' = 'success') => {
    setNotice({ text, type })
    window.setTimeout(() => setNotice(null), 4000)
  }

  const generate = async () => {
    if (!description.trim())
      return
    const usingFree = freeLeft > 0
    if (!usingFree && creditsApi.balance < SCENE_CREDITS)
      return flash(t.insufficient, 'error')

    setIsGenerating(true)
    setResult(null)
    try {
      const payload: Record<string, unknown> = { prompt: compileScenePrompt(references, description.trim(), renderStyle) }
      if (references.length)
        payload.referenceImages = references.map(reference => splitDataUrl(reference.imageDataUrl))
      const response = await fetch(apiUrl('/api/generate-sheet'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await response.json()
      if (!response.ok || !json.imageBase64)
        throw new Error(json.error || 'Generation failed')
      setResult(`data:${json.mimeType || 'image/webp'};base64,${json.imageBase64}`)
      if (usingFree) {
        const next = freeUsed + 1
        setFreeUsed(next)
        localStorage.setItem(FREE_SCENES_KEY, String(next))
      }
      else {
        creditsApi.spend(SCENE_CREDITS)
      }
    }
    catch (error) {
      flash(`${t.failed}: ${error instanceof Error ? error.message : error}`, 'error')
    }
    finally {
      setIsGenerating(false)
    }
  }

  const saveScene = async () => {
    if (!result)
      return
    const scene: SavedScene = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: description.trim().slice(0, 60) || 'Scene',
      characterName: references.map(reference => reference.name).join(', ') || null,
      prompt: description.trim(),
      imageDataUrl: result,
      savedAt: new Date().toISOString(),
    }
    try {
      await saveMedia('scenes', scene)
      setGallery(await listMedia<SavedScene>('scenes'))
      flash(t.saved)
    }
    catch {
      flash(t.failed, 'error')
    }
  }

  const removeScene = async (id: string) => {
    await deleteMedia('scenes', id).catch(() => undefined)
    setGallery(await listMedia<SavedScene>('scenes'))
  }

  const toVideo = (scene?: SavedScene) => {
    const firstCharacter = references.find(reference => reference.sheet)
    // Carry the scene image itself into the video creator as a reference.
    const imageDataUrl = scene?.imageDataUrl ?? result
    if (imageDataUrl) {
      try {
        sessionStorage.setItem(VIDEO_REFERENCE_KEY, JSON.stringify({
          imageDataUrl,
          name: scene?.name || description.trim().slice(0, 40) || 'Scene',
        }))
      }
      catch { /* image too large for sessionStorage — the picker lets them re-attach */ }
    }
    navigate('/videos', { state: { characterId: firstCharacter?.id ?? null, seedPrompt: scene?.prompt ?? description.trim() } })
  }

  return (
    <div className="page-shell wide">
      <AppHeader title={t.title} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <section className="om-card">
            <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.pickCharacter}</h2>
            {!characters.length && <p className="text-sm mb-3" style={{ color: 'var(--text-60)' }}>{t.noneSaved} <button className="bg-transparent border-none underline cursor-pointer font-bold p-0" style={{ color: 'var(--om-teal)' }} onClick={() => navigate('/create')}>{t.goCreate}</button></p>}
            <ReferencePicker characters={characters} value={references} onChange={setReferences} lang={lang} />
          </section>

          <section className="om-card">
            <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.describe}</h2>
            <textarea
              className="w-full rounded-xl p-3 text-sm resize-y min-h-[90px] outline-none"
              style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
              value={description}
              placeholder={t.placeholder}
              onChange={e => setDescription(e.target.value)}
            />
            <h3 className="text-[11px] font-extrabold uppercase tracking-wider mt-4 mb-2" style={{ color: 'var(--text-60)' }}>{t.styleTitle}</h3>
            <div className="flex gap-1.5 flex-wrap">
              {([['realistic', t.styleRealistic], ['animated', t.styleAnimated], ['custom', t.styleCustom]] as const).map(([mode, label]) => (
                <button
                  key={mode}
                  className="px-3 py-1.5 rounded-full text-xs font-bold"
                  style={renderStyle.mode === mode
                    ? { background: 'var(--om-cta-bg)', color: '#fff' }
                    : { background: 'var(--highlight-bg)', color: 'var(--text-60)' }}
                  onClick={() => setRenderStyle({ ...renderStyle, mode })}
                >
                  {label}
                </button>
              ))}
            </div>
            {renderStyle.mode === 'custom' && (
              <input
                className="w-full rounded-xl p-2.5 text-sm outline-none mt-2"
                style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
                value={renderStyle.customText}
                placeholder={t.stylePlaceholder}
                maxLength={160}
                onChange={e => setRenderStyle({ ...renderStyle, customText: e.target.value })}
              />
            )}

            <button className="om-button w-full mt-4" disabled={isGenerating || !description.trim()} onClick={generate}>
              {isGenerating ? <RefreshCw size={17} className="animate-spin" /> : <Wand2 size={17} />}
              {isGenerating ? t.generating : `${t.generate}${freeLeft > 0 ? '' : ` · ${t.cost}`}`}
            </button>
            <p className="text-xs text-center mt-2 font-bold" style={{ color: freeLeft > 0 ? 'var(--om-teal)' : 'var(--text-40)' }}>
              {freeLeft > 0 ? `${t.freeLeft(freeLeft)} — ${t.thenCost}` : `${t.cost} · ${lang === 'es' ? 'saldo' : 'balance'}: ${balance}`}
            </p>
          </section>

          {result && (
            <section className="om-card">
              <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.result}</h2>
              <img
                src={result}
                alt="Generated scene"
                className="w-full h-auto rounded-xl shadow-lg cursor-zoom-in"
                onClick={() => setLightbox({ src: result, alt: description.trim() || 'Generated scene' })}
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="om-button green flex-1 !min-h-[42px] !text-sm" onClick={saveScene}><Save size={15} />{t.save}</button>
                <button className="icon-chip" onClick={() => downloadDataUrl(result, 'otherme-scene.webp')}><Download size={14} />{t.download}</button>
                <button className="icon-chip" onClick={() => void shareDataUrl(result, 'otherme-scene.webp', { footer: true })}><Share2 size={14} />{t.share}</button>
                <button className="icon-chip" onClick={() => toVideo()}><Video size={14} />{t.makeVideo}</button>
              </div>
            </section>
          )}
        </div>

        <CollapsibleCard
          title={t.gallery}
          open={galleryOpen}
          onToggle={() => setGalleryOpen(!galleryOpen)}
          icon={<Clapperboard size={14} className="shrink-0" />}
          className="h-fit"
        >
          {!gallery.length && <p className="text-sm" style={{ color: 'var(--text-40)' }}>{t.empty}</p>}
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 max-h-[540px] overflow-y-auto pr-1">
            {gallery.map(scene => (
              <div key={scene.id} className="rounded-xl overflow-hidden" style={{ background: 'var(--highlight-bg)' }}>
                <img
                  src={scene.imageDataUrl}
                  alt={scene.name}
                  className="w-full h-28 object-cover cursor-zoom-in"
                  onClick={() => setLightbox({ src: scene.imageDataUrl, alt: scene.name })}
                />
                <div className="p-2">
                  <p className="text-[11px] font-bold truncate m-0">{scene.name}</p>
                  {scene.characterName && <p className="text-[10px] m-0" style={{ color: 'var(--text-40)' }}>{scene.characterName}</p>}
                  <div className="flex gap-1 mt-1.5">
                    <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" onClick={() => downloadDataUrl(scene.imageDataUrl, `${scene.name.replace(/\s+/g, '-')}.webp`)}><Download size={12} /></button>
                    <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" onClick={() => void shareDataUrl(scene.imageDataUrl, `${scene.name.replace(/\s+/g, '-')}.webp`, { footer: true })}><Share2 size={12} /></button>
                    <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" onClick={() => toVideo(scene)}><Video size={12} /></button>
                    <button className="icon-chip !min-h-[28px] !min-w-0 !px-2" onClick={() => void removeScene(scene.id)}><Trash2 size={12} style={{ color: 'var(--nimiq-red)' }} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      </div>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {notice && (
        <div className={`nq-notice ${notice.type} fixed bottom-6 left-1/2 -translate-x-1/2 z-50 shadow-xl max-w-md`} role="status" style={{ background: 'var(--nq-card)' }}>
          {notice.text}
        </div>
      )}
    </div>
  )
}
