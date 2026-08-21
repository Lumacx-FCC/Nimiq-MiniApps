/**
 * Credits — balance, pack purchase with USDT (Polygon) or NIM (+50% bonus),
 * purchase history. Mirrors core-modules CreditsCard on the React bridge.
 */
import { Coins, CreditCard, History, Loader2, LogOut, Mail, PartyPopper, Smartphone, Sparkles, Wallet } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CreditPack } from '@core/config'
import { USDT_GAS_REQUIRED } from '@core/credits/payUsdt'
import { isPaypalEnabled, renderHostedButton } from '@core/credits/payPaypal'
import { useSettings } from '../app/providers'
import { checkEmailVerified, resendVerificationEmail } from '../core/authProviders'
import { useAuth } from '../core/auth'
import { acceptTerms, createServerOrder, useCredits } from '../core/credits'
import { getAccountOverview } from '../core/accountLink'
import { PAYPAL_PACKS, REGULAR_USD } from '../core/config'
import AppHeader from '../components/AppHeader'

type CreditsMode = 'nim' | 'card' | 'history' | 'linkWallet' | null

const COPY = {
  en: {
    balance: 'Your credits',
    packs: 'Top up',
    earlyBird: '25% off for early birds',
    earlyBirdUntil: 'until Nov 1st 2026',
    bonus: '+50% with NIM',
    payUsdt: 'Pay with USDT',
    payNim: 'Pay with NIM',
    nimCredits: (n: number) => `${n} credits with NIM bonus`,
    approx: '≈',
    liveRate: 'live rate',
    fallbackRate: 'offline rate',
    usdtNetwork: 'USDT requires the Polygon network — Nimiq Pay will ask you to switch if needed.',
    usdtGas: 'Paying with USDT also needs a little POL (Polygon’s gas token) in your wallet. No POL? Pay with NIM instead — it’s gasless and gives +50% credits.',
    gasError: 'This USDT payment needs a small amount of POL for network gas, and your wallet doesn’t have any. Add a little POL, or pay with NIM instead (gasless, +50% credits).',
    newToNimiq: 'New on Nimiq?',
    getNimiqPay: 'Get Nimiq Pay App',
    openTip: 'Open this app’s URL inside the Nimiq Pay app to add credits.',
    history: 'Purchases',
    empty: 'No purchases yet.',
    logout: 'Log out',
    loginNeeded: 'Log in to buy and use credits.',
    accountScope: 'Credits stay with the sign-in method you buy them with by default. To use the same balance elsewhere, sign in the same way, or link another login from your Profile page.',
    verifyHoldTitle: 'Your welcome credits are on hold',
    verifyHoldBody: 'Verify your email, then claim your 5 welcome credits from your Profile page. Check your inbox for the link we sent when you signed up.',
    resend: 'Resend verification email',
    resendSent: 'Verification email sent — check your inbox.',
    resendError: 'Could not send the email — try again in a moment.',
    termsGateTitle: 'Before your first purchase',
    termsGateBody: 'Please confirm you agree to the Terms & Conditions.',
    termsGateLink: 'Read the Terms & Conditions',
    termsGateCheckbox: 'I agree to the Terms & Conditions',
    termsGateConfirm: 'Confirm and continue',
    termsGateCancel: 'Cancel',
    termsGateError: 'Could not confirm — try again in a moment.',
    navNim: 'Buy Credits with NIM',
    navCard: 'Buy Credits with Card',
    navHistory: 'Show Purchases',
    payCardBanner: 'Prefer to pay with a card?',
    payCardTitle: 'Pay with Credit Card',
    nimiqBonusBanner: 'Get 50% more credits using Nimiq Pay',
    choosePackage: 'Choose a package',
    checkoutTitle: 'Complete your purchase',
    changePackage: 'Choose a different package',
    noWalletNotice: 'No wallet linked yet — please download the Nimiq Pay app and link your accounts first.',
    noEmailNotice: 'A verified email is needed before using Credit Card payments — log out and sign in with Gmail/Email, then link your accounts from the Profile tab.',
    linkEmailNotice: 'To pay with a card, sign in with an email or Google account — link one from your Profile page first if you don’t have one yet.',
    noticeOk: 'Got it',
  },
  es: {
    balance: 'Tus créditos',
    packs: 'Recargar',
    earlyBird: '25% de descuento para los primeros',
    earlyBirdUntil: 'hasta el 1 de noviembre de 2026',
    bonus: '+50% con NIM',
    payUsdt: 'Pagar con USDT',
    payNim: 'Pagar con NIM',
    nimCredits: (n: number) => `${n} créditos con bono NIM`,
    approx: '≈',
    liveRate: 'tasa en vivo',
    fallbackRate: 'tasa offline',
    usdtNetwork: 'USDT requiere la red Polygon — Nimiq Pay te pedirá cambiar de red si es necesario.',
    usdtGas: 'Pagar con USDT también necesita un poco de POL (el gas de Polygon) en tu monedero. ¿No tienes POL? Paga con NIM — no gasta gas y da +50% de créditos.',
    gasError: 'Este pago con USDT necesita una pequeña cantidad de POL para el gas de la red, y tu monedero no tiene. Añade un poco de POL, o paga con NIM (sin gas, +50% de créditos).',
    newToNimiq: '¿Nuevo en Nimiq?',
    getNimiqPay: 'Descargar Nimiq Pay',
    openTip: 'Abre la URL de esta app dentro de Nimiq Pay para añadir créditos.',
    history: 'Compras',
    empty: 'Aún no hay compras.',
    logout: 'Cerrar sesión',
    loginNeeded: 'Inicia sesión para comprar y usar créditos.',
    accountScope: 'Los créditos quedan ligados al método con el que los compras por defecto. Para usar el mismo saldo en otro lugar, inicia sesión de la misma forma, o vincula otro inicio de sesión desde tu perfil.',
    verifyHoldTitle: 'Tus créditos de bienvenida están en espera',
    verifyHoldBody: 'Verifica tu email y luego reclama tus 5 créditos de bienvenida desde tu perfil. Revisa tu bandeja de entrada por el enlace que enviamos cuando te registraste.',
    resend: 'Reenviar email de verificación',
    resendSent: 'Email de verificación enviado — revisa tu bandeja de entrada.',
    resendError: 'No pudimos enviar el email — intenta de nuevo en un momento.',
    termsGateTitle: 'Antes de tu primera compra',
    termsGateBody: 'Por favor confirma que aceptas los Términos y Condiciones.',
    termsGateLink: 'Leer los Términos y Condiciones',
    termsGateCheckbox: 'Acepto los Términos y Condiciones',
    termsGateConfirm: 'Confirmar y continuar',
    termsGateCancel: 'Cancelar',
    termsGateError: 'No pudimos confirmar — intenta de nuevo en un momento.',
    navNim: 'Comprar créditos con NIM',
    navCard: 'Comprar créditos con Tarjeta',
    navHistory: 'Ver compras',
    payCardBanner: '¿Prefieres pagar con tarjeta?',
    payCardTitle: 'Pagar con Tarjeta',
    nimiqBonusBanner: 'Obtén 50% más créditos con Nimiq Pay',
    choosePackage: 'Elige un paquete',
    checkoutTitle: 'Completa tu compra',
    changePackage: 'Elegir otro paquete',
    noWalletNotice: 'Aún no tienes un monedero vinculado — descarga la app Nimiq Pay y vincula tus cuentas primero.',
    noEmailNotice: 'Necesitas un email verificado para usar pagos con tarjeta — cierra sesión e inicia sesión con Gmail/Email, luego vincula tus cuentas desde la pestaña Perfil.',
    linkEmailNotice: 'Para pagar con tarjeta, inicia sesión con una cuenta de email o Google — vincula una desde tu perfil si aún no tienes.',
    noticeOk: 'Entendido',
  },
} as const

/**
 * §12 waiting-state copy for the server-verified (USDT) purchase flow. With
 * on-chain verification a purchase is no longer instant — there's a short
 * confirmation wait — so the copy reassures crypto newcomers their money is
 * safe and explains the wait. Keyed by the credits `flow.status`.
 */
const PAY_COPY = {
  en: {
    approving: { title: 'Approve the payment', body: 'Confirm the payment in your Nimiq Pay wallet to continue.' },
    submitted: { title: 'Payment sent 🎉', body: 'Your payment is on its way. The blockchain network is now confirming it — this usually takes about a minute. You can keep this screen open; your credits will appear automatically.' },
    confirming: { title: 'Confirming your payment…', body: 'Crypto payments are verified by the network instead of a bank, so there’s a short wait while it’s double-checked — usually around a minute. There’s no need to pay again. Just hang tight; your credits will be added the moment it clears.', hint: 'Estimated wait: ~1 minute' },
    slow: { title: 'Almost there…', body: 'The network is a little busy right now, so this is taking longer than usual — it can take up to 20 minutes in rare cases. Your payment is safe, and your credits will be added automatically as soon as it’s confirmed, even if you leave this screen.' },
    granted: { title: 'All set! ✨', body: 'Your payment is confirmed and your credits have been added.' },
    failed: { title: 'We couldn’t confirm this payment', body: 'If funds left your wallet, they’re safe — you were not charged twice and no credits were lost. Contact support with your transaction ID and we’ll sort it out.', txLabel: 'Transaction ID' },
    close: 'Done',
    dismiss: 'Close',
    background: 'Continue in background',
    resume: 'Payment still confirming — tap to view',
  },
  es: {
    approving: { title: 'Aprueba el pago', body: 'Confirma el pago en tu monedero Nimiq Pay para continuar.' },
    submitted: { title: 'Pago enviado 🎉', body: 'Tu pago está en camino. La red blockchain lo está confirmando — esto suele tardar alrededor de un minuto. Puedes dejar esta pantalla abierta; tus créditos aparecerán automáticamente.' },
    confirming: { title: 'Confirmando tu pago…', body: 'Los pagos con cripto los verifica la red en lugar de un banco, así que hay una breve espera mientras se comprueba — normalmente cerca de un minuto. No necesitas pagar de nuevo. Solo espera un momento; tus créditos se añadirán en cuanto se confirme.', hint: 'Espera estimada: ~1 minuto' },
    slow: { title: 'Ya casi…', body: 'La red está un poco ocupada ahora mismo, así que está tardando más de lo normal — en casos raros puede tardar hasta 20 minutos. Tu pago está seguro y tus créditos se añadirán automáticamente en cuanto se confirme, aunque salgas de esta pantalla.' },
    granted: { title: '¡Listo! ✨', body: 'Tu pago está confirmado y tus créditos ya se añadieron.' },
    failed: { title: 'No pudimos confirmar este pago', body: 'Si salió dinero de tu monedero, está seguro — no se te cobró dos veces ni se perdieron créditos. Contacta con soporte con tu ID de transacción y lo resolvemos.', txLabel: 'ID de transacción' },
    close: 'Listo',
    dismiss: 'Cerrar',
    background: 'Continuar en segundo plano',
    resume: 'Pago aún confirmándose — toca para ver',
  },
} as const

/**
 * Package grid + live PayPal Hosted Button checkout (backlog 4.7 Part A).
 * Selecting a pack renders that pack's real Hosted Button (Lucas's PayPal
 * dashboard snippet) and fires an audit-trail server order — Part B's
 * (not yet built) webhook grants credits by matching the payer's email
 * against this order, with a manual-grant fallback for anything unmatched.
 */
function PaypalPackageSelector({ t }: { t: typeof COPY['en'] | typeof COPY['es'] }) {
  const [selected, setSelected] = useState<typeof PAYPAL_PACKS[number] | null>(null)

  useEffect(() => {
    if (!selected)
      return
    void renderHostedButton(selected.hostedButtonId, `paypal-container-${selected.hostedButtonId}`)
    void createServerOrder('paypal', selected.usd).catch(() => {})
  }, [selected])

  return (
    <div className="om-card mb-4">
      <h2 className="text-lg font-extrabold mb-3">{t.choosePackage}</h2>
      <div className="grid grid-cols-3 gap-2">
        {PAYPAL_PACKS.map(pack => (
          <button
            key={pack.hostedButtonId}
            onClick={() => setSelected(pack)}
            className="rounded-2xl overflow-hidden border-2 transition-colors"
            style={{ borderColor: selected?.hostedButtonId === pack.hostedButtonId ? 'var(--nimiq-light-blue)' : 'var(--highlight-bg)' }}
          >
            <img src={pack.image} alt={`${pack.credits} credits · $${pack.usd}`} className="w-full h-auto" />
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-4">
          <h3 className="text-sm font-extrabold mb-2">{t.checkoutTitle}</h3>
          <div id={`paypal-container-${selected.hostedButtonId}`} />
          <button className="om-button secondary w-full mt-3 !text-xs !min-h-[36px]" onClick={() => setSelected(null)}>
            {t.changePackage}
          </button>
        </div>
      )}
    </div>
  )
}

/** Shared between Credit Card mode (a nudge toward NIM) and the no-wallet
 * guard on "Buy Credits with NIM" (link a wallet first). */
function NewOnNimiqCard({ t }: { t: typeof COPY['en'] | typeof COPY['es'] }) {
  return (
    <div className="om-card mb-4">
      <div className="grid grid-cols-2 gap-2">
        <a
          className="om-button secondary"
          href="https://www.nimiq.com/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, padding: '10px 12px' }}
        >
          <Sparkles size={15} />
          {t.newToNimiq}
        </a>
        <a
          className="om-button secondary"
          href="https://play.google.com/store/search?q=nimiq%20pay&c=apps&hl=en"
          target="_blank"
          rel="noopener noreferrer"
          style={{ fontSize: 13, padding: '10px 12px' }}
        >
          <Smartphone size={15} />
          {t.getNimiqPay}
        </a>
      </div>
      <p className="text-xs text-center mt-2.5 mb-0" style={{ color: 'var(--text-40)' }}>
        {t.openTip}
      </p>
    </div>
  )
}

export default function Credits() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const pt = PAY_COPY[lang]
  const navigate = useNavigate()
  const { isLoggedIn, user, logout } = useAuth()
  const { balance, history, isPaying, error, flow, resetPurchase, packs, highlights, quoteUsdt, quoteNimFor, buyWithUsdt, buyWithNim, emailVerificationPending, termsAccepted } = useCredits()

  const allPacks = packs()
  const [selected, setSelected] = useState<CreditPack>(allPacks[1] || allPacks[0])
  const [nimQuote, setNimQuote] = useState<{ amount: number, credits: number, rateIsLive: boolean } | null>(null)
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  // First-purchase Terms & Conditions checkpoint (Tier 2.5) — a one-time gate
  // in front of whichever pay method the user actually clicked. `pendingBuy`
  // holds that choice while the checkbox confirmation is open.
  const [pendingBuy, setPendingBuy] = useState<'nim' | 'usdt' | null>(null)
  const [termsChecked, setTermsChecked] = useState(false)
  const [termsGateState, setTermsGateState] = useState<'idle' | 'confirming' | 'error'>('idle')
  // Nav-driven sections: exactly one of Top Up / Credit Card / Purchases shows
  // at a time, nothing shows until a nav button (or a nudge banner) is clicked.
  const [mode, setMode] = useState<CreditsMode>(null)
  // Optimistic default (true) so a slow account-overview check never blocks a
  // legitimately wallet-linked user — only flips false once confirmed absent,
  // same defensive pattern as WalletLinkNudge.tsx.
  const [hasWallet, setHasWallet] = useState(true)
  // Pessimistic default (false) — the opposite polarity from hasWallet above,
  // deliberately: this gates PayPal's payer-email matching (backlog 4.7 Part
  // B), so a false positive here (letting an unverified email through) is a
  // real correctness bug, not just a UX flash. Only flips true once Firebase
  // actually confirms it (checkEmailVerified reloads live, not a cached claim).
  const [emailVerified, setEmailVerified] = useState(false)
  const [notice, setNotice] = useState<'wallet' | 'linkEmail' | 'emailUnverified' | null>(null)

  const handleResend = async () => {
    setResendState('sending')
    try {
      await resendVerificationEmail()
      setResendState('sent')
    }
    catch {
      setResendState('error')
    }
  }

  const startBuy = (method: 'nim' | 'usdt') => {
    if (termsAccepted) {
      void (method === 'nim' ? buyWithNim(selected) : buyWithUsdt(selected))
      return
    }
    setPendingBuy(method)
    setTermsChecked(false)
    setTermsGateState('idle')
  }

  const confirmTermsAndBuy = async () => {
    if (!pendingBuy)
      return
    setTermsGateState('confirming')
    const ok = await acceptTerms().catch(() => false)
    if (!ok) {
      setTermsGateState('error')
      return
    }
    const method = pendingBuy
    setPendingBuy(null)
    void (method === 'nim' ? buyWithNim(selected) : buyWithUsdt(selected))
  }
  // The confirming/slow wait can run minutes long (rarely up to the reconciler's
  // 20-min grace window) — the modal must not trap the user for that whole time.
  // Hiding it here is purely a display choice: watchOrder's Firestore listener
  // (and the purchase itself) keeps running regardless, and a terminal result
  // (granted/failed) always forces the overlay back so it's never silently lost.
  const [overlayHidden, setOverlayHidden] = useState(false)

  useEffect(() => {
    if (!isLoggedIn)
      navigate('/login', { state: { redirectTo: '/credits' } })
  }, [isLoggedIn, navigate])

  useEffect(() => {
    if (flow.status === 'approving' || flow.status === 'granted' || flow.status === 'failed')
      setOverlayHidden(false)
  }, [flow.status])

  useEffect(() => {
    let cancelled = false
    setNimQuote(null)
    quoteNimFor(selected).then((quote) => {
      if (!cancelled)
        setNimQuote(quote)
    })
    return () => { cancelled = true }
  }, [selected])

  useEffect(() => {
    if (user?.provider === 'nimiq')
      return
    getAccountOverview()
      .then(overview => setHasWallet(overview.linkedAccounts.some(a => a.provider === 'nimiq')))
      .catch(() => {})
    checkEmailVerified()
      .then(v => setEmailVerified(v === true))
      .catch(() => {})
  }, [user])

  if (!isLoggedIn) {
    return (
      <div className="page-shell">
        <AppHeader />
        <div className="om-card text-center">{t.loginNeeded}</div>
      </div>
    )
  }

  const usdt = quoteUsdt(selected)
  // PayPal is for users without a crypto wallet — hidden for wallet sign-ins,
  // shown for email/Google. Runtime gate, not a build-time one (see 4.7).
  const showPaypal = isPaypalEnabled() && user?.provider !== 'nimiq'

  const handleNimClick = () => {
    if (hasWallet)
      setMode('nim')
    else {
      setMode('linkWallet')
      setNotice('wallet')
    }
  }

  const handleCardClick = () => {
    // A wallet-signed-in user has no active email/Google identity for PayPal
    // to match a payment against — guide them to sign in with one instead of
    // entering Credit Card mode at all (even if a wallet-linked email exists,
    // per the base rule: this gate is on the CURRENT sign-in, not any linked one).
    if (user?.provider === 'nimiq') {
      setNotice('linkEmail')
      return
    }
    if (!emailVerified) {
      setNotice('emailUnverified')
      return
    }
    setMode('card')
  }

  const flowStatus = flow.status
  const flowInProgress = flowStatus === 'approving' || flowStatus === 'submitted' || flowStatus === 'confirming' || flowStatus === 'slow'
  const flowCopy = flowStatus === 'idle' ? null : (pt as any)[flowStatus]

  return (
    <div className="page-shell">
      <AppHeader />

      {pendingBuy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true">
          <div className="om-card w-full max-w-sm text-center">
            <h3 className="text-lg font-extrabold mb-2">{t.termsGateTitle}</h3>
            <p className="text-sm mb-3" style={{ color: 'var(--text-60)' }}>{t.termsGateBody}</p>
            <a href="/terms" target="_blank" rel="noreferrer" className="text-sm font-semibold" style={{ color: 'var(--nimiq-light-blue)' }}>
              {t.termsGateLink}
            </a>
            <label className="flex items-center gap-2 mt-4 text-sm text-left cursor-pointer">
              <input type="checkbox" checked={termsChecked} onChange={e => setTermsChecked(e.target.checked)} />
              {t.termsGateCheckbox}
            </label>
            {termsGateState === 'error' && (
              <p className="text-xs mt-2 font-semibold m-0" style={{ color: 'var(--nimiq-red)' }}>{t.termsGateError}</p>
            )}
            <button
              className="om-button gold w-full mt-4"
              disabled={!termsChecked || termsGateState === 'confirming'}
              onClick={confirmTermsAndBuy}
            >
              {t.termsGateConfirm}
            </button>
            <button className="om-button secondary w-full mt-2" disabled={termsGateState === 'confirming'} onClick={() => setPendingBuy(null)}>
              {t.termsGateCancel}
            </button>
          </div>
        </div>
      )}

      {flowCopy && !overlayHidden && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true">
          <div className="om-card w-full max-w-sm text-center">
            {flowInProgress && (
              <Loader2 size={30} className="animate-spin mx-auto mb-3" style={{ color: 'var(--nimiq-light-blue)' }} />
            )}
            <h3 className="text-lg font-extrabold mb-2">{flowCopy.title}</h3>
            <p className="text-sm m-0" style={{ color: 'var(--text-60)' }}>{flowCopy.body}</p>
            {flowStatus === 'confirming' && flowCopy.hint && (
              <p className="text-xs mt-2 font-semibold m-0" style={{ color: 'var(--text-40)' }}>{flowCopy.hint}</p>
            )}
            {flowStatus === 'failed' && flow.txHash && (
              <p className="text-xs mt-3 mb-0 break-all" style={{ color: 'var(--text-40)' }}>
                {flowCopy.txLabel}: {flow.txHash}
              </p>
            )}
            {flowStatus === 'granted' && (
              <button className="om-button green w-full mt-4" onClick={resetPurchase}>{pt.close}</button>
            )}
            {flowStatus === 'failed' && (
              <button className="om-button secondary w-full mt-4" onClick={resetPurchase}>{pt.dismiss}</button>
            )}
            {flowInProgress && (
              <button className="om-button secondary w-full mt-4" onClick={() => setOverlayHidden(true)}>{pt.background}</button>
            )}
          </div>
        </div>
      )}

      {flowInProgress && overlayHidden && (
        <button
          className="om-button secondary w-full mb-4 flex items-center justify-center gap-2"
          onClick={() => setOverlayHidden(false)}
        >
          <Loader2 size={16} className="animate-spin" />
          {pt.resume}
        </button>
      )}

      {notice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} role="dialog" aria-modal="true">
          <div className="om-card w-full max-w-sm text-center">
            <p className="text-sm mb-4" style={{ color: 'var(--text-60)' }}>
              {notice === 'wallet' ? t.noWalletNotice : notice === 'linkEmail' ? t.linkEmailNotice : t.noEmailNotice}
            </p>
            <button className="om-button secondary w-full" onClick={() => setNotice(null)}>{t.noticeOk}</button>
          </div>
        </div>
      )}

      {emailVerificationPending && (
        <div className="om-card mb-4" style={{ borderColor: 'var(--nimiq-gold)' }}>
          <p className="text-sm font-extrabold mb-1 flex items-center gap-2">
            <Mail size={16} style={{ color: 'var(--nimiq-gold)' }} />
            {t.verifyHoldTitle}
          </p>
          <p className="text-xs m-0" style={{ color: 'var(--text-60)' }}>{t.verifyHoldBody}</p>
          {resendState === 'sent'
            ? <p className="text-xs mt-2 font-semibold m-0" style={{ color: 'var(--nimiq-green)' }}>{t.resendSent}</p>
            : (
                <button className="om-button secondary w-full mt-3" disabled={resendState === 'sending'} onClick={handleResend}>
                  {t.resend}
                </button>
              )}
          {resendState === 'error' && <p className="text-xs mt-2 font-semibold m-0" style={{ color: 'var(--nimiq-red)' }}>{t.resendError}</p>}
        </div>
      )}

      <div className="om-card mb-4 text-center">
        <p className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-40)' }}>{t.balance}</p>
        <p className="text-5xl font-extrabold my-2 flex items-center justify-center gap-2">
          <Coins size={32} style={{ color: 'var(--nimiq-gold)' }} />
          {balance}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-40)' }}>{user?.label}</p>
        {/* Credits are keyed by AuthUser.id (wallet address OR email), so a
            balance does not follow the user across sign-in methods. Disclose it
            here, where the purchase decision is made — not only in the terms. */}
        <p className="text-xs mt-2 mx-auto" style={{ color: 'var(--text-40)', maxWidth: '32rem' }}>{t.accountScope}</p>
        <div className="flex flex-wrap justify-center gap-2 mt-3">
          {highlights().map(item => (
            <span key={item} className="px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: 'var(--highlight-bg)', color: 'var(--text-60)' }}>
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          className="om-button secondary flex-1 !text-xs !min-h-[46px] !flex-col !gap-1"
          onClick={handleNimClick}
        >
          <Wallet size={16} />
          {t.navNim}
        </button>
        {showPaypal && (
          <button
            className="om-button secondary flex-1 !text-xs !min-h-[46px] !flex-col !gap-1"
            onClick={handleCardClick}
          >
            <CreditCard size={16} />
            {t.navCard}
          </button>
        )}
        <button
          className="om-button secondary flex-1 !text-xs !min-h-[46px] !flex-col !gap-1"
          onClick={() => setMode('history')}
        >
          <History size={16} />
          {t.navHistory}
        </button>
      </div>

      {mode === 'nim' && (
      <>
      <div className="om-card mb-4">
        <h2 className="text-lg font-extrabold mb-3">{t.packs}</h2>
        {/* Early-bird promo: the USD prices below are already discounted. */}
        <div
          className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 mb-3"
          style={{ background: 'var(--nimiq-gold-bg)', color: '#1f2348', boxShadow: '0 6px 18px rgba(233, 178, 19, 0.3)' }}
        >
          <PartyPopper size={18} className="shrink-0" />
          <p className="m-0 text-sm font-extrabold leading-tight">
            {t.earlyBird}
            <span className="block text-xs font-bold opacity-80">{t.earlyBirdUntil}</span>
          </p>
        </div>
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
              <div className="mt-1 leading-tight">
                {REGULAR_USD[pack.usd] && (
                  <div className="text-[11px] font-bold line-through" style={{ color: 'var(--text-40)' }}>
                    ${REGULAR_USD[pack.usd]}
                  </div>
                )}
                <div className="text-sm font-bold" style={{ color: 'var(--nimiq-light-blue)' }}>${pack.usd}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2.5">
          {/* NIM is the primary rail: buyWithNim fetches its own rate, so the
              button never waits on the display quote. */}
          <button className="om-button gold w-full" disabled={isPaying} onClick={() => startBuy('nim')}>
            {t.payNim}
            {nimQuote ? ` · ${t.approx} ${nimQuote.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} NIM` : ''}
          </button>
          {nimQuote && (
            <p className="text-xs text-center m-0" style={{ color: 'var(--text-40)' }}>
              {t.nimCredits(nimQuote.credits)} ({nimQuote.rateIsLive ? t.liveRate : t.fallbackRate}) — {t.bonus}
            </p>
          )}
          <button className="om-button green w-full" disabled={isPaying} onClick={() => startBuy('usdt')}>
            {t.payUsdt} · {usdt.amount} USDT
          </button>
          <p className="text-xs text-center m-0" style={{ color: 'var(--text-40)' }}>
            {t.usdtNetwork}
          </p>
          {/* Mini apps get no gas abstraction, so USDT needs POL for gas — this
              warning is required until we run a relayer. Confirmed limitation,
              designed fix, and why we keep the rail: docs/usdt-gas-abstraction.md */}
          <p className="text-xs text-center m-0" style={{ color: 'var(--nimiq-gold)' }}>
            {t.usdtGas}
          </p>
        </div>
        {error && <div className="nq-notice error" role="alert">{error === USDT_GAS_REQUIRED ? t.gasError : error}</div>}
      </div>
      <button
        onClick={handleCardClick}
        className="om-card mb-4 w-full text-left"
        style={{ cursor: 'pointer' }}
      >
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--text-40)' }}>{t.payCardBanner}</p>
        <h2 className="text-lg font-extrabold flex items-center gap-2 m-0"><CreditCard size={18} />{t.payCardTitle}</h2>
      </button>
      </>
      )}

      {mode === 'card' && showPaypal && (
      <>
      <PaypalPackageSelector t={t} />
      <button
        onClick={handleNimClick}
        className="w-full text-left rounded-2xl px-3 py-2.5 mb-2 font-extrabold text-sm"
        style={{ background: 'var(--nimiq-gold-bg)', color: '#1f2348', cursor: 'pointer', border: 'none' }}
      >
        {t.nimiqBonusBanner}
      </button>

      <NewOnNimiqCard t={t} />
      </>
      )}

      {mode === 'linkWallet' && <NewOnNimiqCard t={t} />}

      {mode === 'history' && (
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
      )}

      <button className="om-button secondary w-full" onClick={() => { logout(); navigate('/') }}>
        <LogOut size={16} />
        {t.logout}
      </button>
    </div>
  )
}
