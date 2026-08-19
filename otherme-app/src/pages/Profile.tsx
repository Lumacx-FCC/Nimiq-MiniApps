/**
 * Manage Profile — linked identities + balance (Part D). New /profile route.
 * Reauth-before-unlink is deliberately simple: re-run the current provider's
 * normal login (see core/accountLink.ts doc comment) rather than building a
 * separate reauthenticateWithCredential/-Popup path.
 */
import { Check, Coins, Copy, KeyRound, Link2, Mail, Unlink, User, Wallet } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { AccountOverview, LinkedAccount, PreviewLinkResult, commitLink, getAccountOverview, previewLink, startLink, unlinkSecondary } from '../core/accountLink'
import { onSessionChange } from '../core/session'
import AppHeader from '../components/AppHeader'
import CollapsibleCard from '../components/CollapsibleCard'
import ErrorNotice from '../components/ErrorNotice'

const COPY = {
  en: {
    title: 'Manage profile',
    loginNeeded: 'Log in to manage your profile.',
    balance: 'Your credits',
    signedInAs: 'Signed in as',
    uid: 'UID',
    uidHint: 'Use this for promotions instead of your wallet address or email',
    copyUid: 'Copy UID',
    copied: 'Copied',
    connected: 'Connected logins',
    noneLinked: 'No other logins linked yet.',
    unlink: 'Unlink',
    reauthPassword: 'Enter your password to confirm',
    confirm: 'Confirm',
    cancel: 'Cancel',
    linkAnother: 'Link another login',
    generateCode: 'Show a code on this device',
    generateCodeHint: 'Then enter it on the other device you want to link.',
    getCode: 'Generate code',
    codeExpires: (m: number) => `Expires in ${m} min`,
    haveCode: 'I have a code from another device',
    codePlaceholder: 'Enter code',
    preview: 'Preview',
    mergePreviewTitle: 'Confirm this link',
    mergeExplain: (total: number) => `Linking will combine both balances into ${total} credits on this account. This can't be undone.`,
    mergeConfirm: 'Link accounts',
    mergeCancel: 'Cancel',
    providerNimiq: 'Nimiq wallet',
    providerEmail: 'Email account',
    providerGoogle: 'Google account',
    providerUnknown: 'Linked account',
  },
  es: {
    title: 'Gestionar perfil',
    loginNeeded: 'Inicia sesión para gestionar tu perfil.',
    balance: 'Tus créditos',
    signedInAs: 'Sesión iniciada como',
    uid: 'UID',
    uidHint: 'Úsalo para promociones en lugar de tu dirección de wallet o email',
    copyUid: 'Copiar UID',
    copied: 'Copiado',
    connected: 'Cuentas conectadas',
    noneLinked: 'Aún no has vinculado otras cuentas.',
    unlink: 'Desvincular',
    reauthPassword: 'Escribe tu contraseña para confirmar',
    confirm: 'Confirmar',
    cancel: 'Cancelar',
    linkAnother: 'Vincular otra cuenta',
    generateCode: 'Mostrar un código en este dispositivo',
    generateCodeHint: 'Luego ingrésalo en el otro dispositivo que quieras vincular.',
    getCode: 'Generar código',
    codeExpires: (m: number) => `Expira en ${m} min`,
    haveCode: 'Tengo un código de otro dispositivo',
    codePlaceholder: 'Ingresa el código',
    preview: 'Vista previa',
    mergePreviewTitle: 'Confirma esta vinculación',
    mergeExplain: (total: number) => `Vincular combinará ambos saldos en ${total} créditos en esta cuenta. Esto no se puede deshacer.`,
    mergeConfirm: 'Vincular cuentas',
    mergeCancel: 'Cancelar',
    providerNimiq: 'Wallet de Nimiq',
    providerEmail: 'Cuenta de email',
    providerGoogle: 'Cuenta de Google',
    providerUnknown: 'Cuenta vinculada',
  },
} as const

function providerIcon(provider: string) {
  if (provider === 'nimiq')
    return <Wallet size={16} />
  if (provider === 'google')
    return <User size={16} />
  return <Mail size={16} />
}

export default function Profile() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn, user, loginWithNimiq, loginWithGoogle, loginWithEmail, syncSession } = useAuth()

  const [overview, setOverview] = useState<AccountOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [linkOpen, setLinkOpen] = useState(false)
  const [connectedOpen, setConnectedOpen] = useState(true)

  const [code, setCode] = useState<{ code: string; expiresAt: number } | null>(null)
  const [redeemCode, setRedeemCode] = useState('')
  const [preview, setPreview] = useState<PreviewLinkResult | null>(null)
  const [busy, setBusy] = useState(false)

  const [reauthTarget, setReauthTarget] = useState<string | null>(null)
  const [reauthPassword, setReauthPassword] = useState('')
  const [uidCopied, setUidCopied] = useState(false)

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/profile' } })
  }, [isLoggedIn, navigate])

  const loadOverview = () => {
    getAccountOverview().then(setOverview).catch(e => setError(e instanceof Error ? e.message : String(e)))
  }
  // Wait for Firebase's own session-restore signal rather than firing on
  // mount — on a fresh page load (bookmark, hard refresh), isLoggedIn (from
  // localStorage) can be true before Firebase Auth finishes restoring the
  // persisted session, which would otherwise race a real "not signed in".
  useEffect(() => onSessionChange((uid) => {
    if (uid)
      loadOverview()
  }), [])

  if (!isLoggedIn) {
    return (
      <div className="page-shell">
        <AppHeader />
        <div className="om-card text-center">{t.loginNeeded}</div>
      </div>
    )
  }

  const providerLabel = (p: LinkedAccount['provider']) =>
    p === 'nimiq' ? t.providerNimiq : p === 'email' ? t.providerEmail : p === 'google' ? t.providerGoogle : t.providerUnknown

  const handleGetCode = async () => {
    setBusy(true)
    setError(null)
    try {
      setCode(await startLink())
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    finally {
      setBusy(false)
    }
  }

  const handlePreview = async () => {
    if (!redeemCode.trim())
      return
    setBusy(true)
    setError(null)
    try {
      setPreview(await previewLink(redeemCode.trim()))
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    finally {
      setBusy(false)
    }
  }

  const handleCommit = async () => {
    if (!preview)
      return
    setBusy(true)
    setError(null)
    try {
      const ok = await syncSession(() => commitLink(preview.ticketId))
      if (ok) {
        setPreview(null)
        setRedeemCode('')
        loadOverview()
      }
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    finally {
      setBusy(false)
    }
  }

  const startUnlink = (uid: string) => {
    setReauthTarget(uid)
    setReauthPassword('')
  }

  const confirmUnlink = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!reauthTarget || !user)
      return
    setBusy(true)
    setError(null)
    try {
      // Refresh auth_time by re-running this account's own login, then unlink.
      const reauthOk = user.provider === 'nimiq'
        ? await loginWithNimiq()
        : user.provider === 'google'
          ? await loginWithGoogle()
          : await loginWithEmail(user.email || '', reauthPassword)
      if (!reauthOk) {
        setError('Could not confirm your identity — try again.')
        return
      }
      await unlinkSecondary(reauthTarget)
      setReauthTarget(null)
      loadOverview()
    }
    catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
    finally {
      setBusy(false)
    }
  }

  const minutesLeft = (expiresAt: number) => Math.max(0, Math.ceil((expiresAt - Date.now()) / 60000))

  const copyUid = () => {
    if (!user?.id)
      return
    navigator.clipboard.writeText(user.id).then(() => {
      setUidCopied(true)
      window.setTimeout(() => setUidCopied(false), 1500)
    })
  }

  return (
    <div className="page-shell">
      <AppHeader />
      <h1 className="text-2xl font-extrabold text-center mb-4">{t.title}</h1>

      <div className="om-card mb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-40)' }}>{t.balance}</p>
        <p className="text-5xl font-extrabold my-2 flex items-center justify-center gap-2">
          <Coins size={32} style={{ color: 'var(--nimiq-gold)' }} />
          {overview?.balance ?? '—'}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-40)' }}>{t.signedInAs}: {user?.label}</p>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <p className="text-xs" style={{ color: 'var(--text-40)' }}>{t.uid}: {user?.id}</p>
          <button
            className="icon-chip"
            style={{ minHeight: 0, minWidth: 0, padding: 5 }}
            onClick={copyUid}
            aria-label={t.copyUid}
            title={t.copyUid}
          >
            {uidCopied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-40)' }}>{t.uidHint}</p>
      </div>

      <CollapsibleCard
        title={t.connected}
        open={connectedOpen}
        onToggle={() => setConnectedOpen(v => !v)}
        icon={<Link2 size={16} />}
        className="mb-4"
      >
        {!overview?.linkedAccounts?.length && <p className="text-sm" style={{ color: 'var(--text-40)' }}>{t.noneLinked}</p>}
        {overview?.linkedAccounts?.map(acct => (
          <div key={acct.uid} className="flex items-center justify-between gap-2 py-2" style={{ borderBottom: '1px solid var(--highlight-bg)' }}>
            <span className="flex items-center gap-2 text-sm font-semibold">
              {providerIcon(acct.provider)}
              {providerLabel(acct.provider)}
            </span>
            {reauthTarget === acct.uid
              ? (
                  <form onSubmit={confirmUnlink} className="flex items-center gap-2">
                    {user?.provider === 'email' && (
                      <label className="flex items-center gap-1.5 rounded-xl px-2 py-1.5" style={{ background: 'var(--highlight-bg)' }}>
                        <KeyRound size={14} style={{ color: 'var(--text-40)' }} />
                        <input
                          type="password"
                          required
                          autoFocus
                          value={reauthPassword}
                          onChange={e => setReauthPassword(e.target.value)}
                          placeholder={t.reauthPassword}
                          className="bg-transparent outline-none text-xs"
                          style={{ color: 'var(--text-100)', width: 120 }}
                        />
                      </label>
                    )}
                    <button type="submit" className="om-button gold" disabled={busy} style={{ padding: '6px 12px', minHeight: 0, fontSize: 12 }}>{t.confirm}</button>
                    <button type="button" className="om-button secondary" disabled={busy} onClick={() => setReauthTarget(null)} style={{ padding: '6px 12px', minHeight: 0, fontSize: 12 }}>{t.cancel}</button>
                  </form>
                )
              : (
                  <button className="om-button secondary" onClick={() => startUnlink(acct.uid)} style={{ padding: '6px 12px', minHeight: 0, fontSize: 12 }}>
                    <Unlink size={13} />
                    {t.unlink}
                  </button>
                )}
          </div>
        ))}
      </CollapsibleCard>

      <CollapsibleCard
        title={t.linkAnother}
        open={linkOpen}
        onToggle={() => setLinkOpen(v => !v)}
        icon={<Link2 size={16} />}
        className="mb-4"
      >
        <div className="mb-5">
          <p className="text-sm font-bold mb-1">{t.generateCode}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-40)' }}>{t.generateCodeHint}</p>
          {code
            ? (
                <div className="om-card text-center" style={{ background: 'var(--highlight-bg)' }}>
                  <p className="text-3xl font-extrabold tracking-widest my-1">{code.code}</p>
                  <p className="text-xs" style={{ color: 'var(--text-40)' }}>{t.codeExpires(minutesLeft(code.expiresAt))}</p>
                </div>
              )
            : (
                <button className="om-button blue w-full" disabled={busy} onClick={handleGetCode}>{t.getCode}</button>
              )}
        </div>

        <div>
          <p className="text-sm font-bold mb-2">{t.haveCode}</p>
          <div className="flex gap-2">
            <input
              value={redeemCode}
              onChange={e => setRedeemCode(e.target.value.toUpperCase())}
              placeholder={t.codePlaceholder}
              className="flex-1 rounded-xl px-4 py-3 outline-none text-base tracking-widest"
              style={{ background: 'var(--highlight-bg)', color: 'var(--text-100)' }}
            />
            <button className="om-button" disabled={busy || !redeemCode.trim()} onClick={handlePreview}>{t.preview}</button>
          </div>
        </div>
      </CollapsibleCard>

      {preview && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" style={{ background: 'rgba(2,6,12,.6)' }}>
          <div className="om-card w-full max-w-sm text-center">
            <h3 className="text-lg font-extrabold mb-2">{t.mergePreviewTitle}</h3>
            <p className="text-sm" style={{ color: 'var(--text-60)' }}>{t.mergeExplain(preview.mergedTotal)}</p>
            <button className="om-button gold w-full mt-4" disabled={busy} onClick={handleCommit}>{t.mergeConfirm}</button>
            <button className="om-button secondary w-full mt-2" disabled={busy} onClick={() => setPreview(null)}>{t.mergeCancel}</button>
          </div>
        </div>
      )}

      {error && <ErrorNotice message={error} lang={lang} onClose={() => setError(null)} />}
    </div>
  )
}
