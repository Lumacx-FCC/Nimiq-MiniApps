/**
 * Character Creation Studio — port of the character design sheet prompt
 * generator onto Other Me styling (theme-aware via CSS variables).
 *
 * Changes vs the original:
 *  - Gemini/Imagen browser calls -> server proxies (/api/analyze-character,
 *    /api/generate-sheet with gpt-image-2), no user API key.
 *  - 5 free image generations for anonymous users, then login gate.
 *  - Save to local library + download image/JSON; "Talk with this character"
 *    bridge into the roleplay studio.
 */
import {
  Clapperboard, Copy, Download, MessageCircle, RefreshCw, RotateCcw, Save,
  Share2, Sparkles, Trash2, Upload, Video, Wand2,
} from 'lucide-react'
import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { apiUrl } from '../core/api'
import { credits as creditsApi, useCredits } from '../core/credits'
import { FREE_SHEET_GENERATIONS, SHEET_RENDER_CREDITS } from '../core/config'
import AppHeader from '../components/AppHeader'
import CollapsibleCard from '../components/CollapsibleCard'
import {
  CharacterSheet, DEFAULT_SHEET, PRESETS, RenderStyle, SECTIONS,
  compileSheetPrompt, compileVideoPrompt, styleDirective,
} from '../character/fields'
import { SavedSheet, compressImageDataUrl, deleteSheet, downloadDataUrl, listSheets, saveSheet, shareDataUrl } from '../character/library'
import Lightbox from '../components/Lightbox'
import ErrorNotice from '../components/ErrorNotice'
import MicButton from '../components/MicButton'

const FREE_COUNT_KEY = 'otherme:free-generations'
const PENDING_REFERENCE_KEY = 'otherme:pending-reference'

const COPY = {
  en: {
    title: 'Character Creator',
    step1: 'Reference image',
    uploadCta: 'Upload reference',
    uploadHint: 'Portrait, sketch or concept — PNG, JPG, WEBP',
    replace: 'Replace',
    analyze: 'Analyze with AI',
    analyzing: 'Analyzing…',
    analyzeHelp: 'The AI reads your image and fills the whole design sheet below.',
    presets: 'Presets',
    fields: 'Design sheet',
    prompt: 'Compiled prompt',
    copy: 'Copy',
    copied: 'Copied!',
    generate: 'Generate Character Sheet image',
    generating: 'Rendering your sheet…',
    freeLeft: (n: number) => `${n} free generation${n === 1 ? '' : 's'} left`,
    freeOver: 'Free generations used — log in to continue',
    loginToContinue: 'Log in to continue',
    result: 'Your Character Sheet',
    save: 'Save',
    saved: 'Saved to your library',
    saveFailed: 'This device’s app storage is full — delete an old character below, or use Image to save the sheet to your phone (you can re-upload it later as a reference).',
    downloadImg: 'Image',
    share: 'Share',
    costPerRender: (balance: number) => `${SHEET_RENDER_CREDITS} credit per render · balance: ${balance}`,
    insufficientCredits: 'Not enough credits — top up to keep rendering',
    talk: 'Talk with this character',
    library: 'My characters',
    empty: 'Nothing saved yet — generate a sheet and press Save.',
    videoTitle: 'Video prompt (bonus)',
    videoAction: 'Scene action',
    videoHelp: 'Copy into Sora, Runway or Luma to animate your character.',
    analysisFailed: 'Analysis failed',
    generationFailed: 'Generation failed',
    styleTitle: 'Render style',
    styleRealistic: 'Realistic',
    styleAnimated: 'Animated',
    styleCustom: 'Custom',
    stylePlaceholder: 'Describe your style in one line, e.g. "90s anime cel-shaded look"',
    createScene: 'Create Scene',
    createVideo: 'Create Video',
    loginFirstFeature: 'Log in first to unlock this feature',
  },
  es: {
    title: 'Creador de Personajes',
    step1: 'Imagen de referencia',
    uploadCta: 'Subir referencia',
    uploadHint: 'Retrato, boceto o concepto — PNG, JPG, WEBP',
    replace: 'Reemplazar',
    analyze: 'Analizar con IA',
    analyzing: 'Analizando…',
    analyzeHelp: 'La IA lee tu imagen y completa toda la hoja de diseño.',
    presets: 'Presets',
    fields: 'Hoja de diseño',
    prompt: 'Prompt compilado',
    copy: 'Copiar',
    copied: '¡Copiado!',
    generate: 'Generar imagen del Character Sheet',
    generating: 'Renderizando tu hoja…',
    freeLeft: (n: number) => `${n} generación${n === 1 ? '' : 'es'} gratis restante${n === 1 ? '' : 's'}`,
    freeOver: 'Generaciones gratis agotadas — inicia sesión para continuar',
    loginToContinue: 'Iniciar sesión para continuar',
    result: 'Tu Character Sheet',
    save: 'Guardar',
    saved: 'Guardado en tu biblioteca',
    saveFailed: 'El almacenamiento de la app está lleno — elimina un personaje antiguo abajo, o usa Imagen para guardar la hoja en tu teléfono (puedes resubirla luego como referencia).',
    downloadImg: 'Imagen',
    share: 'Compartir',
    costPerRender: (balance: number) => `${SHEET_RENDER_CREDITS} crédito por render · saldo: ${balance}`,
    insufficientCredits: 'No tienes créditos suficientes — recarga para seguir renderizando',
    talk: 'Hablar con este personaje',
    library: 'Mis personajes',
    empty: 'Nada guardado aún — genera una hoja y presiona Guardar.',
    videoTitle: 'Prompt de video (bonus)',
    videoAction: 'Acción de la escena',
    videoHelp: 'Cópialo en Sora, Runway o Luma para animar tu personaje.',
    analysisFailed: 'Falló el análisis',
    generationFailed: 'Falló la generación',
    styleTitle: 'Estilo de render',
    styleRealistic: 'Realista',
    styleAnimated: 'Animado',
    styleCustom: 'Personalizado',
    stylePlaceholder: 'Describe tu estilo en una línea, ej. "look anime 90s cel-shaded"',
    createScene: 'Crear Escena',
    createVideo: 'Crear Video',
    loginFirstFeature: 'Inicia sesión primero para desbloquear esta función',
  },
} as const

function splitDataUrl(dataUrl: string): { base64: string, mimeType: string } {
  const [header, base64] = dataUrl.split(',')
  return { base64, mimeType: header.match(/data:(.*?);/)?.[1] || 'image/png' }
}

function readFreeCount(): number {
  const value = Number(localStorage.getItem(FREE_COUNT_KEY))
  return Number.isFinite(value) && value >= 0 ? value : 0
}

export default function CharacterStudio() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()
  const { balance } = useCredits()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [image, setImage] = useState<string | null>(() => sessionStorage.getItem(PENDING_REFERENCE_KEY))
  const [formData, setFormData] = useState<CharacterSheet>(DEFAULT_SHEET)
  // Cascade flow: each stage reveals the next section.
  const [sheetReady, setSheetReady] = useState(false)
  const [savedThisSession, setSavedThisSession] = useState(false)
  // Which cards are expanded — headers stay visible so the flow reads as an outline.
  const [open, setOpen] = useState({ fields: false, prompt: false, library: true, video: false })
  const [renderStyle, setRenderStyle] = useState<RenderStyle>({ mode: 'animated', customText: '' })
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id)
  const [activePreset, setActivePreset] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImg, setGeneratedImg] = useState<string | null>(null)
  const [videoAction, setVideoAction] = useState('Walking slowly through a crowded market, checking over their shoulder with intense suspicion')
  const [notice, setNotice] = useState<{ text: string, type: 'success' | 'error' | 'info' } | null>(null)
  const [copied, setCopied] = useState<'sheet' | 'video' | null>(null)
  const [freeUsed, setFreeUsed] = useState(readFreeCount)
  const [library, setLibrary] = useState<SavedSheet[]>(listSheets)
  const [lightbox, setLightbox] = useState<{ src: string, alt: string } | null>(null)

  useEffect(() => {
    sessionStorage.removeItem(PENDING_REFERENCE_KEY)
  }, [])

  const compiledPrompt = useMemo(
    () => `${compileSheetPrompt(formData)}\n\n${styleDirective(renderStyle)}`,
    [formData, renderStyle],
  )
  const videoPrompt = useMemo(() => compileVideoPrompt(formData, videoAction), [formData, videoAction])
  const freeLeft = Math.max(0, FREE_SHEET_GENERATIONS - freeUsed)
  const canGenerate = isLoggedIn || freeLeft > 0

  const toggle = (key: keyof typeof open) => setOpen(previous => ({ ...previous, [key]: !previous[key] }))

  const flash = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotice({ text, type })
    // Errors render as the ErrorNotice modal — dismiss on click only, so the
    // user has time to actually read it instead of a timer clearing it early.
    if (type !== 'error')
      window.setTimeout(() => setNotice(null), 4000)
  }

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file)
      return
    const reader = new FileReader()
    reader.onloadend = () => {
      setImage(String(reader.result))
      setActivePreset('')
    }
    reader.readAsDataURL(file)
  }

  const analyze = async () => {
    if (!image)
      return
    setIsAnalyzing(true)
    try {
      const { base64, mimeType } = splitDataUrl(image)
      const response = await fetch(apiUrl('/api/analyze-character'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      })
      const result = await response.json()
      if (!response.ok || !result.sheet)
        throw new Error(result.error || 'Analysis failed')
      setFormData(result.sheet as CharacterSheet)
      setSheetReady(true)
      // Analysis done — show what the AI wrote, get the library out of the way.
      setOpen(previous => ({ ...previous, fields: true, prompt: true, library: false }))
      flash(lang === 'es' ? '¡Análisis completo! Revisa la hoja de diseño.' : 'Analysis complete! Review the design sheet.')
    }
    catch (error) {
      flash(`${t.analysisFailed}: ${error instanceof Error ? error.message : error}`, 'error')
    }
    finally {
      setIsAnalyzing(false)
    }
  }

  const generate = async () => {
    if (!canGenerate) {
      navigate('/login', { state: { notice: t.freeOver, redirectTo: '/create' } })
      return
    }
    if (isLoggedIn && creditsApi.balance < SHEET_RENDER_CREDITS) {
      flash(t.insufficientCredits, 'error')
      return
    }
    setIsGenerating(true)
    setGeneratedImg(null)
    // Free up the screen for the render: only the prompt stays open.
    setOpen(previous => ({ ...previous, fields: false, library: false, prompt: true }))
    try {
      const payload: Record<string, string> = { prompt: compiledPrompt }
      if (image && !image.startsWith('http')) {
        const { base64, mimeType } = splitDataUrl(image)
        payload.referenceImageBase64 = base64
        payload.referenceMimeType = mimeType
      }
      const response = await fetch(apiUrl('/api/generate-sheet'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || !result.imageBase64)
        throw new Error(result.error || 'Generation failed')
      setGeneratedImg(`data:${result.mimeType || 'image/webp'};base64,${result.imageBase64}`)
      if (!isLoggedIn) {
        const next = freeUsed + 1
        setFreeUsed(next)
        localStorage.setItem(FREE_COUNT_KEY, String(next))
      }
      else {
        creditsApi.spend(SHEET_RENDER_CREDITS)
      }
    }
    catch (error) {
      flash(`${t.generationFailed}: ${error instanceof Error ? error.message : error}`, 'error')
    }
    finally {
      setIsGenerating(false)
    }
  }

  const copyText = async (text: string, which: 'sheet' | 'video') => {
    try {
      await navigator.clipboard.writeText(text)
    }
    catch {
      const area = document.createElement('textarea')
      area.value = text
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      document.body.removeChild(area)
    }
    setCopied(which)
    window.setTimeout(() => setCopied(null), 2000)
  }

  const handleSave = async () => {
    const sheet: SavedSheet = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: formData.name || 'Character',
      savedAt: new Date().toISOString(),
      data: formData,
      // Compressed copy for the library (localStorage budget); downloads keep full size.
      imageDataUrl: generatedImg ? await compressImageDataUrl(generatedImg) : null,
    }
    if (saveSheet(sheet)) {
      setLibrary(listSheets())
      setSavedThisSession(true)
      // Saved — point them at the next step, close what they're done with.
      setOpen(previous => ({ ...previous, prompt: false, library: false, video: true }))
      flash(t.saved)
    }
    else {
      flash(t.saveFailed, 'error')
    }
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

  const section = SECTIONS.find(s => s.id === activeSection) || SECTIONS[0]

  return (
    <div className="page-shell wide">
      <AppHeader title={t.title} />

      <div className="grid gap-4 md:grid-cols-2">
        {/* ---- Left: reference + form ---- */}
        <div className="flex flex-col gap-4 min-w-0">
          <section className="om-card">
            <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.step1}</h2>
            <div className="flex flex-col min-[420px]:flex-row gap-4 min-[420px]:items-stretch">
              <div
                className="relative w-32 h-32 shrink-0 rounded-2xl overflow-hidden border-2 border-dashed flex items-center justify-center cursor-pointer"
                style={{ borderColor: 'var(--om-teal)', background: 'var(--highlight-bg)' }}
                onClick={() => fileInputRef.current?.click()}
              >
                {image
                  ? <img src={image} alt="Reference" className="w-full h-full object-cover" />
                  : <Upload size={26} style={{ color: 'var(--om-teal)' }} />}
                {isAnalyzing && (
                  <div className="absolute inset-0" style={{ background: 'rgba(46,163,180,0.15)' }}>
                    <div className="absolute w-full h-1" style={{ background: 'var(--om-teal)', boxShadow: '0 0 15px var(--om-teal)', animation: 'scan 2s linear infinite' }} />
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-60)' }}>{t.analyzeHelp}</p>
                <div className="flex gap-2 mt-2">
                  <button className="om-button flex-1 !min-h-[42px] !text-sm" disabled={!image || isAnalyzing} onClick={analyze}>
                    {isAnalyzing ? <RefreshCw size={15} className="animate-spin" /> : <Sparkles size={15} />}
                    {isAnalyzing ? t.analyzing : t.analyze}
                  </button>
                  {image && (
                    <button className="icon-chip" title={t.replace} onClick={() => { setImage(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                      <RotateCcw size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleImageChange} />

            <div className="flex items-center gap-2 mt-4 flex-wrap">
              <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--text-40)' }}>{t.presets}:</span>
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  className="icon-chip !text-xs"
                  style={activePreset === preset.id ? { background: 'var(--om-cta-bg)', color: '#fff' } : undefined}
                  onClick={() => { setFormData(preset.data); setActivePreset(preset.id); setSheetReady(true) }}
                >
                  {preset.name.split(' — ')[0]}
                </button>
              ))}
            </div>
          </section>

          {sheetReady && (
          <CollapsibleCard title={t.fields} open={open.fields} onToggle={() => toggle('fields')}>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                  style={activeSection === s.id
                    ? { background: 'var(--om-cta-bg)', color: '#fff' }
                    : { background: 'var(--highlight-bg)', color: 'var(--text-60)' }}
                >
                  {s.title[lang]}
                </button>
              ))}
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-40)' }}>{section.subtitle[lang]}</p>
            {section.fields.map(field => (
              <div key={field.key} className="mb-3">
                <label className="text-[11px] font-extrabold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-60)' }}>
                  {field.label[lang]}
                </label>
                <div className="relative">
                  <textarea
                    className="w-full rounded-xl p-2.5 pr-10 text-sm resize-y min-h-[56px] outline-none border"
                    style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)', borderColor: 'transparent' }}
                    value={formData[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                  />
                  <MicButton
                    lang={lang}
                    className="absolute top-2 right-2 icon-chip !min-h-0 !min-w-0 !p-1.5"
                    onStart={() => setFormData(current => ({ ...current, [field.key]: '' }))}
                    onResult={text => setFormData(current => ({ ...current, [field.key]: current[field.key] ? `${current[field.key]} ${text}` : text }))}
                  />
                </div>
              </div>
            ))}
          </CollapsibleCard>
          )}
        </div>

        {/* ---- Right: prompt, generation, result, library, video ---- */}
        <div className="flex flex-col gap-4 min-w-0">
          {sheetReady && (
          <CollapsibleCard
            title={t.prompt}
            open={open.prompt}
            onToggle={() => toggle('prompt')}
            right={(
              <button className="icon-chip !text-xs" onClick={() => copyText(compiledPrompt, 'sheet')}>
                <Copy size={13} />
                {copied === 'sheet' ? t.copied : t.copy}
              </button>
            )}
          >
            <pre
              className="p-3 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap max-h-52 overflow-y-auto font-mono"
              style={{ background: 'var(--highlight-bg)', color: 'var(--text-70)' }}
            >
              {compiledPrompt}
            </pre>

            <div className="mt-4">
              <h3 className="text-[11px] font-extrabold uppercase tracking-wider mb-2" style={{ color: 'var(--text-60)' }}>{t.styleTitle}</h3>
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
                <div className="relative mt-2">
                  <input
                    className="w-full rounded-xl p-2.5 pr-10 text-sm outline-none"
                    style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
                    value={renderStyle.customText}
                    placeholder={t.stylePlaceholder}
                    maxLength={160}
                    onChange={e => setRenderStyle({ ...renderStyle, customText: e.target.value })}
                  />
                  <MicButton
                    lang={lang}
                    className="absolute top-1/2 -translate-y-1/2 right-2 icon-chip !min-h-0 !min-w-0 !p-1.5"
                    onStart={() => setRenderStyle(current => ({ ...current, customText: '' }))}
                    onResult={text => setRenderStyle(current => ({ ...current, customText: current.customText ? `${current.customText} ${text}`.slice(0, 160) : text.slice(0, 160) }))}
                  />
                </div>
              )}
            </div>

            <button className="om-button w-full mt-4" disabled={isGenerating} onClick={generate}>
              {isGenerating ? <RefreshCw size={17} className="animate-spin" /> : <Wand2 size={17} />}
              {isGenerating ? t.generating : canGenerate ? t.generate : t.loginToContinue}
            </button>
            {!isLoggedIn
              ? (
                  <p className="text-xs text-center mt-2 font-bold" style={{ color: freeLeft > 0 ? 'var(--om-teal)' : 'var(--nimiq-red)' }}>
                    {freeLeft > 0 ? t.freeLeft(freeLeft) : t.freeOver}
                  </p>
                )
              : (
                  <p className="text-xs text-center mt-2 font-bold" style={{ color: balance >= SHEET_RENDER_CREDITS ? 'var(--om-teal)' : 'var(--nimiq-red)' }}>
                    {t.costPerRender(balance)}
                  </p>
                )}
          </CollapsibleCard>
          )}

          {generatedImg && (
            <section className="om-card">
              <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>{t.result}</h2>
              <img
                src={generatedImg}
                alt={`Character sheet: ${formData.name}`}
                className="w-full h-auto rounded-xl shadow-lg cursor-zoom-in"
                onClick={() => setLightbox({ src: generatedImg, alt: formData.name || 'Character sheet' })}
              />
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className="om-button green flex-1 !min-h-[42px] !text-sm" onClick={() => void handleSave()}>
                  <Save size={15} />{t.save}
                </button>
                <button className="icon-chip" onClick={() => downloadDataUrl(generatedImg, `${formData.name.replace(/\s+/g, '-')}-sheet.webp`)}>
                  <Download size={14} />{t.downloadImg}
                </button>
                <button className="icon-chip" onClick={() => void shareDataUrl(generatedImg, `${formData.name.replace(/\s+/g, '-')}-sheet.webp`, { footer: true })}>
                  <Share2 size={14} />{t.share}
                </button>
              </div>
              <button className="om-button blue w-full mt-2 !min-h-[42px] !text-sm" onClick={() => talkWith(generatedImg, formData.name)}>
                <MessageCircle size={15} />{t.talk}
              </button>
            </section>
          )}

          {(library.length > 0 || savedThisSession) && (
          <CollapsibleCard title={t.library} open={open.library} onToggle={() => toggle('library')}>
            {!library.length && <p className="text-sm" style={{ color: 'var(--text-40)' }}>{t.empty}</p>}
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
              {library.map(sheet => (
                <div key={sheet.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--highlight-bg)' }}>
                  {sheet.imageDataUrl
                    ? <img src={sheet.imageDataUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 cursor-zoom-in" onClick={() => setLightbox({ src: sheet.imageDataUrl!, alt: sheet.name })} />
                    : <span className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--nq-card)' }}><Sparkles size={16} style={{ color: 'var(--om-teal)' }} /></span>}
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate m-0">{sheet.name}</p>
                    <p className="text-[11px] m-0" style={{ color: 'var(--text-40)' }}>{new Date(sheet.savedAt).toLocaleDateString()}</p>
                  </div>
                  <button className="icon-chip !min-w-0 !px-2" title={t.talk} onClick={() => talkWith(sheet.imageDataUrl, sheet.name)}>
                    <MessageCircle size={14} />
                  </button>
                  <button className="icon-chip !min-w-0 !px-2" title={lang === 'es' ? 'Cargar' : 'Load'} onClick={() => { setFormData(sheet.data); setGeneratedImg(sheet.imageDataUrl) }}>
                    <Upload size={14} />
                  </button>
                  <button className="icon-chip !min-w-0 !px-2" onClick={() => { deleteSheet(sheet.id); setLibrary(listSheets()) }}>
                    <Trash2 size={14} style={{ color: 'var(--nimiq-red)' }} />
                  </button>
                </div>
              ))}
            </div>
          </CollapsibleCard>
          )}

          {(savedThisSession || library.length > 0) && (
          <CollapsibleCard
            title={t.videoTitle}
            open={open.video}
            onToggle={() => toggle('video')}
            icon={<Video size={14} className="shrink-0" />}
          >
            <p className="text-xs mb-3" style={{ color: 'var(--text-40)' }}>{t.videoHelp}</p>
            <div className="flex gap-2 mb-4">
              <button
                className="om-button blue flex-1 !min-h-[42px] !text-sm"
                onClick={() => navigate(isLoggedIn ? '/scenes' : '/login', isLoggedIn ? undefined : { state: { notice: t.loginFirstFeature, redirectTo: '/scenes' } })}
              >
                <Clapperboard size={15} />{t.createScene}
              </button>
              <button
                className="om-button flex-1 !min-h-[42px] !text-sm"
                onClick={() => navigate(isLoggedIn ? '/videos' : '/login', isLoggedIn ? undefined : { state: { notice: t.loginFirstFeature, redirectTo: '/videos' } })}
              >
                <Video size={15} />{t.createVideo}
              </button>
            </div>
            <label className="text-[11px] font-extrabold uppercase tracking-wider block mb-1" style={{ color: 'var(--text-60)' }}>{t.videoAction}</label>
            <div className="relative">
              <textarea
                className="w-full rounded-xl p-2.5 pr-10 text-sm resize-y min-h-[56px] outline-none"
                style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
                value={videoAction}
                onChange={e => setVideoAction(e.target.value)}
              />
              <MicButton
                lang={lang}
                className="absolute top-2 right-2 icon-chip !min-h-0 !min-w-0 !p-1.5"
                onStart={() => setVideoAction('')}
                onResult={text => setVideoAction(current => (current ? `${current} ${text}` : text))}
              />
            </div>
            <div className="flex items-center justify-between mt-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-40)' }}>Output</span>
              <button className="icon-chip !text-xs" onClick={() => copyText(videoPrompt, 'video')}>
                <Copy size={13} />
                {copied === 'video' ? t.copied : t.copy}
              </button>
            </div>
            <pre
              className="p-3 rounded-xl text-[11px] leading-relaxed whitespace-pre-wrap max-h-40 overflow-y-auto font-mono"
              style={{ background: 'var(--highlight-bg)', color: 'var(--text-70)' }}
            >
              {videoPrompt}
            </pre>
          </CollapsibleCard>
          )}
        </div>
      </div>

      {lightbox && <Lightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

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
