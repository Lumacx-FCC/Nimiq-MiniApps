/**
 * Shared header: OM logo (home navigation), credits pill when logged in,
 * theme + language toggles. Present on every page.
 */
import { Coins, Home, Languages, LogOut, Moon, Sun } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { useCredits } from '../core/credits'

export default function AppHeader({ title }: { title?: string }) {
  const { theme, toggleTheme, lang, toggleLang } = useSettings()
  const { isLoggedIn, user, logout } = useAuth()
  const { balance } = useCredits()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isHome = pathname === '/'

  return (
    <header className="flex items-center justify-between gap-2 mb-4">
      <Link to="/" className="flex items-center gap-2 no-underline" style={{ color: 'var(--text-100)' }}>
        <img
          src={theme === 'dark' ? '/otherme-icon-dark.png' : '/otherme-icon-light.png'}
          alt="Other Me"
          className="w-9 h-9 rounded-full"
        />
        <span className="font-extrabold text-lg tracking-tight">{title || 'Other Me'}</span>
        {!isHome && <Home size={16} style={{ color: 'var(--text-40)' }} aria-label={lang === 'es' ? 'Volver al inicio' : 'Back to home'} />}
      </Link>

      <div className="flex items-center gap-1.5">
        {isLoggedIn && (
          <Link
            to="/credits"
            className="icon-chip no-underline"
            title={user?.label}
            aria-label={lang === 'es' ? 'Créditos' : 'Credits'}
          >
            <Coins size={15} style={{ color: 'var(--nimiq-gold)' }} />
            <strong>{balance}</strong>
          </Link>
        )}
        <button className="icon-chip" onClick={toggleTheme} aria-label={lang === 'es' ? 'Cambiar tema' : 'Toggle theme'}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button className="icon-chip" onClick={toggleLang} aria-label="Language">
          <Languages size={15} />
          {lang.toUpperCase()}
        </button>
        {isLoggedIn && (
          <button
            className="icon-chip"
            onClick={() => { logout(); navigate('/') }}
            title={lang === 'es' ? 'Cerrar sesión' : 'Log out'}
            aria-label={lang === 'es' ? 'Cerrar sesión' : 'Log out'}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </header>
  )
}
