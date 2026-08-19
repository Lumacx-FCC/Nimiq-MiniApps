/**
 * Promos management — grant credits to an arbitrary address (contest prizes,
 * support credits). Gated on the `admin` custom claim
 * (functions/scripts/set-admin-claim.mjs is the only way to get it); the
 * server re-checks it independently on every call, so this page's own gate is
 * just about not showing the form to someone who'd get a 403 anyway.
 */
import { ShieldCheck } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { grantCredits, isAdmin } from '../core/admin'
import AppHeader from '../components/AppHeader'
import ErrorNotice from '../components/ErrorNotice'

const COPY = {
  en: {
    title: 'Grant credits',
    loginNeeded: 'Log in to continue.',
    notAdmin: 'This account does not have admin access.',
    address: 'Recipient address (NQ... or uid)',
    credits: 'Credits',
    note: 'Note (shown in the ledger, e.g. contest name)',
    dedupeKey: 'Dedupe key',
    dedupeHint: 'Unique per grant. Resubmitting the same key is a safe no-op — it will not double-credit.',
    submit: 'Grant credits',
    granting: 'Granting…',
    resultGranted: (balance: number) => `Granted. New balance: ${balance} credits.`,
    resultAlready: (balance: number) => `Already granted for this dedupe key — nothing changed. Balance: ${balance} credits.`,
    log: 'This session',
  },
  es: {
    title: 'Otorgar créditos',
    loginNeeded: 'Inicia sesión para continuar.',
    notAdmin: 'Esta cuenta no tiene acceso de administrador.',
    address: 'Dirección del destinatario (NQ... o uid)',
    credits: 'Créditos',
    note: 'Nota (se muestra en el registro, ej. nombre del concurso)',
    dedupeKey: 'Clave de deduplicación',
    dedupeHint: 'Única por otorgamiento. Reenviar la misma clave es seguro — no duplicará el crédito.',
    submit: 'Otorgar créditos',
    granting: 'Otorgando…',
    resultGranted: (balance: number) => `Otorgado. Nuevo saldo: ${balance} créditos.`,
    resultAlready: (balance: number) => `Ya se otorgó con esta clave — nada cambió. Saldo: ${balance} créditos.`,
    log: 'Esta sesión',
  },
} as const

interface LogEntry {
  address: string
  credits: number
  result: string
}

export default function PromosManagement() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn } = useAuth()

  const [adminChecked, setAdminChecked] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [address, setAddress] = useState('')
  const [credits, setCredits] = useState('')
  const [note, setNote] = useState('')
  const [dedupeKey, setDedupeKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/promos_management' } })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    if (!isLoggedIn)
      return
    // force: true — a claim granted moments ago via set-admin-claim.mjs must
    // show up on this exact page without a full sign-out/sign-in.
    isAdmin(true).then((ok) => {
      setAdmin(ok)
      setAdminChecked(true)
    })
  }, [isLoggedIn])

  if (!isLoggedIn) {
    return (
      <div className="page-shell">
        <AppHeader />
        <div className="om-card text-center">{t.loginNeeded}</div>
      </div>
    )
  }

  if (!adminChecked)
    return (
      <div className="page-shell">
        <AppHeader />
      </div>
    )

  if (!admin) {
    return (
      <div className="page-shell">
        <AppHeader />
        <div className="om-card text-center">{t.notAdmin}</div>
      </div>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const amount = Number(credits)
    if (!address.trim() || !Number.isFinite(amount) || amount <= 0 || !dedupeKey.trim())
      return
    setBusy(true)
    setError(null)
    try {
      const result = await grantCredits(address.trim(), amount, note.trim(), dedupeKey.trim())
      const message = result.alreadyGranted ? t.resultAlready(result.balance) : t.resultGranted(result.balance)
      setLog(entries => [{ address: address.trim(), credits: amount, result: message }, ...entries])
      setAddress('')
      setCredits('')
      setNote('')
      setDedupeKey('')
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    finally {
      setBusy(false)
    }
  }

  return (
    <div className="page-shell">
      <AppHeader />
      <h1 className="text-2xl font-extrabold text-center mb-4 flex items-center justify-center gap-2">
        <ShieldCheck size={22} />
        {t.title}
      </h1>

      <form onSubmit={submit} className="om-card mb-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold" style={{ color: 'var(--text-40)' }}>{t.address}</span>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="rounded-xl px-4 py-3 outline-none text-base"
            style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold" style={{ color: 'var(--text-40)' }}>{t.credits}</span>
          <input
            type="number"
            min="1"
            step="1"
            value={credits}
            onChange={e => setCredits(e.target.value)}
            className="rounded-xl px-4 py-3 outline-none text-base"
            style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
            required
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold" style={{ color: 'var(--text-40)' }}>{t.note}</span>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            className="rounded-xl px-4 py-3 outline-none text-base"
            style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold" style={{ color: 'var(--text-40)' }}>{t.dedupeKey}</span>
          <input
            value={dedupeKey}
            onChange={e => setDedupeKey(e.target.value)}
            className="rounded-xl px-4 py-3 outline-none text-base"
            style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
            required
          />
          <span className="text-xs" style={{ color: 'var(--text-40)' }}>{t.dedupeHint}</span>
        </label>
        <button type="submit" className="om-button gold w-full" disabled={busy}>
          {busy ? t.granting : t.submit}
        </button>
      </form>

      {log.length > 0 && (
        <div className="om-card">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-40)' }}>{t.log}</p>
          {log.map((entry, index) => (
            <div key={index} className="text-sm py-2" style={{ borderBottom: index < log.length - 1 ? '1px solid var(--highlight-bg)' : 'none' }}>
              <strong>{entry.address}</strong> — {entry.credits} — {entry.result}
            </div>
          ))}
        </div>
      )}

      {error && <ErrorNotice message={error} lang={lang} onClose={() => setError(null)} />}
    </div>
  )
}
