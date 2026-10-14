import { create } from 'zustand'
import { resolveTheme, THEME_STORAGE_KEY, type Theme } from '@/lib/theme'

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

function readSaved(): string | null {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY)
  } catch {
    return null
  }
}

function save(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Storage unavailable (e.g. private browsing): the theme still applies for this visit
  }
}

function apply(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: resolveTheme(readSaved(), darkQuery.matches),
  toggle: () => {
    const theme: Theme = get().theme === 'dark' ? 'light' : 'dark'
    save(theme)
    apply(theme)
    set({ theme })
  },
}))

// Follow the OS setting until the viewer picks a theme themselves
darkQuery.addEventListener('change', (event) => {
  if (readSaved()) return
  const theme: Theme = event.matches ? 'dark' : 'light'
  apply(theme)
  useThemeStore.setState({ theme })
})
