/**
 * Shared header: OM logo (home navigation), credits pill when logged in,
 * theme + language toggles. Present on every page.
 */
import { Coins, Home, Images, LogOut, Moon, Sun } from 'lucide-react'
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
      <Link to="/" className="flex items-center gap-2 no-underline min-w-0" style={{ color: 'var(--text-100)' }}>
        {/* Fixed-size wrapper guarantees a perfect round box (no flex squish);
            object-cover keeps the icon's ratio inside it. */}
        <span className="w-9 h-9 shrink-0 rounded-full overflow-hidden inline-flex">
          <img
            src={theme === 'dark' ? '/otherme-icon-dark.png' : '/otherme-icon-light.png'}
            alt="Other Me"
            className="w-full h-full object-cover"
          />
        </span>
        {/* Wordmark collapses on the narrowest phones so the action chips fit. */}
        <span className="font-extrabold text-lg tracking-tight truncate hidden min-[400px]:inline">{title || 'Other Me'}</span>
        {!isHome && <Home size={16} className="shrink-0 hidden min-[400px]:inline" style={{ color: 'var(--text-40)' }} aria-label={lang === 'es' ? 'Volver al inicio' : 'Back to home'} />}
      </Link>

      <div className="flex items-center gap-1.5 shrink-0">
        {isLoggedIn && pathname !== '/gallery' && (
          <Link
            to="/gallery"
            className="icon-chip no-underline"
            aria-label={lang === 'es' ? 'Galería' : 'Gallery'}
            title={lang === 'es' ? 'Galería' : 'Gallery'}
          >
            <Images size={16} />
          </Link>
        )}
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
        <button className="icon-chip" onClick={toggleLang} aria-label={lang === 'es' ? 'Idioma' : 'Language'} title={lang === 'es' ? 'Idioma' : 'Language'}>
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
