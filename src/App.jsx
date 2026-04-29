import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import AuthGate from './components/auth/AuthGate'
import TopBar from './components/layout/TopBar'
import NavBar from './components/layout/NavBar'
import Strategy from './pages/Strategy'
import Log from './pages/Log'
import WarRoom from './pages/WarRoom'
import MyStats from './pages/MyStats'
import Admin from './pages/Admin'
import News from './pages/News'
import './styles/index.css'
import './styles/premium.css'

gsap.registerPlugin(ScrollTrigger)

function AppShell() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
    })

    // Sync Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update)

    gsap.ticker.add((time) => {
      lenis.raf(time * 1000)
    })
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.destroy()
      gsap.ticker.remove((time) => lenis.raf(time * 1000))
    }
  }, [])

  return (
    <div className="app-shell">
      <TopBar />
      <main className="page-content">
        <Routes>
          <Route path="/"          element={<Navigate to="/strategy" replace />} />
          <Route path="/strategy"  element={<Strategy />} />
          <Route path="/log"       element={<Log />} />
          <Route path="/warroom"   element={<WarRoom />} />
          <Route path="/stats"     element={<MyStats />} />
          <Route path="/news"      element={<News />} />
          <Route path="/admin"     element={<Admin />} />
          <Route path="*"          element={<Navigate to="/strategy" replace />} />
        </Routes>
      </main>
      <NavBar />
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <ThemeProvider>
          <AuthGate>
            <AppShell />
          </AuthGate>
        </ThemeProvider>
      </AuthProvider>
    </HashRouter>
  )
}
