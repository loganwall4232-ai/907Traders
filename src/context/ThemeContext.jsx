import { createContext, useContext, useEffect, useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './AuthContext'

const THEMES = {
  default: {
    name: 'Pure Black Glass',
    '--bg': '#0a0a0a',
    '--bg-secondary': '#111111',
    '--bg-tertiary': '#161616',
    '--card-bg': 'rgba(255,255,255,0.04)',
    '--card-border': 'rgba(255,255,255,0.08)',
    '--text-primary': '#ffffff',
    '--text-secondary': 'rgba(255,255,255,0.55)',
    '--text-muted': 'rgba(255,255,255,0.3)',
    '--accent': '#00e5ff',
    '--accent-dim': 'rgba(0,229,255,0.15)',
    '--profit': '#00e676',
    '--loss': '#ff1744',
    '--reversal': '#ff7043',
    '--confirmation': '#4dd0e1',
    '--continuation': '#69f0ae',
    '--shadow-color': 'rgba(0,229,255,0.18)',
    '--shadow-opacity': '0.18',
    '--top-bar-bg': 'rgba(10,10,10,0.94)',
    '--bottom-bar-bg': 'rgba(10,10,10,0.94)',
  },
  forest: {
    name: 'Forest',
    '--bg': '#0d1a0f',
    '--bg-secondary': '#111f13',
    '--bg-tertiary': '#162618',
    '--card-bg': 'rgba(255,255,255,0.04)',
    '--card-border': 'rgba(105,240,174,0.12)',
    '--text-primary': '#e8f5e9',
    '--text-secondary': 'rgba(232,245,233,0.55)',
    '--text-muted': 'rgba(232,245,233,0.3)',
    '--accent': '#69f0ae',
    '--accent-dim': 'rgba(105,240,174,0.15)',
    '--profit': '#69f0ae',
    '--loss': '#ff5252',
    '--reversal': '#ffab40',
    '--confirmation': '#40c4ff',
    '--continuation': '#b9f6ca',
    '--shadow-color': 'rgba(105,240,174,0.18)',
    '--shadow-opacity': '0.18',
    '--top-bar-bg': 'rgba(13,26,15,0.94)',
    '--bottom-bar-bg': 'rgba(13,26,15,0.94)',
  },
  midnight: {
    name: 'Midnight',
    '--bg': '#070714',
    '--bg-secondary': '#0d0d24',
    '--bg-tertiary': '#12122e',
    '--card-bg': 'rgba(255,255,255,0.04)',
    '--card-border': 'rgba(124,77,255,0.2)',
    '--text-primary': '#e8e8ff',
    '--text-secondary': 'rgba(232,232,255,0.55)',
    '--text-muted': 'rgba(232,232,255,0.3)',
    '--accent': '#7c4dff',
    '--accent-dim': 'rgba(124,77,255,0.15)',
    '--profit': '#69f0ae',
    '--loss': '#ff5252',
    '--reversal': '#ff6e40',
    '--confirmation': '#40c4ff',
    '--continuation': '#b388ff',
    '--shadow-color': 'rgba(124,77,255,0.2)',
    '--shadow-opacity': '0.2',
    '--top-bar-bg': 'rgba(7,7,20,0.95)',
    '--bottom-bar-bg': 'rgba(7,7,20,0.95)',
  },
  crimson: {
    name: 'Crimson',
    '--bg': '#0f0a0a',
    '--bg-secondary': '#1a0f0f',
    '--bg-tertiary': '#1f1212',
    '--card-bg': 'rgba(255,255,255,0.04)',
    '--card-border': 'rgba(229,57,53,0.18)',
    '--text-primary': '#fff8f8',
    '--text-secondary': 'rgba(255,248,248,0.55)',
    '--text-muted': 'rgba(255,248,248,0.3)',
    '--accent': '#e53935',
    '--accent-dim': 'rgba(229,57,53,0.15)',
    '--profit': '#69f0ae',
    '--loss': '#ff5252',
    '--reversal': '#ff7043',
    '--confirmation': '#4dd0e1',
    '--continuation': '#ffcc80',
    '--shadow-color': 'rgba(229,57,53,0.2)',
    '--shadow-opacity': '0.2',
    '--top-bar-bg': 'rgba(15,10,10,0.95)',
    '--bottom-bar-bg': 'rgba(15,10,10,0.95)',
  },
}

const LS_KEY = 'trader_theme'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const { user } = useAuth()
  const [themeKey, setThemeKey] = useState(() => localStorage.getItem(LS_KEY) || 'default')

  useEffect(() => {
    applyTheme(THEMES[themeKey] || THEMES.default)
  }, [themeKey])

  function applyTheme(vars) {
    const root = document.documentElement
    Object.entries(vars).forEach(([key, val]) => {
      if (key.startsWith('--')) root.style.setProperty(key, val)
    })
  }

  async function setTheme(key) {
    setThemeKey(key)
    localStorage.setItem(LS_KEY, key)
    if (user) {
      try {
        await updateDoc(doc(db, 'users', user.uid), { theme: key })
      } catch (_) {}
    }
  }

  const accent = (THEMES[themeKey] || THEMES.default)['--accent']

  return (
    <ThemeContext.Provider value={{ themeKey, themes: THEMES, setTheme, accent }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
