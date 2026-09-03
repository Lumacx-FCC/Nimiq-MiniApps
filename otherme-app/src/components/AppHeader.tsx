/**
 * Shared header: OM logo (home navigation), credits pill when logged in,
 * theme + language toggles. Present on every page.
 */
import { Coins, Home, Images, LogOut, Moon, ShieldCheck, Sun, User } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useSettings } from '../app/providers'
import { useAuth } from '../core/auth'
import { useCredits } from '../core/credits'
import { isAdmin } from '../core/admin'

export default function AppHeader({ title }: { title?: string }) {
  const { theme, toggleTheme, lang, toggleLang } = useSettings()
  const { isLoggedIn, user, logout } = useAuth()
  const { balance } = useCredits()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const isHome = pathname === '/'
  const wordmark = title || 'Other Me'

  const [admin, setAdmin] = useState(false)
  useEffect(() => {
    if (!isLoggedIn) {
      setAdmin(false)
      return
    }
    isAdmin().then(setAdmin)
  }, [isLoggedIn])

  /**
   * Wordmark visibility used to be a fixed Tailwind breakpoint (first 400px,
   * then 480px, then 560px) — every bump got outrun again by content that
   * varies at runtime: the credit balance grows past a single digit (5 ->
   * 205 ->  ...), and some pages pass longer titles ("Creador de
   * Personajes"). A static px guess can't account for that. This instead
   * measures the ACTUAL rendered widths (logo + wordmark's natural,
   * untruncated size + the icon row) against the header's real available
   * width, on every render and on resize, and shows the wordmark in full or
   * not at all — never a mid-word truncation like "Other ...".
   */
  const headerRef = useRef<HTMLElement>(null)
  const logoFixedRef = useRef<HTMLSpanElement>(null)
  // Permanently mounted (never hidden), so its width always reflects the
  // FULL wordmark regardless of whether the real one is currently shown.
  const wordmarkMeasureRef = useRef<HTMLSpanElement>(null)
  const iconsRef = useRef<HTMLDivElement>(null)
  const [showWordmark, setShowWordmark] = useState(true)

  useLayoutEffect(() => {
    const header = headerRef.current
    const logoFixed = logoFixedRef.current
    const wordmarkMeasure = wordmarkMeasureRef.current
    const icons = iconsRef.current
    if (!header || !logoFixed || !wordmarkMeasure || !icons)
      return

    const recalc = () => {
      const available = header.clientWidth
      const required = logoFixed.getBoundingClientRect().width
        + wordmarkMeasure.getBoundingClientRect().width
        + icons.getBoundingClientRect().width
        + 16 // header's own gap-2 between the two flex children, plus a little breathing room
      setShowWordmark(required <= available)
    }
    recalc()
    const ro = new ResizeObserver(recalc)
    ro.observe(header)
    return () => ro.disconnect()
  }, [wordmark, balance, admin, isLoggedIn, pathname])

  return (
    <header ref={headerRef} className="flex items-center justify-between gap-2 mb-4">
      <Link to="/" className="flex items-center gap-2 no-underline min-w-0 overflow-hidden" style={{ color: 'var(--text-100)' }}>
        <span ref={logoFixedRef} className="flex items-center gap-2 shrink-0">
          {/* Fixed-size wrapper guarantees a perfect round box (no flex squish);
              object-cover keeps the icon's ratio inside it. */}
          <span className="w-9 h-9 shrink-0 rounded-full overflow-hidden inline-flex">
            <img
              src={theme === 'dark' ? '/otherme-icon-dark.png' : '/otherme-icon-light.png'}
              alt="Other Me"
              className="w-full h-full object-cover"
            />
          </span>
          {!isHome && <Home size={16} className="shrink-0" style={{ color: 'var(--text-40)' }} aria-label={lang === 'es' ? 'Volver al inicio' : 'Back to home'} />}
        </span>
        {showWordmark && <span className="font-extrabold text-lg tracking-tight whitespace-nowrap">{wordmark}</span>}
        <span
          ref={wordmarkMeasureRef}
          aria-hidden="true"
          className="font-extrabold text-lg tracking-tight whitespace-nowrap"
          style={{ position: 'absolute', visibility: 'hidden', pointerEvents: 'none' }}
        >
          {wordmark}
        </span>
      </Link>

      <div ref={iconsRef} className="flex items-center gap-1.5 shrink-0">
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
        {isLoggedIn && pathname !== '/profile' && (
          <Link
            to="/profile"
            className="icon-chip no-underline"
            aria-label={lang === 'es' ? 'Perfil' : 'Profile'}
            title={lang === 'es' ? 'Perfil' : 'Profile'}
          >
            <User size={16} />
          </Link>
        )}
        {admin && pathname !== '/promos_management' && (
          <Link
            to="/promos_management"
            className="icon-chip no-underline"
            aria-label="Promos management"
            title="Promos management"
          >
            <ShieldCheck size={16} />
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
