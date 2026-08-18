/**
 * Centered, hard-to-miss error dialog — replaces the old bottom-corner toast
 * for error-type notices, which was easy to miss mid-flow. Success/info
 * notices keep the lighter toast treatment; only errors get this.
 *
 * z-[200] is intentional: an error can fire while another modal is open
 * (e.g. RoleplayStudio's upload modal at z-index 100, or a toast at 120) and
 * must render above it — confirmed bug: a blocked-by-content-filter error
 * during avatar generation rendered correctly but sat behind the still-open
 * upload modal, invisible to the user, until this was raised past it.
 */
import { AlertTriangle } from 'lucide-react'

const DISMISS = { en: 'OK', es: 'Aceptar' } as const

export default function ErrorNotice({ message, lang, onClose }: { message: string, lang: 'en' | 'es', onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
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
