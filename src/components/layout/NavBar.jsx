import { NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const NAV = [
  { to: '/strategy',  label: 'STRATEGY' },
  { to: '/log',       label: 'LOG' },
  { to: '/warroom',   label: 'WAR ROOM' },
  { to: '/stats',     label: 'MY STATS' },
]

export default function NavBar() {
  const { isAdmin } = useAuth()
  const items = isAdmin ? [...NAV, { to: '/admin', label: 'ADMIN' }] : NAV

  return (
    <>
      <nav className="bottom-nav">
        {items.map(({ to, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            {label}
          </NavLink>
        ))}
      </nav>
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: var(--bottom-bar-h);
          background: var(--bottom-bar-bg);
          border-top: 1px solid var(--card-border);
          backdrop-filter: blur(12px);
          z-index: 100;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 0 8px;
        }
        .nav-item {
          flex: 1;
          max-width: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 40px;
          border-radius: 8px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          text-decoration: none;
          transition: all 0.15s;
        }
        .nav-item:hover { color: var(--text-secondary); background: rgba(255,255,255,0.04); }
        .nav-item.active {
          color: var(--accent);
          background: var(--accent-dim);
        }
      `}</style>
    </>
  )
}
