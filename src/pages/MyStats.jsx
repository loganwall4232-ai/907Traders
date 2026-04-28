import { useState, useEffect } from 'react'
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import {
  LineChart, Line, BarChart, Bar, ScatterChart, Scatter,
  PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Plus, Trash2, Edit2, X } from 'lucide-react'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import TradeCard from '../components/trades/TradeCard'
import LogTradeModal from '../components/trades/LogTradeModal'
import { ALL_CONFLUENCES, CONFLUENCE_TYPE } from '../utils/constants'
import Modal from '../components/shared/Modal'

/* ── Profitability band logic ──────────────────────── */
function getBand(wr, avgRR) {
  if (wr >= 60 && avgRR >= 1 && avgRR <= 3) return 'standard'
  if (wr >= 30 && avgRR >= 3 && avgRR <= 10) return 'highRR'
  return 'none'
}

function getRecovery(wr, avgRR) {
  const minRRForWR = wr > 0 ? ((100 - wr) / wr).toFixed(2) : '∞'
  const minWRForRR = avgRR > 0 ? ((1 / (1 + avgRR)) * 100).toFixed(1) : '∞'
  return { minRRForWR, minWRForRR }
}

/* ── Prop Account Card ─────────────────────────────── */
function PropAccountCard({ account, onEdit, onDelete }) {
  const drawPct = account.maxDrawdown
    ? Math.min(100, ((account.maxDrawdown - account.currentBalance + account.accountSize) / account.maxDrawdown) * 100)
    : 0

  return (
    <div className="card flex-col gap-8">
      <div className="flex justify-between items-center">
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{account.firmName}</div>
          <div className="muted" style={{ fontSize: '0.75rem' }}>
            ${(account.accountSize || 0).toLocaleString()} · {account.mode === 'challenge' ? 'Challenge' : 'Funded'}
          </div>
        </div>
        <div className="flex gap-6">
          <button className="btn btn-ghost btn-sm" onClick={() => onEdit(account)}><Edit2 size={12} /></button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--loss)' }} onClick={() => onDelete(account.id)}><Trash2 size={12} /></button>
        </div>
      </div>

      <div className="flex justify-between">
        <div>
          <div className="stat-num" style={{ fontSize: '1.2rem' }}>
            ${(account.currentBalance || account.accountSize || 0).toLocaleString()}
          </div>
          <div className="stat-label">Balance</div>
        </div>
        <div>
          <div className="mono" style={{ fontWeight: 700, color: 'var(--loss)', fontSize: '1rem' }}>
            ${(account.maxDrawdown || 0).toLocaleString()}
          </div>
          <div className="stat-label">Max Drawdown</div>
        </div>
        <div>
          <div className="mono accent" style={{ fontWeight: 700, fontSize: '1rem' }}>
            ${account.maxDrawdown ? (account.maxDrawdown / 10).toLocaleString() : '—'}
          </div>
          <div className="stat-label">Max SL/Trade</div>
        </div>
      </div>

      {account.maxDrawdown > 0 && (
        <div>
          <div className="flex justify-between mb-4">
            <span className="muted" style={{ fontSize: '0.72rem' }}>Drawdown used</span>
            <span className="mono" style={{ fontSize: '0.72rem', color: drawPct > 75 ? 'var(--loss)' : 'var(--text-muted)' }}>
              {drawPct.toFixed(1)}%
            </span>
          </div>
          <div style={{ height: 6, background: 'var(--bg-tertiary)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${drawPct}%`,
              background: drawPct > 75 ? 'var(--loss)' : drawPct > 50 ? '#ffab40' : 'var(--profit)',
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {account.mode === 'challenge' && (
        <div className="flex gap-16">
          <div>
            <div className="muted" style={{ fontSize: '0.72rem' }}>Challenge TP</div>
            <div className="mono profit" style={{ fontWeight: 700 }}>${(account.challengeTP || 0).toLocaleString()}</div>
          </div>
          <div>
            <div className="muted" style={{ fontSize: '0.72rem' }}>Challenge SL</div>
            <div className="mono loss" style={{ fontWeight: 700 }}>${(account.challengeSL || 0).toLocaleString()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Add/Edit Account Modal ────────────────────────── */
function AccountModal({ account, onClose, userId }) {
  const empty = { firmName: '', accountSize: '', maxDrawdown: '', dailyLossLimit: '', mode: 'funded', challengeTP: '', challengeSL: '', notes: '', currentBalance: '' }
  const [form, setForm] = useState(account ? { ...empty, ...account } : empty)
  const [loading, setLoading] = useState(false)

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })) }

  async function save(e) {
    e.preventDefault()
    setLoading(true)
    const data = {
      userId,
      firmName: form.firmName,
      accountSize: parseFloat(form.accountSize) || 0,
      maxDrawdown: parseFloat(form.maxDrawdown) || 0,
      dailyLossLimit: parseFloat(form.dailyLossLimit) || 0,
      mode: form.mode,
      challengeTP: parseFloat(form.challengeTP) || 0,
      challengeSL: parseFloat(form.challengeSL) || 0,
      notes: form.notes,
      currentBalance: parseFloat(form.currentBalance || form.accountSize) || 0,
    }
    if (account) {
      await updateDoc(doc(db, 'propAccounts', account.id), data)
    } else {
      await addDoc(collection(db, 'propAccounts'), { ...data, createdAt: serverTimestamp() })
    }
    setLoading(false)
    onClose()
  }

  return (
    <Modal title={account ? 'Edit Account' : 'Add Account'} onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={loading || !form.firmName}>
            {loading ? <span className="spinner" /> : 'Save'}
          </button>
        </>
      }
    >
      <form onSubmit={save} className="flex-col gap-12">
        <div className="field"><label className="label">Firm Name</label>
          <input className="input" value={form.firmName} onChange={(e) => set('firmName', e.target.value)} placeholder="e.g. FTMO, Apex, TopStep" required />
        </div>
        <div className="field-row">
          <div className="field"><label className="label">Account Size ($)</label>
            <input className="input mono" type="number" value={form.accountSize} onChange={(e) => set('accountSize', e.target.value)} placeholder="100000" />
          </div>
          <div className="field"><label className="label">Current Balance ($)</label>
            <input className="input mono" type="number" value={form.currentBalance} onChange={(e) => set('currentBalance', e.target.value)} />
          </div>
        </div>
        <div className="field-row">
          <div className="field"><label className="label">Max Drawdown ($)</label>
            <input className="input mono" type="number" value={form.maxDrawdown} onChange={(e) => set('maxDrawdown', e.target.value)} />
          </div>
          <div className="field"><label className="label">Daily Loss Limit ($)</label>
            <input className="input mono" type="number" value={form.dailyLossLimit} onChange={(e) => set('dailyLossLimit', e.target.value)} />
          </div>
        </div>
        <div className="field"><label className="label">Mode</label>
          <div className="toggle-group">
            <button type="button" className={`toggle-btn ${form.mode === 'challenge' ? 'active' : ''}`} onClick={() => set('mode', 'challenge')}>Challenge</button>
            <button type="button" className={`toggle-btn ${form.mode === 'funded' ? 'active' : ''}`} onClick={() => set('mode', 'funded')}>Funded</button>
          </div>
        </div>
        {form.mode === 'challenge' && (
          <div className="field-row">
            <div className="field"><label className="label">Challenge TP ($)</label>
              <input className="input mono" type="number" value={form.challengeTP} onChange={(e) => set('challengeTP', e.target.value)} />
            </div>
            <div className="field"><label className="label">Challenge SL ($)</label>
              <input className="input mono" type="number" value={form.challengeSL} onChange={(e) => set('challengeSL', e.target.value)} />
            </div>
          </div>
        )}
        <div className="field"><label className="label">Notes</label>
          <textarea className="input" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>
      </form>
    </Modal>
  )
}

/* ── Risk Calculator ───────────────────────────────── */
function RiskCalc({ accounts }) {
  const [open, setOpen] = useState(false)
  const [bp, setBp] = useState('')
  const [pct, setPct] = useState('1')

  const dollar = bp && pct ? ((parseFloat(bp) * parseFloat(pct)) / 100).toFixed(2) : ''
  const nqPts  = dollar ? (parseFloat(dollar) / 20).toFixed(2) : ''
  const esPts  = dollar ? (parseFloat(dollar) / 50).toFixed(2) : ''
  const mnqPts = dollar ? (parseFloat(dollar) / 2).toFixed(2) : ''
  const mesPts = dollar ? (parseFloat(dollar) / 5).toFixed(2) : ''

  return (
    <div className="card">
      <button className="flex justify-between items-center w-full" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }} onClick={() => setOpen((v) => !v)}>
        <span className="section-title" style={{ margin: 0 }}>Risk Calculator</span>
        <span className="muted" style={{ fontSize: '0.75rem' }}>{open ? '▲ collapse' : '▼ expand'}</span>
      </button>
      {open && (
        <div className="flex-col gap-12 mt-12">
          <div className="field-row">
            <div className="field">
              <label className="label">Buying Power ($)</label>
              <input className="input mono" type="number" value={bp} onChange={(e) => setBp(e.target.value)} placeholder="100000" />
            </div>
            <div className="field">
              <label className="label">Risk %</label>
              <input className="input mono" type="number" step="0.1" value={pct} onChange={(e) => setPct(e.target.value)} />
            </div>
          </div>
          {dollar && (
            <div className="card" style={{ background: 'var(--bg-tertiary)' }}>
              {[
                ['Dollar Risk', `$${dollar}`],
                ['NQ pts', nqPts],
                ['ES pts', esPts],
                ['MNQ pts', mnqPts],
                ['MES pts', mesPts],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between" style={{ padding: '4px 0', borderBottom: '1px solid var(--card-border)' }}>
                  <span className="muted" style={{ fontSize: '0.82rem' }}>{label}</span>
                  <span className="mono accent" style={{ fontWeight: 700 }}>{val}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Confluence Tracker ────────────────────────────── */
function ConfluenceTracker({ trades, prevMonthTrades }) {
  const rows = ALL_CONFLUENCES.map((name) => {
    const myTrades   = trades.filter((t) => {
      const all = [...(t.confluences?.reversal||[]), ...(t.confluences?.confirmation||[]), ...(t.confluences?.continuation||[])]
      return all.includes(name)
    })
    const prevTrades = prevMonthTrades.filter((t) => {
      const all = [...(t.confluences?.reversal||[]), ...(t.confluences?.confirmation||[]), ...(t.confluences?.continuation||[])]
      return all.includes(name)
    })
    const wins   = myTrades.filter((t) => t.result === 'WIN').length
    const wr     = myTrades.length ? (wins / myTrades.length * 100).toFixed(1) : null
    const prevWR = prevTrades.length ? (prevTrades.filter((t) => t.result === 'WIN').length / prevTrades.length * 100) : null
    const delta  = wr !== null && prevWR !== null ? (parseFloat(wr) - prevWR).toFixed(1) : null
    const avgRR  = myTrades.length ? (myTrades.reduce((a, b) => a + (b.rr||0), 0) / myTrades.length).toFixed(2) : null
    const type   = CONFLUENCE_TYPE[name] || 'reversal'
    const flagged = delta !== null && parseFloat(delta) <= -5
    return { name, type, count: myTrades.length, wr, avgRR, delta, flagged }
  })

  return (
    <div className="card">
      <div className="section-title mb-12">Confluence Tracker</div>
      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>Confluence</th>
              <th>Uses</th>
              <th>Win Rate</th>
              <th>Avg R:R</th>
              <th>MoM Δ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>
                  <span className={`chip chip-${r.type}`} style={{ fontSize: '0.72rem', cursor: 'default' }}>
                    {r.name}
                  </span>
                  {r.flagged && (
                    <span style={{ marginLeft: 6, fontSize: '0.7rem', color: 'var(--loss)' }}>⚠</span>
                  )}
                </td>
                <td className="mono muted">{r.count}</td>
                <td className="mono" style={{ color: r.wr === null ? 'var(--text-muted)' : parseFloat(r.wr) >= 50 ? 'var(--profit)' : 'var(--loss)' }}>
                  {r.wr !== null ? `${r.wr}%` : '—'}
                </td>
                <td className="mono accent">{r.avgRR !== null ? `1:${r.avgRR}` : '—'}</td>
                <td className="mono" style={{ color: r.delta === null ? 'var(--text-muted)' : parseFloat(r.delta) >= 0 ? 'var(--profit)' : 'var(--loss)' }}>
                  {r.delta !== null ? `${r.delta > 0 ? '+' : ''}${r.delta}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Main ──────────────────────────────────────────── */
export default function MyStats() {
  const { user } = useAuth()
  const [trades, setTrades] = useState([])
  const [prevTrades, setPrevTrades] = useState([])
  const [accounts, setAccounts] = useState([])
  const [accountModal, setAccountModal] = useState(null) // null | 'new' | account
  const [editTrade, setEditTrade] = useState(null)
  const [filterResult, setFilterResult] = useState('ALL')
  const [filterPair, setFilterPair] = useState('ALL')
  const [filterRetake, setFilterRetake] = useState(false)
  const [filterSearch, setFilterSearch] = useState('')

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'trades'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'))
    return onSnapshot(q, (snap) => {
      setTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    const start = new Date(); start.setDate(1); start.setMonth(start.getMonth() - 1)
    const end   = new Date(); end.setDate(0)
    const q = query(collection(db, 'trades'), where('userId', '==', user.uid))
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setPrevTrades(all.filter((t) => {
        const d = t.date?.toDate ? t.date.toDate() : new Date(t.date)
        return d >= start && d <= end
      }))
    })
  }, [user])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'propAccounts'), where('userId', '==', user.uid))
    return onSnapshot(q, (snap) => {
      setAccounts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  async function deleteAccount(id) {
    if (!confirm('Delete this account?')) return
    await deleteDoc(doc(db, 'propAccounts', id))
  }

  // Computed stats
  const wins   = trades.filter((t) => t.result === 'WIN').length
  const losses = trades.filter((t) => t.result === 'LOSS').length
  const total  = trades.length
  const wr     = total ? (wins / total * 100) : 0
  const avgRR  = total ? trades.reduce((a, b) => a + (b.rr||0), 0) / total : 0
  const totalPnl = trades.reduce((a, b) => a + (b.pnl||0), 0)
  const avgPnl   = total ? totalPnl / total : 0
  const retakePct = total ? (trades.filter((t) => t.wouldTakeAgain).length / total * 100) : 0
  const avgCR    = total ? trades.reduce((a, b) => a + (b.confidence||0), 0) / total : 0
  const macroPct = total ? (trades.filter((t) => t.macroWindow).length / total * 100) : 0
  const pairs = trades.map((t) => t.pair)
  const topPair = pairs.length ? pairs.sort((a, b) => pairs.filter((p) => p === b).length - pairs.filter((p) => p === a).length)[0] : '—'
  const perfectCR = trades.filter((t) => t.confidence >= 90).length

  const band = getBand(wr, avgRR)
  const recovery = band === 'none' && total >= 5 ? getRecovery(wr, avgRR) : null

  const crLast30 = trades.slice(0, 30).reverse().map((t, i) => ({ i, cr: t.confidence }))

  // Equity curve
  const equity = (() => {
    let bal = 0
    return trades.slice().reverse().map((t, i) => {
      bal += t.pnl || 0
      return { i, bal: parseFloat(bal.toFixed(2)) }
    })
  })()

  // Win/loss donut
  const donut = [
    { name: 'Win', value: wins },
    { name: 'Loss', value: losses },
  ]

  // Filtered trade grid
  const filtered = trades.filter((t) => {
    if (filterResult !== 'ALL' && t.result !== filterResult) return false
    if (filterPair !== 'ALL' && t.pair !== filterPair) return false
    if (filterRetake && !t.wouldTakeAgain) return false
    if (filterSearch && !t.notes?.toLowerCase().includes(filterSearch.toLowerCase())) return false
    return true
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 280px', gap: 16, padding: 16, maxWidth: 1200, margin: '0 auto', minHeight: '100%' }}>

      {/* Left — charts */}
      <div className="flex-col gap-12" style={{ overflowY: 'auto' }}>
        {/* Donut */}
        <div className="card">
          <div className="section-title mb-8">Win / Loss</div>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={donut} dataKey="value" innerRadius={40} outerRadius={60} paddingAngle={3}>
                <Cell fill="var(--profit)" />
                <Cell fill="var(--loss)" />
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Confidence trend */}
        <div className="card">
          <div className="section-title mb-8">CR Trend (30 trades)</div>
          <ResponsiveContainer width="100%" height={80}>
            <LineChart data={crLast30}>
              <Line type="monotone" dataKey="cr" stroke="var(--accent)" strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`${v}%`, 'CR']} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Equity curve */}
        <div className="card">
          <div className="section-title mb-8">Equity Curve</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={equity}>
              <Line type="monotone" dataKey="bal" stroke={totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'} strokeWidth={2} dot={false} />
              <Tooltip contentStyle={{ background: 'var(--bg-secondary)', border: '1px solid var(--card-border)', borderRadius: 8, fontSize: 11 }} formatter={(v) => [`$${v}`, 'P&L']} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Center — stats + confluence + trades */}
      <div className="flex-col gap-12" style={{ overflowY: 'auto' }}>
        {/* Stats grid */}
        <div className="stats-grid">
          {[
            ['Win Rate', `${wr.toFixed(1)}%`, wr >= 50 ? 'var(--profit)' : 'var(--loss)'],
            ['Total Trades', total, 'var(--text-primary)'],
            ['Avg R:R', `1:${avgRR.toFixed(2)}`, 'var(--accent)'],
            ['Avg P&L', `$${avgPnl.toFixed(2)}`, avgPnl >= 0 ? 'var(--profit)' : 'var(--loss)'],
            ['Total P&L', `$${totalPnl.toFixed(2)}`, totalPnl >= 0 ? 'var(--profit)' : 'var(--loss)'],
            ['Retake %', `${retakePct.toFixed(0)}%`, 'var(--text-secondary)'],
            ['Avg CR', `${avgCR.toFixed(0)}%`, 'var(--accent)'],
            ['Perfect CR', perfectCR, 'var(--accent)'],
            ['Macro %', `${macroPct.toFixed(0)}%`, 'var(--text-muted)'],
            ['Top Pair', topPair, 'var(--text-primary)'],
          ].map(([label, val, color]) => (
            <div key={label} className="card" style={{ padding: 12 }}>
              <div className="mono" style={{ color, fontWeight: 700, fontSize: '1.1rem' }}>{val}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* Profitability Band */}
        <div className={`card band-indicator band-${band}`}>
          <div className="flex justify-between items-center">
            <div>
              <div className="section-title" style={{ margin: 0, marginBottom: 4 }}>Profitability Band</div>
              <div style={{ fontWeight: 700, fontSize: '1rem', color: band === 'standard' ? 'var(--profit)' : band === 'highRR' ? 'var(--accent)' : 'var(--loss)' }}>
                {band === 'standard' ? 'Standard Band' : band === 'highRR' ? 'High R:R Band' : 'Outside Both Bands'}
              </div>
            </div>
            <div style={{ fontSize: '2rem' }}>
              {band === 'none' ? '⚠️' : '✓'}
            </div>
          </div>
        </div>

        {/* Recovery ruleset */}
        {recovery && (
          <div className="card" style={{ borderColor: 'var(--loss)', borderWidth: 1.5 }}>
            <div className="section-title" style={{ color: 'var(--loss)', marginBottom: 12 }}>Recovery Ruleset</div>
            <div className="flex-col gap-8">
              <div className="flex justify-between">
                <span className="muted" style={{ fontSize: '0.85rem' }}>Min R:R to target (at your WR)</span>
                <span className="mono accent">{recovery.minRRForWR}</span>
              </div>
              <div className="flex justify-between">
                <span className="muted" style={{ fontSize: '0.85rem' }}>Min WR to target (at your R:R)</span>
                <span className="mono accent">{recovery.minWRForRR}%</span>
              </div>
              <div className="flex justify-between">
                <span className="muted" style={{ fontSize: '0.85rem' }}>Recommended daily trade limit</span>
                <span className="mono accent">2</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingTop: 8, borderTop: '1px solid var(--card-border)' }}>
                Check the Confluence Tracker for underperforming setups. Something in your execution or reading has drifted.
              </div>
            </div>
          </div>
        )}

        {/* Confluence Tracker */}
        <ConfluenceTracker trades={trades} prevMonthTrades={prevTrades} />

        {/* CR card */}
        <div className="card flex justify-between items-center">
          <div>
            <div className="section-title">Avg Confidence Rate</div>
            <div className="stat-num">{avgCR.toFixed(0)}%</div>
          </div>
          <div style={{ width: 120, height: 50 }}>
            <ResponsiveContainer>
              <LineChart data={crLast30}>
                <Line type="monotone" dataKey="cr" stroke="var(--accent)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
          <input className="input" placeholder="Search notes…" style={{ flex: 1, minWidth: 140 }}
            value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} />
          {['ALL', 'WIN', 'LOSS'].map((f) => (
            <button key={f} className={`btn btn-ghost btn-sm ${filterResult === f ? 'active' : ''}`}
              style={filterResult === f ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
              onClick={() => setFilterResult(f)}>{f}</button>
          ))}
          <button className={`btn btn-ghost btn-sm ${filterRetake ? 'active' : ''}`}
            style={filterRetake ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
            onClick={() => setFilterRetake((v) => !v)}>Retake</button>
        </div>

        {/* Trade grid */}
        <div className="trade-grid">
          {filtered.map((t) => (
            <div key={t.id} className="card pointer" onClick={() => setEditTrade(t)} style={{ fontSize: '0.82rem' }}>
              <div className="flex justify-between items-center">
                <span className="mono" style={{ fontWeight: 700 }}>{t.pair}</span>
                <span className={`badge badge-${t.result?.toLowerCase()}`}>{t.result}</span>
              </div>
              <div className="flex justify-between mt-8">
                <span className={t.pnl >= 0 ? 'profit mono' : 'loss mono'} style={{ fontWeight: 700 }}>
                  {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                </span>
                <span className="mono muted">1:{t.rr?.toFixed(2)}</span>
              </div>
              {t.notes && <p className="truncate" style={{ fontSize: '0.75rem', marginTop: 6 }}>{t.notes}</p>}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card text-center" style={{ padding: 32, gridColumn: '1/-1' }}>
              <p className="muted">No trades match your filters.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right — prop accounts */}
      <div className="flex-col gap-12" style={{ overflowY: 'auto' }}>
        <div className="flex justify-between items-center">
          <div className="section-title" style={{ margin: 0 }}>Prop Accounts</div>
          <button className="btn btn-ghost btn-sm" onClick={() => setAccountModal('new')}>
            <Plus size={13} /> Add
          </button>
        </div>

        {accounts.map((acc) => (
          <PropAccountCard
            key={acc.id}
            account={acc}
            onEdit={setAccountModal}
            onDelete={deleteAccount}
          />
        ))}

        {accounts.length > 1 && (
          <div className="card">
            <div className="section-title mb-4">Total Buying Power</div>
            <div className="stat-num">${accounts.reduce((a, b) => a + (b.accountSize||0), 0).toLocaleString()}</div>
          </div>
        )}

        <RiskCalc accounts={accounts} />
      </div>

      {accountModal && (
        <AccountModal
          account={accountModal === 'new' ? null : accountModal}
          userId={user.uid}
          onClose={() => setAccountModal(null)}
        />
      )}

      {editTrade && (
        <LogTradeModal editTrade={editTrade} propAccounts={accounts} onClose={() => setEditTrade(null)} />
      )}

      <style>{`
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
          gap: 8px;
        }
        .trade-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 10px;
        }
        .band-standard { border-left: 3px solid var(--profit); }
        .band-highRR   { border-left: 3px solid var(--accent); }
        .band-none     { border-left: 3px solid var(--loss); }

        @media (max-width: 900px) {
          .stats-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>
    </div>
  )
}
