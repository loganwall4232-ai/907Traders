import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot, where, limit,
} from 'firebase/firestore'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart,
} from 'recharts'
import { Plus } from 'lucide-react'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import TradeCard from '../components/trades/TradeCard'
import LogTradeModal from '../components/trades/LogTradeModal'
import { useNavigate } from 'react-router-dom'

const PAIRS_FILTER = ['ALL', 'ES', 'NQ', 'MES', 'MNQ', 'Forex', 'Gold', 'Oil', 'BTC']

function MemberList({ members }) {
  return (
    <div className="card flex-col gap-8">
      <div className="section-title">Members</div>
      {members.map((m) => (
        <div key={m.uid} className="flex items-center gap-8">
          <span className={m.online ? 'online-dot' : 'offline-dot'} />
          {m.photoURL
            ? <img src={m.photoURL} alt="" className="avatar avatar-sm" />
            : <span className="avatar avatar-sm avatar-placeholder">{(m.displayName || 'T')[0]}</span>
          }
          <span style={{ fontSize: '0.85rem', fontWeight: 500 }} className="truncate">{m.displayName}</span>
        </div>
      ))}
      {members.length === 0 && <p className="muted" style={{ fontSize: '0.82rem' }}>No members yet</p>}
    </div>
  )
}

function GroupCharts({ trades }) {
  const last7 = getLast7DaysPnl(trades)
  return (
    <div className="card flex-col gap-16">
      <div className="section-title">7-Day P&L</div>
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={last7}>
          <Line type="monotone" dataKey="cumPnl" stroke="var(--accent)" strokeWidth={2} dot={false} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
            formatter={(v) => [`$${v.toFixed(2)}`, 'Cum P&L']}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="section-title">Win Rate (7 days)</div>
      <ResponsiveContainer width="100%" height={60}>
        <BarChart data={last7}>
          <Bar dataKey="wins" fill="var(--profit)" radius={[3,3,0,0]} />
          <Bar dataKey="losses" fill="var(--loss)" radius={[3,3,0,0]} />
          <Tooltip
            contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GroupRecords({ trades }) {
  if (!trades.length) return null
  const best  = trades.reduce((a, b) => (b.pnl > a.pnl ? b : a), trades[0])
  const worst = trades.reduce((a, b) => (b.pnl < a.pnl ? b : a), trades[0])
  return (
    <div className="card flex-col gap-12">
      <div className="section-title">Group Records</div>
      <div>
        <div className="profit" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>BEST TRADE</div>
        <div className="flex justify-between items-center">
          <span style={{ fontSize: '0.85rem' }}>{best.userDisplayName}</span>
          <span className="mono profit" style={{ fontWeight: 700 }}>+${best.pnl?.toFixed(2)}</span>
        </div>
      </div>
      <div>
        <div className="loss" style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>WORST TRADE</div>
        <div className="flex justify-between items-center">
          <span style={{ fontSize: '0.85rem' }}>{worst.userDisplayName}</span>
          <span className="mono loss" style={{ fontWeight: 700 }}>${worst.pnl?.toFixed(2)}</span>
        </div>
      </div>
    </div>
  )
}

function GroupStats({ trades }) {
  if (!trades.length) return (
    <div className="card">
      <div className="section-title">Group Stats</div>
      <p className="muted" style={{ fontSize: '0.82rem' }}>No trades yet</p>
    </div>
  )
  const wins = trades.filter((t) => t.result === 'WIN').length
  const wr = ((wins / trades.length) * 100).toFixed(1)
  const avgRR = (trades.reduce((a, b) => a + (b.rr || 0), 0) / trades.length).toFixed(2)
  const avgPnl = (trades.reduce((a, b) => a + (b.pnl || 0), 0) / trades.length).toFixed(2)
  const pairs = trades.map((t) => t.pair)
  const topPair = pairs.sort((a, b) => pairs.filter((p) => p === b).length - pairs.filter((p) => p === a).length)[0]
  const macroCount = trades.filter((t) => t.macroWindow).length
  const macroPct = ((macroCount / trades.length) * 100).toFixed(0)

  return (
    <div className="card flex-col gap-12">
      <div className="section-title">Group Stats</div>
      {[
        ['Win Rate', `${wr}%`, wr >= 50 ? 'var(--profit)' : 'var(--loss)'],
        ['Total Trades', trades.length, 'var(--text-primary)'],
        ['Avg R:R', `1:${avgRR}`, 'var(--accent)'],
        ['Avg P&L', `$${avgPnl}`, parseFloat(avgPnl) >= 0 ? 'var(--profit)' : 'var(--loss)'],
        ['Top Pair', topPair, 'var(--text-primary)'],
        ['Macro %', `${macroPct}%`, 'var(--text-secondary)'],
      ].map(([label, val, color]) => (
        <div key={label} className="flex justify-between items-center">
          <span className="muted" style={{ fontSize: '0.8rem' }}>{label}</span>
          <span className="mono" style={{ fontWeight: 700, color, fontSize: '0.9rem' }}>{val}</span>
        </div>
      ))}
    </div>
  )
}

export default function Log() {
  const { user, userDoc } = useAuth()
  const navigate = useNavigate()
  const [trades, setTrades] = useState([])
  const [members, setMembers] = useState([])
  const [propAccounts, setPropAccounts] = useState([])
  const [logOpen, setLogOpen] = useState(false)
  const [filter, setFilter] = useState('ALL')   // ALL | WIN | LOSS
  const [pairFilter, setPairFilter] = useState('ALL')
  const [retakeFilter, setRetakeFilter] = useState(false)

  useEffect(() => {
    const q = query(collection(db, 'trades'), orderBy('createdAt', 'desc'), limit(200))
    return onSnapshot(q, (snap) => {
      setTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data(), online: false })))
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'propAccounts'), where('userId', '==', user.uid))
    return onSnapshot(q, (snap) => {
      setPropAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  const visible = trades.filter((t) => {
    if (filter === 'WIN' && t.result !== 'WIN') return false
    if (filter === 'LOSS' && t.result !== 'LOSS') return false
    if (pairFilter !== 'ALL' && t.pair !== pairFilter) return false
    if (retakeFilter && !t.wouldTakeAgain) return false
    return true
  })

  function handleReply(trade) {
    navigate('/warroom', { state: { replyTrade: trade } })
  }

  return (
    <>
      <div className="three-col">
        {/* Left */}
        <aside className="col-left">
          <MemberList members={members} />
          <GroupCharts trades={trades} />
        </aside>

        {/* Center */}
        <main className="col-center">
          {/* Log trade button + filters */}
          <div className="flex justify-between items-center" style={{ gap: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>GROUP LOG</div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </div>
            </div>
            <button className="btn btn-primary" onClick={() => setLogOpen(true)}>
              <Plus size={15} /> LOG TRADE
            </button>
          </div>

          {/* Filters */}
          <div className="flex-col gap-8">
            <div className="flex gap-6" style={{ flexWrap: 'wrap' }}>
              {['ALL', 'WIN', 'LOSS'].map((f) => (
                <button
                  key={f}
                  className={`btn btn-ghost btn-sm ${filter === f ? (f === 'WIN' ? 'active-win' : f === 'LOSS' ? 'active-loss' : 'active') : ''}`}
                  style={filter === f && f === 'ALL' ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                  onClick={() => setFilter(f)}
                >
                  {f}
                </button>
              ))}
              <div className="h-scroll" style={{ flex: 1 }}>
                {PAIRS_FILTER.map((p) => (
                  <button
                    key={p}
                    className={`pair-chip ${pairFilter === p ? 'active' : ''}`}
                    style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                    onClick={() => setPairFilter(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <button
                className={`btn btn-ghost btn-sm ${retakeFilter ? 'active' : ''}`}
                style={retakeFilter ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                onClick={() => setRetakeFilter((v) => !v)}
              >
                Retake Only
              </button>
            </div>
          </div>

          {/* Trade feed */}
          {visible.length === 0 ? (
            <div className="card text-center" style={{ padding: 40 }}>
              <p className="muted">No trades match your filters.</p>
            </div>
          ) : (
            visible.map((t) => (
              <TradeCard key={t.id} trade={t} propAccounts={propAccounts} onReply={handleReply} />
            ))
          )}
        </main>

        {/* Right */}
        <aside className="col-right">
          <GroupStats trades={trades} />
          <GroupRecords trades={trades} />
        </aside>
      </div>

      {logOpen && (
        <LogTradeModal
          propAccounts={propAccounts}
          onClose={() => setLogOpen(false)}
        />
      )}
    </>
  )
}

/* ── Helpers ─────────────────────────────────────── */
function getLast7DaysPnl(trades) {
  const days = []
  let cumPnl = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const dayTrades = trades.filter((t) => {
      const td = t.date?.toDate ? t.date.toDate() : new Date(t.date)
      return td.toDateString() === d.toDateString()
    })
    const wins   = dayTrades.filter((t) => t.result === 'WIN').length
    const losses = dayTrades.filter((t) => t.result === 'LOSS').length
    const pnl    = dayTrades.reduce((a, b) => a + (b.pnl || 0), 0)
    cumPnl += pnl
    days.push({ label, wins, losses, pnl, cumPnl: parseFloat(cumPnl.toFixed(2)) })
  }
  return days
}
