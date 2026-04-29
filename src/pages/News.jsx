import { useState, useEffect, useRef } from 'react'
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore'
import { db } from '../firebase'

/* ── Constants ─────────────────────────────────────────── */
const FF_API = 'https://www.jblanked.com/news/api/forex-factory/calendar/week/'
const POLL_MS = 180_000 // 3 min

const IMPACT = {
  High:    { label: 'HIGH',   color: 'var(--loss)',     dot: '#ff1744' },
  Medium:  { label: 'MED',    color: 'var(--reversal)', dot: '#ff7043' },
  Low:     { label: 'LOW',    color: 'var(--text-muted)', dot: 'rgba(255,255,255,0.3)' },
  Holiday: { label: 'HOL',    color: 'var(--text-muted)', dot: 'rgba(255,255,255,0.2)' },
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI']

// For "actual vs forecast" USD direction — higher actual:
// true  = bullish USD  |  false = bearish USD  |  null = unclear
const USD_DIRECTION = {
  bullish: ['nonfarm', 'payroll', 'gdp', 'retail sales', 'ism', 'pmi', 'consumer confidence',
            'industrial production', 'building permits', 'housing starts', 'durable goods',
            'average hourly earnings', 'jolts', 'adp'],
  bearish: ['unemployment', 'jobless claims', 'initial claims', 'continuing claims',
            'trade balance', 'current account'],
  hawkish: ['cpi', 'core cpi', 'pce', 'core pce', 'inflation'],
}

function usdVerdict(title, actual, forecast) {
  if (!actual || !forecast || actual === '' || forecast === '') return null
  const actNum  = parseFloat(actual.replace(/[^0-9.-]/g, ''))
  const foreNum = parseFloat(forecast.replace(/[^0-9.-]/g, ''))
  if (isNaN(actNum) || isNaN(foreNum)) return null
  const t = title.toLowerCase()
  const higher = actNum > foreNum
  if (USD_DIRECTION.bullish.some((k) => t.includes(k))) return higher ? 'BULLISH USD' : 'BEARISH USD'
  if (USD_DIRECTION.bearish.some((k) => t.includes(k))) return higher ? 'BEARISH USD' : 'BULLISH USD'
  if (USD_DIRECTION.hawkish.some((k) => t.includes(k))) return higher ? 'HAWKISH' : 'DOVISH'
  return null
}

/* ── Get current trading week Mon–Fri ───────────────────── */
function getTradingWeek() {
  const now = new Date()
  const day = now.getDay() // 0=Sun,1=Mon...6=Sat
  const monday = new Date(now)
  const diff = day === 0 ? -6 : 1 - day
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function isSameDay(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth()    === dateB.getMonth() &&
    dateA.getDate()     === dateB.getDate()
  )
}

function fmtDayLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/* ── ForexFactory event time → ET ───────────────────────── */
function toET(timeStr, dateObj) {
  if (!timeStr || timeStr === 'All Day' || timeStr === '') return 'All Day'
  // timeStr is already ET from FF/JBlanked
  return timeStr
}

/* ── Sub-components ─────────────────────────────────────── */
function WeekStrip({ week, selected, onSelect }) {
  const today = new Date()
  return (
    <div className="news-week-strip">
      {week.map((day, i) => {
        const isToday   = isSameDay(day, today)
        const isSelected = isSameDay(day, selected)
        return (
          <button
            key={i}
            className={`week-day-btn ${isSelected ? 'active' : ''} ${isToday ? 'today' : ''}`}
            onClick={() => onSelect(day)}
          >
            <span className="week-day-name">{DAYS[i]}</span>
            <span className="week-day-date">{fmtDayLabel(day)}</span>
            {isToday && <span className="today-dot" />}
          </button>
        )
      })}
    </div>
  )
}

function ImpactBadge({ impact }) {
  const cfg = IMPACT[impact] || IMPACT.Low
  return (
    <span className="impact-badge" style={{ color: cfg.color, borderColor: cfg.color + '44', background: cfg.color + '11' }}>
      {cfg.label}
    </span>
  )
}

function CalendarEvent({ event }) {
  const verdict = usdVerdict(event.title, event.actual, event.forecast)
  const verdictColor = verdict
    ? verdict.includes('BULL') || verdict === 'HAWKISH'
      ? 'var(--profit)'
      : 'var(--loss)'
    : null

  return (
    <div className="cal-event card">
      <div className="cal-event-header">
        <ImpactBadge impact={event.impact} />
        <span className="cal-event-time mono">{event.time || 'All Day'}</span>
        <span className="cal-event-title">{event.title}</span>
      </div>
      <div className="cal-event-stats">
        <div className="cal-stat">
          <span className="cal-stat-label">Forecast</span>
          <span className="cal-stat-val">{event.forecast || '—'}</span>
        </div>
        <div className="cal-stat">
          <span className="cal-stat-label">Actual</span>
          <span className="cal-stat-val" style={{ color: event.actual ? 'var(--text-primary)' : 'var(--text-muted)' }}>
            {event.actual || '—'}
          </span>
        </div>
        <div className="cal-stat">
          <span className="cal-stat-label">Previous</span>
          <span className="cal-stat-val">{event.previous || '—'}</span>
        </div>
        {verdict && (
          <div className="cal-verdict" style={{ color: verdictColor }}>
            {verdict}
          </div>
        )}
      </div>
    </div>
  )
}

function CalendarPanel({ events, day, loading }) {
  const filtered = events
    .filter((e) => e.country === 'USD' && ['High', 'Medium', 'Low'].includes(e.impact))
    .filter((e) => {
      if (!e.date) return false
      const d = new Date(e.date)
      return isSameDay(d, day)
    })
    .sort((a, b) => {
      if (!a.time || a.time === 'All Day') return -1
      if (!b.time || b.time === 'All Day') return 1
      return a.time.localeCompare(b.time)
    })

  return (
    <div className="cal-panel">
      <div className="cal-panel-header">
        <span className="section-title">USD CALENDAR</span>
        <span className="cal-day-label">{fmtDayLabel(day)}</span>
        {loading && <span className="muted" style={{ fontSize: '0.72rem' }}>updating…</span>}
      </div>
      {filtered.length === 0 && !loading && (
        <p className="muted" style={{ fontSize: '0.83rem', padding: '12px 0' }}>
          No high/medium/low USD events this day.
        </p>
      )}
      <div className="cal-events-list">
        {filtered.map((e, i) => <CalendarEvent key={i} event={e} />)}
      </div>
    </div>
  )
}

function NewsCard({ item }) {
  const ts = item.publishedAt?.toDate?.() || (item.publishedAt ? new Date(item.publishedAt) : null)
  const timeStr = ts ? ts.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''
  const dateStr = ts ? ts.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''

  return (
    <div className="feed-card feed-card-news card">
      <div className="feed-card-header">
        <span className="feed-badge feed-badge-news">FF NEWS</span>
        <span className="feed-time mono">{dateStr} {timeStr}</span>
      </div>
      <div className="feed-card-body">
        {item.title && <div className="news-card-title">{item.title}</div>}
        {item.content && <p className="feed-card-text">{item.content}</p>}
        {item.url && (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="news-card-link">
            Read on Forex Factory →
          </a>
        )}
      </div>
    </div>
  )
}

function LiveFeed() {
  const [items, setItems] = useState([])

  useEffect(() => {
    const newsQ = query(collection(db, 'newsItems'), orderBy('publishedAt', 'desc'), limit(60))
    return onSnapshot(newsQ, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  return (
    <div className="live-feed">
      <div className="live-feed-header">
        <span className="section-title">LIVE FEED</span>
        <span className="live-dot-wrap"><span className="live-dot" />LIVE</span>
      </div>
      {items.length === 0 && (
        <p className="muted" style={{ fontSize: '0.83rem', padding: '12px 0' }}>
          ForexFactory news will appear here as it's scraped.
        </p>
      )}
      <div className="feed-list">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────── */
export default function News() {
  const week    = getTradingWeek()
  const today   = new Date()
  const todayOrFirst = week.find((d) => isSameDay(d, today)) || week[0]
  const [selected, setSelected]   = useState(todayOrFirst)
  const [events,   setEvents]     = useState([])
  const [calLoading, setCalLoading] = useState(false)

  async function fetchCalendar() {
    setCalLoading(true)
    try {
      const res  = await fetch(FF_API)
      const data = await res.json()
      setEvents(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('FF calendar fetch error:', e)
    } finally {
      setCalLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendar()
    const id = setInterval(fetchCalendar, POLL_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="news-page">
      <div className="news-page-header">
        <h2 className="news-page-title">NEWS</h2>
        <p className="muted" style={{ fontSize: '0.82rem' }}>USD economic calendar · ForexFactory news feed</p>
      </div>

      <WeekStrip week={week} selected={selected} onSelect={setSelected} />

      <div className="news-layout">
        <aside className="news-sidebar">
          <CalendarPanel events={events} day={selected} loading={calLoading} />
        </aside>
        <section className="news-main">
          <LiveFeed />
        </section>
      </div>

      <style>{`
        .news-page {
          padding: 20px 16px 32px;
          max-width: 1100px;
          margin: 0 auto;
        }
        .news-page-header {
          margin-bottom: 16px;
        }
        .news-page-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(1.8rem, 5vw, 2.8rem);
          letter-spacing: 0.04em;
          color: var(--text-primary);
          margin-bottom: 2px;
        }

        /* ── Week Strip ─── */
        .news-week-strip {
          display: flex;
          gap: 6px;
          margin-bottom: 20px;
          overflow-x: auto;
          padding-bottom: 2px;
          position: sticky;
          top: var(--top-bar-h);
          z-index: 10;
          background: var(--bg);
          padding-top: 8px;
        }
        .week-day-btn {
          flex: 1;
          min-width: 72px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 10px 6px;
          border-radius: 10px;
          border: 1px solid var(--card-border);
          background: var(--card-bg);
          cursor: pointer;
          position: relative;
          transition: all 0.15s;
          color: var(--text-muted);
        }
        .week-day-btn:hover { border-color: var(--accent); color: var(--text-secondary); }
        .week-day-btn.active {
          border-color: var(--accent);
          background: var(--accent-dim);
          color: var(--text-primary);
        }
        .week-day-btn.today .week-day-name { color: var(--accent); }
        .week-day-name { font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; }
        .week-day-date { font-size: 0.7rem; }
        .today-dot {
          position: absolute;
          bottom: 6px;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: var(--accent);
        }

        /* ── Layout ─── */
        .news-layout {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 16px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .news-layout { grid-template-columns: 1fr; }
        }

        /* ── Calendar Panel ─── */
        .news-sidebar {
          position: sticky;
          top: calc(var(--top-bar-h) + 80px);
        }
        .cal-panel {
          background: var(--card-bg);
          border: 1px solid var(--card-border);
          border-radius: var(--radius-lg);
          padding: 16px;
        }
        .cal-panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .cal-day-label {
          font-size: 0.78rem;
          color: var(--accent);
          font-weight: 600;
        }
        .cal-events-list { display: flex; flex-direction: column; gap: 8px; }
        .cal-event {
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .cal-event-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .cal-event-time {
          font-size: 0.72rem;
          color: var(--text-muted);
          min-width: 60px;
        }
        .cal-event-title {
          font-size: 0.83rem;
          font-weight: 600;
          flex: 1;
          min-width: 0;
        }
        .impact-badge {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid;
          white-space: nowrap;
        }
        .cal-event-stats {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
        }
        .cal-stat { display: flex; flex-direction: column; gap: 1px; }
        .cal-stat-label { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; }
        .cal-stat-val { font-size: 0.82rem; font-weight: 600; font-family: 'Space Mono', monospace; }
        .cal-verdict {
          margin-left: auto;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
        }

        /* ── Live Feed ─── */
        .live-feed-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 14px;
        }
        .live-dot-wrap {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--profit);
        }
        .live-dot {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--profit);
          box-shadow: 0 0 6px var(--profit);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.85); }
        }
        .feed-list { display: flex; flex-direction: column; gap: 10px; }
        .feed-card { padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
        .feed-card-header {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .feed-badge {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          padding: 2px 7px;
          border-radius: 4px;
        }
        .feed-badge-news {
          background: rgba(255,255,255,0.06);
          color: var(--text-secondary);
          border: 1px solid var(--card-border);
        }
        .feed-time { font-size: 0.7rem; color: var(--text-muted); margin-left: auto; }
        .feed-card-body { display: flex; flex-direction: column; gap: 6px; }
        .feed-card-text { font-size: 0.83rem; color: var(--text-secondary); margin: 0; }

        /* News card */
        .news-card-title { font-size: 0.9rem; font-weight: 600; color: var(--text-primary); }
        .news-card-link {
          font-size: 0.75rem;
          color: var(--accent);
          text-decoration: none;
          opacity: 0.8;
          transition: opacity 0.15s;
        }
        .news-card-link:hover { opacity: 1; }
      `}</style>
    </div>
  )
}
