import { computed, ref } from 'vue'
import { getConfig } from './config'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = () => `${getConfig().appId}:theme`

const theme = ref<Theme>('light')
let initialized = false

function apply(next: Theme): void {
  theme.value = next
  document.documentElement.dataset.theme = next
}

function ensureInitialized(): void {
  if (initialized)
    return
  initialized = true
  const stored = localStorage.getItem(STORAGE_KEY()) as Theme | null
  const system: Theme = window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  apply(stored ?? system)
}

/**
 * Shared light/dark mode for all our mini apps.
 * Defaults to the device preference, remembers the user's choice.
 */
export function useTheme() {
  ensureInitialized()
  return {
    theme: computed(() => theme.value),
    isDark: computed(() => theme.value === 'dark'),
    toggle: () => {
      const next: Theme = theme.value === 'dark' ? 'light' : 'dark'
      apply(next)
      localStorage.setItem(STORAGE_KEY(), next)
    },
  }
}
