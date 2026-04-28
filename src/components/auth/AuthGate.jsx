import { useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '../../firebase'

/* ── Group password gate ──────────────────────────── */
function PasswordGate({ onVerified }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function check(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const snap = await getDoc(doc(db, 'settings', 'app'))
      const stored = snap.data()?.groupPassword
      if (!stored || pw === stored) {
        onVerified()
      } else {
        setErr('Wrong password. Try again.')
      }
    } catch {
      setErr('Connection error. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="gate-wrap">
      <div className="gate-card card-lg">
        <div className="gate-logo glow">907Traders</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
          Enter the group password to continue
        </p>
        <form onSubmit={check} className="flex-col gap-12">
          <input
            type="password"
            className="input"
            placeholder="Group password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
          />
          {err && <div className="loss" style={{ fontSize: '0.85rem' }}>{err}</div>}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading || !pw}>
            {loading ? <span className="spinner" /> : 'Enter'}
          </button>
        </form>
      </div>
      <style>{`
        .gate-wrap {
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
          padding: 24px;
        }
        .gate-card { width: 100%; max-width: 380px; }
        .gate-logo {
          font-family: 'Space Grotesk', sans-serif;
          font-size: 2rem;
          font-weight: 800;
          color: var(--accent);
          text-align: center;
          margin-bottom: 8px;
        }
      `}</style>
    </div>
  )
}

/* ── Firebase login ───────────────────────────────── */
function LoginGate() {
  const { loginWithGoogle, loginWithEmail, registerWithEmail } = useAuth()
  const [mode, setMode] = useState('login') // login | register
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleEmail(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      if (mode === 'register') {
        await registerWithEmail(email, password, name)
      } else {
        await loginWithEmail(email, password)
      }
    } catch (e) {
      setErr(friendlyErr(e.code))
    }
    setLoading(false)
  }

  async function handleGoogle() {
    setErr('')
    try { await loginWithGoogle() }
    catch (e) { setErr(friendlyErr(e.code)) }
  }

  return (
    <div className="gate-wrap">
      <div className="gate-card card-lg">
        <div className="gate-logo glow">907Traders</div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, textAlign: 'center' }}>
          {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
        </p>

        <button className="btn btn-ghost btn-full" style={{ marginBottom: 16 }} onClick={handleGoogle}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="divider" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="muted" style={{ fontSize: '0.75rem' }}>or</span>
        </div>

        <form onSubmit={handleEmail} className="flex-col gap-12 mt-12">
          {mode === 'register' && (
            <input className="input" placeholder="Display name" value={name} onChange={(e) => setName(e.target.value)} required />
          )}
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {err && <div className="loss" style={{ fontSize: '0.85rem' }}>{err}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? <span className="spinner" /> : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          className="btn btn-ghost btn-full mt-8"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign In'}
        </button>
      </div>
      <style>{`
        .gate-wrap { min-height: 100dvh; display: flex; align-items: center; justify-content: center; background: var(--bg); padding: 24px; }
        .gate-card { width: 100%; max-width: 380px; }
        .gate-logo { font-family: 'Space Grotesk', sans-serif; font-size: 2rem; font-weight: 800; color: var(--accent); text-align: center; margin-bottom: 8px; }
      `}</style>
    </div>
  )
}

/* ── Kick overlay (password changed) ─────────────── */
export function KickOverlay({ onReenter }) {
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  async function check(e) {
    e.preventDefault()
    setLoading(true)
    setErr('')
    try {
      const snap = await getDoc(doc(db, 'settings', 'app'))
      if (pw === snap.data()?.groupPassword) {
        onReenter()
      } else {
        setErr('Wrong password.')
      }
    } catch { setErr('Connection error.') }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
      <div className="card-lg" style={{ maxWidth: 380, width: '100%' }}>
        <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>Group password changed</div>
        <p style={{ marginBottom: 20 }}>Enter the new password to continue.</p>
        <form onSubmit={check} className="flex-col gap-12">
          <input type="password" className="input" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          {err && <div className="loss" style={{ fontSize: '0.85rem' }}>{err}</div>}
          <button type="submit" className="btn btn-primary btn-full" disabled={loading || !pw}>
            {loading ? <span className="spinner" /> : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  )
}

function friendlyErr(code) {
  const map = {
    'auth/wrong-password': 'Incorrect password.',
    'auth/user-not-found': 'No account with that email.',
    'auth/email-already-in-use': 'Email already registered.',
    'auth/weak-password': 'Password must be 6+ characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/popup-closed-by-user': 'Sign-in cancelled.',
  }
  return map[code] || 'Something went wrong. Try again.'
}

/* ── Main export ──────────────────────────────────── */
export default function AuthGate({ children }) {
  const { user, loading, gpVerified, verifyGroupPassword } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
      </div>
    )
  }

  if (!gpVerified) return <PasswordGate onVerified={verifyGroupPassword} />
  if (!user) return <LoginGate />
  return children
}
