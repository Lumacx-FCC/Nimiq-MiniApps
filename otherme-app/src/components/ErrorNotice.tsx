/**
 * Centered, hard-to-miss error dialog — replaces the old bottom-corner toast
 * for error-type notices, which was easy to miss mid-flow. Success/info
 * notices keep the lighter toast treatment; only errors get this.
 */
import { AlertTriangle } from 'lucide-react'

const DISMISS = { en: 'OK', es: 'Aceptar' } as const

export default function ErrorNotice({ message, lang, onClose }: { message: string, lang: 'en' | 'es', onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,12,.6)' }}
      onClick={onClose}
      role="alertdialog"
      aria-modal="true"
    >
      <div
        className="om-card max-w-sm w-full text-center"
        style={{ background: 'var(--nq-card)' }}
        onClick={event => event.stopPropagation()}
      >
        <AlertTriangle size={30} style={{ color: 'var(--nimiq-red)' }} className="mx-auto mb-3" />
        <p className="text-[15px] font-semibold leading-snug" style={{ color: 'var(--text-100)' }}>{message}</p>
        <button className="om-button secondary !mt-5 !min-h-[44px] !w-full" onClick={onClose}>{DISMISS[lang]}</button>
      </div>
    </div>
  )
}
