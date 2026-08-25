/**
 * Shown once, before the first photo upload (Character Studio's own upload
 * dropzone, and ReferencePicker's upload button shared by Scenes/Videos).
 * Summarizes /terms section 4 ("Images you upload") + the retention line in
 * section 6's data table rather than restating new legal language.
 */
import { useState } from 'react'
import type { Lang } from '../app/providers'

const COPY = {
  en: {
    title: 'Before you upload a photo',
    body: 'Your photo is sent to our AI provider to analyze it or generate images from it, then discarded — we do not store the raw photo you upload. Only the results you choose to keep are saved (to this device, and to our server once you sign in). You are responsible for having the right to use any photo you upload.',
    linkText: 'Full details — Terms, section 4',
    checkbox: 'I understand and agree',
    continue: 'Continue',
    cancel: 'Cancel',
  },
  es: {
    title: 'Antes de subir una foto',
    body: 'Tu foto se envía a nuestro proveedor de IA para analizarla o generar imágenes a partir de ella, y luego se descarta — no almacenamos la foto original que subes. Solo se guardan los resultados que decidas conservar (en este dispositivo, y en nuestro servidor una vez que inicias sesión). Eres responsable de tener el derecho de usar cualquier foto que subas.',
    linkText: 'Detalles completos — Términos, sección 4',
    checkbox: 'Entiendo y acepto',
    continue: 'Continuar',
    cancel: 'Cancelar',
  },
} as const

export default function UploadConsentModal({ lang, onAccept, onCancel }: {
  lang: Lang
  onAccept: () => void
  onCancel: () => void
}) {
  const t = COPY[lang]
  const [checked, setChecked] = useState(false)

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div className="om-card max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-sm font-extrabold uppercase tracking-widest mb-3" style={{ color: 'var(--text-40)' }}>
          {t.title}
        </h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-70)' }}>{t.body}</p>
        <a
          href="/terms#s4"
          target="_blank"
          rel="noreferrer"
          className="text-xs font-bold underline block mb-4"
          style={{ color: 'var(--om-teal)' }}
        >
          {t.linkText}
        </a>
        <label className="flex items-start gap-2 text-xs font-bold mb-4 cursor-pointer" style={{ color: 'var(--text-100)' }}>
          <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} className="mt-0.5" />
          {t.checkbox}
        </label>
        <div className="flex gap-2">
          <button className="icon-chip flex-1" onClick={onCancel}>{t.cancel}</button>
          <button className="om-button flex-1" disabled={!checked} onClick={onAccept}>{t.continue}</button>
        </div>
      </div>
    </div>
  )
}
