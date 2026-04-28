import { useState } from 'react'
import { X, Palette, LogOut, Shield } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'

const THEME_SWATCHES = {
  default:  '#00e5ff',
  forest:   '#69f0ae',
  midnight: '#7c4dff',
  crimson:  '#e53935',
}

export default function TopBar() {
  const { user, userDoc, isAdmin, logout } = useAuth()
  const { themeKey, themes, setTheme } = useTheme()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen]   = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)

  const initials = (userDoc?.displayName || user?.email || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <>
      <header className="top-bar">
        <div className="top-bar-inner">

          {/* ── Glitch Logo ───────────────────────────── */}
          <div className="logo-wrap">
            <span
              className="glitch-wrap top-bar-logo"
              data-text="907TRADERS"
              aria-label="907Traders"
            >
              907TRADERS
            </span>
            <span className="logo-tag">BETA</span>
          </div>

          {/* ── Right Controls ────────────────────────── */}
          <div className="top-bar-right">
            {isAdmin && (
              <button
                className="admin-pill"
                onClick={() => navigate('/admin')}
                title="Admin"
              >
                <Shield size={11} />
                ADMIN
              </button>
            )}
            <button className="avatar-btn" onClick={() => setMenuOpen(true)}>
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="avatar avatar-sm" />
              ) : (
                <span className="avatar avatar-sm avatar-placeholder">{initials}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ── User Menu ─────────────────────────────────── */}
      {menuOpen && (
        <div className="overlay" onClick={() => setMenuOpen(false)}>
          <div
            className="modal panel-glass"
            style={{ maxWidth: 320 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="flex items-center gap-12">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="" className="avatar avatar-lg" />
                ) : (
                  <span className="avatar avatar-lg avatar-placeholder">{initials}</span>
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>{userDoc?.displayName || 'Trader'}</div>
                  <div className="muted" style={{ fontSize: '0.78rem' }}>{user?.email}</div>
                </div>
              </div>
              <button onClick={() => setMenuOpen(false)} className="btn btn-ghost btn-sm">
                <X size={14} />
              </button>
            </div>

            <div className="modal-body flex-col gap-8">
              <button
                className="btn btn-ghost btn-full"
                onClick={() => { setThemeOpen(true); setMenuOpen(false) }}
              >
                <Palette size={15} />
                <span>Theme</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    width: 10, height: 10,
                    borderRadius: '50%',
                    background: THEME_SWATCHES[themeKey] || 'var(--accent)',
                    boxShadow: `0 0 6px ${THEME_SWATCHES[themeKey] || 'var(--accent)'}`,
                    flexShrink: 0,
                  }}
                />
              </button>
              <button
                className="btn btn-ghost btn-full"
                onClick={async () => { await logout(); setMenuOpen(false) }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Theme Picker ──────────────────────────────── */}
      {themeOpen && (
        <div className="overlay" onClick={() => setThemeOpen(false)}>
          <div
            className="modal panel-glass"
            style={{ maxWidth: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <span style={{ fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.06em', fontSize: '1.1rem' }}>
                THEME
              </span>
              <button onClick={() => setThemeOpen(false)} className="btn btn-ghost btn-sm">
                <X size={14} />
              </button>
            </div>
            <div className="modal-body flex-col gap-8">
              {Object.entries(themes).map(([key, t]) => (
                <button
                  key={key}
                  className="theme-option-btn"
                  data-active={themeKey === key}
                  onClick={() => { setTheme(key); setThemeOpen(false) }}
                >
                  <span
                    className="theme-swatch"
                    style={{
                      background: THEME_SWATCHES[key] || '#00e5ff',
                      boxShadow: themeKey === key ? `0 0 10px ${THEME_SWATCHES[key]}` : 'none',
                    }}
                  />
                  <span>{t.name}</span>
                  {themeKey === key && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.7rem', letterSpacing: '0.1em', color: THEME_SWATCHES[key] }}>
                      ACTIVE
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* ── Top bar shell ─────────────────────────────── */
        .top-bar {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: var(--top-bar-h);
          background: rgba(4, 4, 4, 0.85);
          border-bottom: 1px solid rgba(0, 229, 255, 0.08);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          z-index: 200;
        }
        .top-bar-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 100%;
          padding: 0 20px;
          max-width: 1400px;
          margin: 0 auto;
        }

        /* ── Logo ──────────────────────────────────────── */
        .logo-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .top-bar-logo {
          font-family: var(--font-display);
          font-size: 1.45rem;
          letter-spacing: 0.06em;
          color: var(--accent);
          text-shadow:
            0 0 14px rgba(0, 229, 255, 0.55),
            0 0 40px rgba(0, 229, 255, 0.18);
          cursor: default;
          user-select: none;
          /* override glitch-wrap inline → keep color */
        }
        .logo-tag {
          font-family: 'Space Mono', monospace;
          font-size: 0.55rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: var(--accent);
          background: var(--accent-dim);
          border: 1px solid rgba(0, 229, 255, 0.25);
          padding: 2px 6px;
          border-radius: 4px;
          opacity: 0.7;
          margin-top: 2px;
        }

        /* ── Right side ────────────────────────────────── */
        .top-bar-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .admin-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 99px;
          border: 1px solid rgba(255, 200, 0, 0.35);
          background: rgba(255, 200, 0, 0.07);
          color: #ffc800;
          font-family: 'Space Mono', monospace;
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          cursor: pointer;
          transition: background 0.2s, box-shadow 0.2s;
        }
        .admin-pill:hover {
          background: rgba(255, 200, 0, 0.14);
          box-shadow: 0 0 12px rgba(255, 200, 0, 0.2);
        }
        .avatar-btn {
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
          border-radius: 50%;
          line-height: 0;
          transition: box-shadow 0.2s;
        }
        .avatar-btn:hover {
          box-shadow: 0 0 0 2px var(--accent), 0 0 12px rgba(0, 229, 255, 0.25);
        }

        /* ── Theme picker rows ─────────────────────────── */
        .theme-option-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 14px;
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--radius);
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: 'Space Grotesk', sans-serif;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
        }
        .theme-option-btn:hover,
        .theme-option-btn[data-active='true'] {
          background: rgba(0, 229, 255, 0.04);
          border-color: rgba(0, 229, 255, 0.25);
        }
        .theme-swatch {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          flex-shrink: 0;
          transition: box-shadow 0.2s;
        }
      `}</style>
    </>
  )
}
