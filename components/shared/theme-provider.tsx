'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'

type ThemeContextType = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const stored = localStorage.getItem('theme') as Theme | null
    if (stored) {
      setThemeState(stored)
    }
  }, [])

  useEffect(() => {
    if (!mounted) return

    localStorage.setItem('theme', theme)

    const root = document.documentElement

    if (theme === 'system') {
      const mql = window.matchMedia('(prefers-color-scheme: dark)')
      const apply = () => {
        root.classList.toggle('dark', mql.matches)
        root.classList.toggle('light', !mql.matches)
      }
      apply()
      // Follow OS theme changes live while "system" is selected
      mql.addEventListener('change', apply)
      return () => mql.removeEventListener('change', apply)
    }

    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme !== 'dark')
  }, [theme, mounted])

  const setTheme = (t: Theme) => {
    setThemeState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
