/**
 * Credits — balance, pack purchase with USDT (Polygon) or NIM (+50% bonus),
 * purchase history. Mirrors core-modules CreditsCard on the React bridge.
 */
import { Coins, History, LogOut } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CreditPack } from '@core/config'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { useCredits } from '../core/credits'
import AppHeader from '../components/AppHeader'

const COPY = {
  en: {
    balance: 'Your credits',
    packs: 'Top up',
    bonus: '+50% with NIM',
    payUsdt: 'Pay with USDT',
    payNim: 'Pay with NIM',
    nimCredits: (n: number) => `${n} credits with NIM bonus`,
    approx: '≈',
    liveRate: 'live rate',
    fallbackRate: 'offline rate',
    usdtNetwork: 'USDT requires the Polygon network — Nimiq Pay will ask you to switch if needed.',
    history: 'Purchases',
    empty: 'No purchases yet.',
    logout: 'Log out',
    loginNeeded: 'Log in to buy and use credits.',
  },
  es: {
    balance: 'Tus créditos',
    packs: 'Recargar',
    bonus: '+50% con NIM',
    payUsdt: 'Pagar con USDT',
    payNim: 'Pagar con NIM',
    nimCredits: (n: number) => `${n} créditos con bono NIM`,
    approx: '≈',
    liveRate: 'tasa en vivo',
    fallbackRate: 'tasa offline',
    usdtNetwork: 'USDT requiere la red Polygon — Nimiq Pay te pedirá cambiar de red si es necesario.',
    history: 'Compras',
    empty: 'Aún no hay compras.',
    logout: 'Cerrar sesión',
    loginNeeded: 'Inicia sesión para comprar y usar créditos.',
  },
} as const

export default function Credits() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuth()
  const { balance, history, isPaying, error, packs, highlights, quoteUsdt, quoteNimFor, buyWithUsdt, buyWithNim } = useCredits()

  const allPacks = packs()
  const [selected, setSelected] = useState<CreditPack>(allPacks[1] || allPacks[0])
  const [nimQuote, setNimQuote] = useState<{ amount: number, credits: number, rateIsLive: boolean } | null>(null)

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/credits' } })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    let cancelled = false
    setNimQuote(null)
    quoteNimFor(selected).then((quote) => {
      if (!cancelled)
        setNimQuote(quote)
    })
    return () => { cancelled = true }
  }, [selected])

  if (!isLoggedIn) {
    return (
      <div className="page-shell">
        <AppHeader />
        <div className="om-card text-center">{t.loginNeeded}</div>
      </div>
    )
  }

  const usdt = quoteUsdt(selected)

  return (
    <div className="page-shell">
      <AppHeader />

      <div className="om-card mb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-40)' }}>{t.balance}</p>
        <p className="text-5xl font-extrabold my-2 flex items-center justify-center gap-2">
          <Coins size={32} style={{ color: 'var(--nimiq-gold)' }} />
          {balance}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-40)' }}>{user?.label}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {highlights().map(item => (
            <span key={item} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'var(--highlight-bg)', color: 'var(--text-60)' }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="om-card mb-4">
        <h2 className="text-lg font-extrabold mb-3">{t.packs}</h2>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {allPacks.map(pack => (
            <button
              key={pack.usd}
              onClick={() => setSelected(pack)}
              className="rounded-2xl px-2 py-4 text-center border-2 transition-colors"
              style={{
                borderColor: selected.usd === pack.usd ? 'var(--nimiq-light-blue)' : 'var(--highlight-bg)',
                background: 'transparent',
                color: 'var(--text-100)',
              }}
            >
              <div className="text-xl font-extrabold">{pack.credits}</div>
              <div className="text-[11px]" style={{ color: 'var(--text-40)' }}>credits</div>
              <div className="text-sm font-bold mt-1" style={{ color: 'var(--nimiq-light-blue)' }}>${pack.usd}</div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {/* NIM is the primary rail: buyWithNim fetches its own rate, so the
              button never waits on the display quote. */}
          <button className="om-button gold w-full" disabled={isPaying} onClick={() => buyWithNim(selected)}>
            {t.payNim}
            {nimQuote ? ` · ${t.approx} ${nimQuote.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} NIM` : ''}
          </button>
          {nimQuote && (
            <p className="text-xs text-center m-0" style={{ color: 'var(--text-40)' }}>
              {t.nimCredits(nimQuote.credits)} ({nimQuote.rateIsLive ? t.liveRate : t.fallbackRate}) — {t.bonus}
            </p>
          )}
          <button className="om-button green w-full" disabled={isPaying} onClick={() => buyWithUsdt(selected)}>
            {t.payUsdt} · {usdt.amount} USDT
          </button>
          <p className="text-xs text-center m-0" style={{ color: 'var(--text-40)' }}>
            {t.usdtNetwork}
          </p>
        </div>
        {error && <div className="nq-notice error" role="alert">{error}</div>}
      </div>

      <div className="om-card mb-4">
        <h2 className="text-lg font-extrabold mb-3 flex items-center gap-2"><History size={18} />{t.history}</h2>
        {!history.length && <p className="text-sm" style={{ color: 'var(--text-40)' }}>{t.empty}</p>}
        {history.map(record => (
          <div key={record.txHash + record.at} className="flex items-center justify-between py-2 text-sm" style={{ borderBottom: '1px solid var(--highlight-bg)' }}>
            <span className="font-bold">+{record.credits}</span>
            <span style={{ color: 'var(--text-60)' }}>{record.amount} {record.method.toUpperCase()}</span>
            <span style={{ color: 'var(--text-40)' }}>{new Date(record.at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>

      <button className="om-button secondary w-full" onClick={() => { logout(); navigate('/') }}>
        <LogOut size={16} />
        {t.logout}
      </button>
    </div>
  )
}
