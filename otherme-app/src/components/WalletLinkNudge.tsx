/**
 * Nudges email/Google users toward linking a Nimiq wallet — no new linking
 * mechanism, just visibility for the pairing-code flow already shipped on
 * /profile (Tier 2.1).
 */
import { Wallet, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { getAccountOverview } from '../core/accountLink'

const DISMISS_KEY = 'otherme:walletNudgeDismissed'

const COPY = {
  en: {
    title: 'Add a Nimiq wallet',
    body: 'Link a Nimiq Pay wallet to your account so your balance and saved characters follow you there too.',
    cta: 'Link a wallet',
  },
  es: {
    title: 'Añade una wallet de Nimiq',
    body: 'Vincula una wallet de Nimiq Pay a tu cuenta para que tu saldo y personajes guardados también estén ahí.',
    cta: 'Vincular wallet',
  },
} as const

export default function WalletLinkNudge() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn, user } = useAuth()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1')
  // Hidden by default until the overview check resolves — avoids a flash for
  // users who do have a wallet linked, and stays hidden if the check fails.
  const [hasWallet, setHasWallet] = useState(true)

  useEffect(() => {
    if (!isLoggedIn || !user || user.provider === 'nimiq')
      return
    getAccountOverview()
      .then(overview => setHasWallet(overview.linkedAccounts.some(a => a.provider === 'nimiq')))
      .catch(() => {})
  }, [isLoggedIn, user])

  if (!isLoggedIn || !user || user.provider === 'nimiq' || hasWallet || dismissed)
    return null

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setDismissed(true)
  }

  return (
    <div className="om-card mb-4 flex items-start gap-3" style={{ background: 'var(--highlight-bg)' }}>
      <Wallet size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--nimiq-light-blue)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold m-0">{t.title}</p>
        <p className="text-xs mt-1 mb-2" style={{ color: 'var(--text-60)' }}>{t.body}</p>
        <button className="om-button blue !text-xs" style={{ padding: '6px 12px', minHeight: 0 }} onClick={() => navigate('/profile')}>
          {t.cta}
        </button>
      </div>
      <button
        aria-label="Dismiss"
        className="icon-chip shrink-0"
        style={{ minHeight: 0, minWidth: 0, padding: 6 }}
        onClick={dismiss}
      >
        <X size={14} />
      </button>
    </div>
  )
}
