/**
 * Login — Nimiq wallet primary (one native dialog inside Nimiq Pay),
 * email/password fallback for browser demos. Mirrors core-modules LoginCard.
 */
import { KeyRound, Mail, Wallet } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import AppHeader from '../components/AppHeader'

const COPY = {
  en: {
    title: 'Welcome to Other Me',
    subtitle: 'Sign in to save characters, avatars and credits.',
    nimiq: 'Continue with Nimiq Wallet',
    nimiqHint: 'Opens the native wallet dialog — no password needed.',
    outsidePay: 'Wallet login works inside Nimiq Pay. In the browser, use email below.',
    or: 'or',
    email: 'Email',
    password: 'Password',
    logIn: 'Log in',
    signUp: 'Create account',
    switchToSignUp: 'New here? Create an account',
    switchToLogIn: 'Already have an account? Log in',
    google: 'Continue with Google',
    accountScope: 'Credits and saved characters stay with the sign-in method you choose by default — link another login from your Profile page to combine balances across a wallet, email, and Google.',
    forgotPassword: 'Forgot password?',
    resetSent: 'If an account exists for that email, a reset link is on its way.',
    resetNeedsEmail: 'Enter your email above first, then tap "Forgot password?"',
  },
  es: {
    title: 'Bienvenido a Other Me',
    subtitle: 'Inicia sesión para guardar personajes, avatares y créditos.',
    nimiq: 'Continuar con Nimiq Wallet',
    nimiqHint: 'Abre el diálogo nativo de la wallet — sin contraseña.',
    outsidePay: 'El login con wallet funciona dentro de Nimiq Pay. En navegador usa email.',
    or: 'o',
    email: 'Email',
    password: 'Contraseña',
    logIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    switchToSignUp: '¿Nuevo aquí? Crea una cuenta',
    switchToLogIn: '¿Ya tienes cuenta? Inicia sesión',
    google: 'Continuar con Google',
    accountScope: 'Los créditos y personajes guardados quedan ligados al método que elijas por defecto — vincula otro inicio de sesión desde tu perfil para combinar saldos entre wallet, email y Google.',
    forgotPassword: '¿Olvidaste tu contraseña?',
    resetSent: 'Si existe una cuenta con ese email, un enlace para restablecerla está en camino.',
    resetNeedsEmail: 'Escribe tu email arriba primero y luego toca "¿Olvidaste tu contraseña?"',
  },
} as const

/** Redirect notices, keyed so Login.tsx resolves them against its own live
 * `lang` at render time instead of the caller baking in a string at navigate()
 * time (which used to freeze the notice in whatever language was active on
 * the page that redirected here). */
const NOTICE_COPY = {
  freeOver: {
    en: 'Free generations used — log in to continue',
    es: 'Generaciones gratis agotadas — inicia sesión para continuar',
  },
  unlockFeature: {
    en: 'Log in first to unlock this feature',
    es: 'Inicia sesión primero para desbloquear esta función',
  },
  talkLogin: {
    en: 'Log in to talk and create',
    es: 'Inicia sesión para hablar y crear',
  },
} as const

/** Official Google "G" mark — per Google's sign-in button branding guidelines. */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.87 2.7-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.17.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z" />
    </svg>
  )
}

export default function Login() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as { noticeKey?: keyof typeof NOTICE_COPY, redirectTo?: string }
  const { isBusy, error, canUseNimiq, canUseGoogle, loginWithNimiq, loginWithGoogle, loginWithEmail, signUpWithEmail, requestPasswordReset } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetNotice, setResetNotice] = useState<string | null>(null)

  const finish = (ok: boolean) => {
    if (ok)
      navigate(state.redirectTo || '/gallery')
  }

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault()
    if (!email || !password)
      return
    finish(mode === 'login' ? await loginWithEmail(email, password) : await signUpWithEmail(email, password))
  }

  const forgotPassword = async () => {
    if (!email) {
      setResetNotice(t.resetNeedsEmail)
      return
    }
    // Always show the same notice regardless of whether the email exists —
    // don't let this endpoint reveal which addresses have accounts.
    requestPasswordReset(email).catch(() => {})
    setResetNotice(t.resetSent)
  }

  return (
    <div className="page-shell">
      <AppHeader />

      <div className="om-card">
        <h1 className="text-2xl font-extrabold text-center mb-1">{t.title}</h1>
        <p className="text-sm text-center mb-3" style={{ color: 'var(--text-60)' }}>{t.subtitle}</p>
        {/* Credits are keyed per sign-in method by default; linking (Profile page)
            merges them — say so before the user picks a sign-in method. */}
        <p className="text-xs text-center mb-5" style={{ color: 'var(--text-40)' }}>{t.accountScope}</p>

        {state.noticeKey && <div className="nq-notice info mb-4" role="status">{NOTICE_COPY[state.noticeKey][lang]}</div>}

        <button className="om-button blue w-full" disabled={isBusy} onClick={async () => finish(await loginWithNimiq())}>
          <Wallet size={18} />
          {t.nimiq}
          <img src="/nimiq-hexagon.svg" alt="" width={18} height={18} />
        </button>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-40)' }}>
          {canUseNimiq() ? t.nimiqHint : t.outsidePay}
        </p>

        {canUseGoogle() && (
          <button
            className="om-button w-full mt-3"
            disabled={isBusy}
            onClick={async () => finish(await loginWithGoogle())}
            style={{ background: '#fff', color: '#3c4043', boxShadow: '0 1px 2px rgba(0,0,0,0.25)', border: '1px solid #dadce0' }}
          >
            <GoogleIcon />
            {t.google}
          </button>
        )}

        <div className="flex items-center gap-3 my-5 text-xs font-bold" style={{ color: 'var(--text-40)' }}>
          <span className="flex-1 h-px" style={{ background: 'var(--highlight-bg)' }} />
          {t.or}
          <span className="flex-1 h-px" style={{ background: 'var(--highlight-bg)' }} />
        </div>

        <form onSubmit={submitEmail} className="flex flex-col gap-3">
          <label className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'var(--highlight-bg)' }}>
            <Mail size={16} style={{ color: 'var(--text-40)' }} />
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={t.email}
              className="flex-1 bg-transparent outline-none text-base"
              style={{ color: 'var(--text-100)' }}
            />
          </label>
          <label className="flex items-center gap-2 rounded-xl px-4 py-3" style={{ background: 'var(--highlight-bg)' }}>
            <KeyRound size={16} style={{ color: 'var(--text-40)' }} />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t.password}
              className="flex-1 bg-transparent outline-none text-base"
              style={{ color: 'var(--text-100)' }}
            />
          </label>
          <button type="submit" className="om-button w-full" disabled={isBusy}>
            {mode === 'login' ? t.logIn : t.signUp}
          </button>
        </form>

        {mode === 'login' && (
          <button
            className="block mx-auto mt-3 text-xs font-bold bg-transparent border-none cursor-pointer"
            style={{ color: 'var(--text-40)' }}
            onClick={forgotPassword}
          >
            {t.forgotPassword}
          </button>
        )}

        <button
          className="block mx-auto mt-4 text-sm font-bold bg-transparent border-none cursor-pointer"
          style={{ color: 'var(--nimiq-light-blue)' }}
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? t.switchToSignUp : t.switchToLogIn}
        </button>

        {resetNotice && <div className="nq-notice info mt-4" role="status">{resetNotice}</div>}
        {error && <div className="nq-notice error" role="alert">{error}</div>}
      </div>
    </div>
  )
}
