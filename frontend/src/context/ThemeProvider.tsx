import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import {
  ThemeProvider as NextThemesProvider,
  useTheme as useNextTheme,
  type ThemeProviderProps,
} from 'next-themes'

export type ThemeName = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

interface ThemeContextValue {
  theme: ThemeName
  resolvedTheme: ResolvedTheme
  isDark: boolean
  isReady: boolean
  setTheme: (theme: ThemeName) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function ThemeContextBridge({ children }: { children: ReactNode }) {
  const { theme, resolvedTheme, setTheme } = useNextTheme()

  const currentTheme: ThemeName =
    theme === 'light' || theme === 'dark' || theme === 'system' ? theme : 'system'
  const currentResolvedTheme: ResolvedTheme = resolvedTheme === 'dark' ? 'dark' : 'light'
  const isDark = currentResolvedTheme === 'dark'

  // Add theme-ready class after mount so transitions don't fire on initial paint
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      document.documentElement.classList.add('theme-ready')
    })
    return () => cancelAnimationFrame(raf)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: currentTheme,
      resolvedTheme: currentResolvedTheme,
      isDark,
      isReady: theme !== undefined || resolvedTheme !== undefined,
      setTheme: (nextTheme) => setTheme(nextTheme),
      toggleTheme: () => setTheme(isDark ? 'light' : 'dark'),
    }),
    [currentResolvedTheme, currentTheme, isDark, resolvedTheme, setTheme, theme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      storageKey="scavngr-theme"
      // transitions are handled via CSS + theme-ready class instead
      {...props}
    >
      <ThemeContextBridge>{children}</ThemeContextBridge>
    </NextThemesProvider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}
