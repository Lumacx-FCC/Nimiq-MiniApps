/**
 * App-wide theme (light/dark) and locale (en/es) — every page shows both
 * toggles in the header. Choices persist per device.
 */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'

export type Theme = 'light' | 'dark'
export type Lang = 'en' | 'es'

const THEME_KEY = 'otherme:theme'
const LANG_KEY = 'otherme:lang'

interface AppSettings {
  theme: Theme
  toggleTheme: () => void
  lang: Lang
  toggleLang: () => void
}

const SettingsContext = createContext<AppSettings | null>(null)

function initialTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY) as Theme | null
  if (stored === 'light' || stored === 'dark')
    return stored
  return 'dark' // product default; the user's toggle choice persists above
}

function initialLang(): Lang {
  const stored = localStorage.getItem(LANG_KEY) as Lang | null
  if (stored === 'en' || stored === 'es')
    return stored
  return 'en' // product default; the user's toggle choice persists above
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.lang = lang
    localStorage.setItem(LANG_KEY, lang)
  }, [lang])

  const toggleTheme = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])
  const toggleLang = useCallback(() => setLang(l => (l === 'en' ? 'es' : 'en')), [])

  const value = useMemo(() => ({ theme, toggleTheme, lang, toggleLang }), [theme, toggleTheme, lang, toggleLang])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): AppSettings {
  const context = useContext(SettingsContext)
  if (!context)
    throw new Error('useSettings must be used inside <AppProviders>')
  return context
}
