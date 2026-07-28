/**
 * Login — Nimiq wallet primary (one native dialog inside Nimiq Pay),
 * email/password fallback for browser demos. Mirrors core-modules LoginCard.
 */
import { KeyRound, LogIn, Mail, Wallet } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import AppHeader from '../components/AppHeader'

const COPY = {
  en: {
    title: 'Welcome to Other Me',
    // Was "One account for characters, avatars and credits" — untrue: credits and
    // saved work are keyed per sign-in method and are not yet linked.
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
    accountScope: 'Credits and saved characters stay with the sign-in method you choose — a wallet balance won’t appear under an email login yet. Account linking is coming soon.',
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
    accountScope: 'Los créditos y personajes guardados quedan ligados al método que elijas — un saldo de wallet aún no aparece en un inicio de sesión por email. La vinculación de cuentas llegará pronto.',
  },
} as const

export default function Login() {
  const { lang } = useSettings()
  const t = COPY[lang]
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state || {}) as { notice?: string, redirectTo?: string }
  const { isBusy, error, canUseNimiq, canUseGoogle, loginWithNimiq, loginWithGoogle, loginWithEmail, signUpWithEmail } = useAuth()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

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

  return (
    <div className="page-shell">
      <AppHeader />

      <div className="om-card">
        <h1 className="text-2xl font-extrabold text-center mb-1">{t.title}</h1>
        <p className="text-sm text-center mb-3" style={{ color: 'var(--text-60)' }}>{t.subtitle}</p>
        {/* Credits are keyed per sign-in method (wallet address vs email) and are
            not linked yet — say so before the user picks one. */}
        <p className="text-xs text-center mb-5" style={{ color: 'var(--text-40)' }}>{t.accountScope}</p>

        {state.notice && <div className="nq-notice info mb-4" role="status">{state.notice}</div>}

        <button className="om-button blue w-full" disabled={isBusy} onClick={async () => finish(await loginWithNimiq())}>
          <Wallet size={18} />
          {t.nimiq}
        </button>
        <p className="text-xs text-center mt-2" style={{ color: 'var(--text-40)' }}>
          {canUseNimiq() ? t.nimiqHint : t.outsidePay}
        </p>

        {canUseGoogle() && (
          <button className="om-button secondary w-full mt-3" disabled={isBusy} onClick={async () => finish(await loginWithGoogle())}>
            <LogIn size={18} />
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

        <button
          className="block mx-auto mt-4 text-sm font-bold bg-transparent border-none cursor-pointer"
          style={{ color: 'var(--nimiq-light-blue)' }}
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? t.switchToSignUp : t.switchToLogIn}
        </button>

        {error && <div className="nq-notice error" role="alert">{error}</div>}
      </div>
    </div>
  )
}
