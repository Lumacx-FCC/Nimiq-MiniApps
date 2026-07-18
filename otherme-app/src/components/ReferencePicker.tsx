/**
 * Reference picker shared by the Scene and Video creators: attach saved
 * characters, saved scenes (max 1, video creator only) and/or upload new
 * images as identity references — max 3 total.
 */
import { Clapperboard, Plus, UserRound, X } from 'lucide-react'
import { ChangeEvent, useRef } from 'react'
import type { SavedSheet } from '../character/library'
import type { SavedScene } from '../core/mediaStore'
import type { Lang } from '../app/providers'

export interface PickedReference {
  id: string
  name: string
  imageDataUrl: string
  /** Present when the reference is a saved character (identity anchors). */
  sheet?: SavedSheet
  /** Marks a saved scene reference (only one allowed at a time). */
  kind?: 'scene'
}

const COPY = {
  en: {
    counter: (n: number, max: number) => `${n}/${max} references`,
    upload: 'Upload image',
    maxed: 'Maximum 3 references',
    savedLabel: 'Saved characters',
    savedScenes: 'Saved scenes (pick 1 as setting)',
  },
  es: {
    counter: (n: number, max: number) => `${n}/${max} referencias`,
    upload: 'Subir imagen',
    maxed: 'Máximo 3 referencias',
    savedLabel: 'Personajes guardados',
    savedScenes: 'Escenas guardadas (elige 1 como ambiente)',
  },
} as const

export default function ReferencePicker({ characters, scenes, value, onChange, lang, max = 3 }: {
  characters: SavedSheet[]
  /** Saved scenes offered as an optional setting reference (video creator). */
  scenes?: SavedScene[]
  value: PickedReference[]
  onChange: (next: PickedReference[]) => void
  lang: Lang
  max?: number
}) {
  const t = COPY[lang]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const full = value.length >= max

  const toggleCharacter = (sheet: SavedSheet) => {
    const existing = value.find(item => item.id === sheet.id)
    if (existing)
      return onChange(value.filter(item => item.id !== sheet.id))
    if (full || !sheet.imageDataUrl)
      return
    onChange([...value, { id: sheet.id, name: sheet.name, imageDataUrl: sheet.imageDataUrl, sheet }])
  }

  const toggleScene = (scene: SavedScene) => {
    const existing = value.find(item => item.id === scene.id)
    if (existing)
      return onChange(value.filter(item => item.id !== scene.id))
    // Only one scene reference: picking a new one replaces the current one.
    const withoutScenes = value.filter(item => item.kind !== 'scene')
    if (withoutScenes.length >= max)
      return
    onChange([...withoutScenes, { id: scene.id, name: scene.name, imageDataUrl: scene.imageDataUrl, kind: 'scene' }])
  }

  const handleUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || full)
      return
    const reader = new FileReader()
    reader.onloadend = () => {
      onChange([...value, {
        id: `upload-${Date.now().toString(36)}`,
        name: file.name.replace(/\.[^.]+$/, ''),
        imageDataUrl: String(reader.result),
      }])
    }
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--text-60)' }}>{t.savedLabel}</span>
        <span className="text-[11px] font-bold" style={{ color: full ? 'var(--nimiq-gold)' : 'var(--text-40)' }}>
          {full ? t.maxed : t.counter(value.length, max)}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {characters.map((sheet) => {
          const selected = value.some(item => item.id === sheet.id)
          return (
            <button
              key={sheet.id}
              onClick={() => toggleCharacter(sheet)}
              disabled={!selected && (full || !sheet.imageDataUrl)}
              className="shrink-0 w-24 rounded-xl p-2 text-center border-2 disabled:opacity-40"
              style={{ borderColor: selected ? 'var(--om-teal)' : 'transparent', background: 'var(--highlight-bg)' }}
            >
              {sheet.imageDataUrl
                ? <img src={sheet.imageDataUrl} alt="" className="w-full h-16 object-cover rounded-lg" />
                : <span className="w-full h-16 flex items-center justify-center"><UserRound size={22} style={{ color: 'var(--om-teal)' }} /></span>}
              <span className="block text-[11px] font-bold truncate mt-1" style={{ color: 'var(--text-100)' }}>{sheet.name}</span>
            </button>
          )
        })}

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={full}
          className="shrink-0 w-24 rounded-xl p-2 flex flex-col items-center justify-center gap-1 border-2 border-dashed disabled:opacity-40"
          style={{ borderColor: 'var(--om-teal)', background: 'var(--highlight-bg)', color: 'var(--text-60)' }}
        >
          <Plus size={20} style={{ color: 'var(--om-teal)' }} />
          <span className="text-[11px] font-bold">{t.upload}</span>
        </button>
        <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleUpload} />
      </div>

      {!!scenes?.length && (
        <div className="mt-3">
          <span className="text-[11px] font-extrabold uppercase tracking-wider block mb-2" style={{ color: 'var(--text-60)' }}>
            {t.savedScenes}
          </span>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {scenes.map((scene) => {
              const selected = value.some(item => item.id === scene.id)
              return (
                <button
                  key={scene.id}
                  onClick={() => toggleScene(scene)}
                  disabled={!selected && full && !value.some(item => item.kind === 'scene')}
                  className="shrink-0 w-32 rounded-xl p-2 text-center border-2 disabled:opacity-40"
                  style={{ borderColor: selected ? 'var(--om-teal)' : 'transparent', background: 'var(--highlight-bg)' }}
                >
                  <img src={scene.imageDataUrl} alt="" className="w-full h-16 object-cover rounded-lg" />
                  <span className="text-[11px] font-bold truncate mt-1 flex items-center justify-center gap-1" style={{ color: 'var(--text-100)' }}>
                    <Clapperboard size={11} style={{ color: 'var(--om-teal)' }} />
                    <span className="truncate">{scene.name}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {value.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {value.map(reference => (
            <span key={reference.id} className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-[11px] font-bold" style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}>
              <img src={reference.imageDataUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
              <span className="max-w-[90px] truncate">{reference.name}</span>
              <button className="bg-transparent border-none cursor-pointer p-0 flex" onClick={() => onChange(value.filter(item => item.id !== reference.id))} aria-label={`Remove ${reference.name}`}>
                <X size={13} style={{ color: 'var(--nimiq-red)' }} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
