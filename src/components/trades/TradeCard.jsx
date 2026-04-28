import { useState } from 'react'
import { Edit2, Trash2, MessageSquare } from 'lucide-react'
import { deleteDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { CONFLUENCE_TYPE } from '../../utils/constants'
import LogTradeModal from './LogTradeModal'

function Avatar({ photoURL, displayName, size = 'md' }) {
  const initials = (displayName || 'T').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
  if (photoURL) return <img src={photoURL} alt="" className={`avatar avatar-${size}`} />
  return <span className={`avatar avatar-${size} avatar-placeholder`}>{initials}</span>
}

export default function TradeCard({ trade, propAccounts = [], onReply }) {
  const { user, isAdmin } = useAuth()
  const [editOpen, setEditOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const isOwn = user?.uid === trade.userId

  const allConf = [
    ...trade.confluences?.reversal || [],
    ...trade.confluences?.confirmation || [],
    ...trade.confluences?.continuation || [],
  ]

  async function remove() {
    if (!confirm('Delete this trade?')) return
    await deleteDoc(doc(db, 'trades', trade.id))
  }

  const date = trade.date?.toDate
    ? trade.date.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : trade.date

  return (
    <>
      <div className={`trade-card card ${trade.result === 'WIN' ? 'card-win' : 'card-loss'}`}>
        {/* Header */}
        <div className="tc-header">
          <div className="flex items-center gap-8">
            <Avatar photoURL={trade.userPhotoURL} displayName={trade.userDisplayName} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{trade.userDisplayName}</div>
              <div className="muted" style={{ fontSize: '0.75rem' }}>{date}</div>
            </div>
          </div>
          <div className="flex items-center gap-8">
            <span className="mono" style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              {trade.pair}
            </span>
            <span className={`badge badge-${trade.result?.toLowerCase()}`}>{trade.result}</span>
            {trade.macroWindow && (
              <span className="badge badge-macro">{trade.macroWindow}</span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="tc-stats">
          <div className="tc-stat">
            <div className={`mono ${trade.pnl >= 0 ? 'profit' : 'loss'}`} style={{ fontSize: '1.1rem', fontWeight: 700 }}>
              {trade.pnl >= 0 ? '+' : ''}{trade.pnl?.toFixed(2)}
            </div>
            <div className="muted" style={{ fontSize: '0.7rem' }}>P&L</div>
          </div>
          <div className="tc-stat">
            <div className="mono accent" style={{ fontWeight: 700 }}>
              {trade.rr ? `1:${Number(trade.rr).toFixed(2)}` : '—'}
            </div>
            <div className="muted" style={{ fontSize: '0.7rem' }}>R:R</div>
          </div>
          <div className="tc-stat">
            <div className="mono" style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>
              {trade.confidence}%
            </div>
            <div className="muted" style={{ fontSize: '0.7rem' }}>CR</div>
          </div>
          <div className="tc-stat">
            <div style={{ fontWeight: 600, fontSize: '0.82rem', color: trade.wouldTakeAgain ? 'var(--profit)' : 'var(--loss)' }}>
              {trade.wouldTakeAgain ? 'Yes' : 'No'}
            </div>
            <div className="muted" style={{ fontSize: '0.7rem' }}>Retake</div>
          </div>
        </div>

        {/* Confluences */}
        {allConf.length > 0 && (
          <div className="flex gap-4 mt-8" style={{ flexWrap: 'wrap' }}>
            {allConf.map((name) => {
              const type = CONFLUENCE_TYPE[name] || 'reversal'
              return (
                <span key={name} className={`chip chip-${type}`} style={{ fontSize: '0.72rem', padding: '2px 8px', cursor: 'default' }}>
                  {name}
                </span>
              )
            })}
          </div>
        )}

        {/* Screenshots */}
        {trade.screenshots?.length > 0 && (
          <div className="screenshot-grid">
            {trade.screenshots.map((url) => (
              <img
                key={url} src={url} alt=""
                className="screenshot-thumb"
                onClick={() => setLightbox(url)}
              />
            ))}
          </div>
        )}

        {/* Notes */}
        {trade.notes && (
          <p style={{ fontSize: '0.85rem', marginTop: 10, lineHeight: 1.6 }}>{trade.notes}</p>
        )}

        {/* Actions */}
        <div className="tc-actions">
          {onReply && (
            <button className="btn btn-ghost btn-sm" onClick={() => onReply(trade)}>
              <MessageSquare size={13} /> Reply
            </button>
          )}
          {isOwn && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditOpen(true)}>
              <Edit2 size={13} /> Edit
            </button>
          )}
          {(isAdmin || isOwn) && (
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--loss)' }} onClick={remove}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {editOpen && (
        <LogTradeModal
          editTrade={trade}
          propAccounts={propAccounts}
          onClose={() => setEditOpen(false)}
        />
      )}

      {lightbox && (
        <div className="overlay" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="lightbox-img" alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <style>{`
        .trade-card { display: flex; flex-direction: column; gap: 10px; }
        .card-win { border-left: 3px solid var(--profit); }
        .card-loss { border-left: 3px solid var(--loss); }
        .tc-header { display: flex; align-items: center; justify-content: space-between; }
        .tc-stats { display: flex; gap: 20px; padding: 10px 0; border-top: 1px solid var(--card-border); border-bottom: 1px solid var(--card-border); }
        .tc-stat { display: flex; flex-direction: column; gap: 2px; }
        .tc-actions { display: flex; gap: 6px; padding-top: 6px; }
      `}</style>
    </>
  )
}
