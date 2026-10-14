export type Theme = 'light' | 'dark'

/** localStorage key for the viewer's choice. index.html reads the same key before first paint. */
export const THEME_STORAGE_KEY = 'pgc-theme'

/** A saved choice wins; otherwise follow the operating system. */
export function resolveTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored
  return prefersDark ? 'dark' : 'light'
}
