import { useState, useEffect, useRef } from 'react'
import {
  collection, query, orderBy, onSnapshot, addDoc, deleteDoc,
  doc, updateDoc, serverTimestamp, where, limit, getDocs,
} from 'firebase/firestore'
import { Pin, Trash2, MessageSquare, Plus, X, ChevronRight } from 'lucide-react'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useLocation } from 'react-router-dom'
import Modal from '../components/shared/Modal'

const DEFAULT_TOPIC = { id: '__global__', title: 'War Room' }

const POST_TYPES = [
  { id: 'stat',         label: 'Stat Shoutout',       icon: '📊' },
  { id: 'trade',        label: 'Trade Post',           icon: '📈' },
  { id: 'model',        label: 'Entry Model',          icon: '🔬' },
  { id: 'today',        label: "Today's Trade",        icon: '🎯' },
  { id: 'leaderboard',  label: 'Leaderboard Snapshot', icon: '🏆' },
  { id: 'announcement', label: 'Formal Announcement',  icon: '📣' },
]

/* ── Message / Post bubble ─────────────────────────── */
function MessageBubble({ msg, onReply, onPin, onDelete, isAdmin, userId }) {
  const isOwn = msg.userId === userId
  const isPinned = msg.pinned

  return (
    <div className={`msg-wrap ${isPinned ? 'msg-pinned' : ''}`} id={`msg-${msg.id}`}>
      {isPinned && (
        <div className="pinned-label"><Pin size={10} /> Pinned</div>
      )}
      {msg.replyTo && (
        <div className="reply-ref" onClick={() => document.getElementById(`msg-${msg.replyTo}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>↩ {msg.replyToName}</div>
          <div className="truncate" style={{ fontSize: '0.78rem' }}>{msg.replyToText}</div>
        </div>
      )}

      <div className="msg-bubble card">
        {/* Post type badge */}
        {msg.type && msg.type !== 'chat' && (
          <div className="post-type-badge">
            {POST_TYPES.find((p) => p.id === msg.type)?.icon}{' '}
            {POST_TYPES.find((p) => p.id === msg.type)?.label}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-8 mb-8">
          {msg.userPhotoURL
            ? <img src={msg.userPhotoURL} alt="" className="avatar avatar-sm" />
            : <span className="avatar avatar-sm avatar-placeholder">{(msg.userDisplayName||'T')[0]}</span>
          }
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{msg.userDisplayName}</span>
            <span className="muted" style={{ fontSize: '0.72rem', marginLeft: 8 }}>
              {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        </div>

        {/* Announcement title */}
        {msg.postData?.title && (
          <div style={{ fontWeight: 800, fontSize: '1rem', marginBottom: 8 }}>{msg.postData.title}</div>
        )}

        {/* Body */}
        <div style={{ fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</div>

        {/* Stat highlight */}
        {msg.postData?.statLabel && (
          <div className="card mt-8" style={{ background: 'var(--accent-dim)', borderColor: 'rgba(0,229,255,0.3)', textAlign: 'center', padding: '12px 20px' }}>
            <div className="stat-num">{msg.postData.statValue}</div>
            <div className="muted" style={{ fontSize: '0.78rem' }}>{msg.postData.statLabel}</div>
          </div>
        )}

        {/* Trade mini-card */}
        {msg.postData?.trade && (
          <div className="card mt-8" style={{ fontSize: '0.82rem' }}>
            <div className="flex justify-between">
              <span className="mono" style={{ fontWeight: 700 }}>{msg.postData.trade.pair}</span>
              <span className={`badge badge-${msg.postData.trade.result?.toLowerCase()}`}>{msg.postData.trade.result}</span>
            </div>
            <div className="flex gap-16 mt-6">
              <span className={msg.postData.trade.pnl >= 0 ? 'profit mono' : 'loss mono'} style={{ fontWeight: 700 }}>
                {msg.postData.trade.pnl >= 0 ? '+' : ''}${msg.postData.trade.pnl?.toFixed(2)}
              </span>
              <span className="mono accent">1:{msg.postData.trade.rr?.toFixed(2)}</span>
            </div>
            {msg.postData.trade.screenshots?.[0] && (
              <img src={msg.postData.trade.screenshots[0]} alt="" style={{ width: '100%', borderRadius: 6, marginTop: 8, objectFit: 'cover', maxHeight: 160 }} />
            )}
          </div>
        )}

        {/* Link embed */}
        {msg.postData?.link && (
          <a href={msg.postData.link} target="_blank" rel="noreferrer"
            className="card mt-8 flex items-center gap-8"
            style={{ textDecoration: 'none', fontSize: '0.82rem', color: 'var(--accent)' }}
          >
            <ChevronRight size={14} /> {msg.postData.link}
          </a>
        )}

        {/* Screenshot */}
        {msg.postData?.screenshot && (
          <img src={msg.postData.screenshot} alt="" style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 200, objectFit: 'cover' }} />
        )}

        {/* Actions */}
        <div className="flex gap-6 mt-8">
          <button className="msg-action" onClick={() => onReply(msg)}>
            <MessageSquare size={12} /> Reply
          </button>
          {(isAdmin || isOwn) && (
            <button className="msg-action" onClick={() => onPin(msg)}>
              <Pin size={12} /> {isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {(isAdmin || isOwn) && (
            <button className="msg-action" style={{ color: 'var(--loss)' }} onClick={() => onDelete(msg.id)}>
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Create Post modal ─────────────────────────────── */
function CreatePostModal({ onClose, topicId, userId, userDoc, userPhoto, trades }) {
  const [step, setStep] = useState(0) // 0 = pick type, 1 = compose
  const [type, setType] = useState(null)
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [crossPost, setCrossPost] = useState(false)
  const [selectedTrade, setSelectedTrade] = useState(null)
  const [selectedStat, setSelectedStat] = useState(null)
  const [loading, setLoading] = useState(false)

  // Stat options from user's recent data
  const statOptions = [
    { label: 'Total Trades', value: trades.length },
    { label: 'Win Rate', value: `${trades.length ? (trades.filter((t) => t.result === 'WIN').length / trades.length * 100).toFixed(1) : 0}%` },
  ]

  async function post() {
    if (!text && type !== 'leaderboard') return
    setLoading(true)
    const base = {
      userId,
      userDisplayName: userDoc?.displayName || 'Trader',
      userPhotoURL: userPhoto || null,
      text,
      topicId: topicId === '__global__' ? null : topicId,
      type,
      replyTo: null,
      pinned: false,
      createdAt: serverTimestamp(),
      postData: {
        title: title || null,
        link: link || null,
        trade: selectedTrade || null,
        statLabel: selectedStat?.label || null,
        statValue: selectedStat?.value || null,
      },
    }
    await addDoc(collection(db, 'messages'), base)
    if (crossPost && topicId !== '__global__') {
      await addDoc(collection(db, 'messages'), { ...base, topicId: null })
    }
    setLoading(false)
    onClose()
  }

  return (
    <Modal title="Create Post" onClose={onClose}
      footer={step === 0
        ? <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        : <>
            <button className="btn btn-ghost" onClick={() => setStep(0)}>← Back</button>
            <button className="btn btn-primary" onClick={post} disabled={loading}>
              {loading ? <span className="spinner" /> : 'Post'}
            </button>
          </>
      }
    >
      {step === 0 ? (
        <div className="flex-col gap-8">
          <p className="muted" style={{ marginBottom: 8, fontSize: '0.88rem' }}>Choose a post type</p>
          {POST_TYPES.map((pt) => (
            <button
              key={pt.id}
              className="btn btn-ghost btn-full"
              style={{ justifyContent: 'flex-start', gap: 12 }}
              onClick={() => { setType(pt.id); setStep(1) }}
            >
              <span style={{ fontSize: '1.1rem' }}>{pt.icon}</span>
              <span>{pt.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex-col gap-12">
          {/* Announcement title */}
          {type === 'announcement' && (
            <div className="field">
              <label className="label">Title</label>
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
            </div>
          )}

          {/* Stat shoutout — pick stat */}
          {type === 'stat' && (
            <div className="field">
              <label className="label">Pick a stat to highlight</label>
              <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                {statOptions.map((s) => (
                  <button key={s.label}
                    className={`btn btn-ghost btn-sm ${selectedStat?.label === s.label ? 'active' : ''}`}
                    style={selectedStat?.label === s.label ? { borderColor: 'var(--accent)', color: 'var(--accent)' } : {}}
                    onClick={() => setSelectedStat(s)}
                  >
                    {s.label}: {s.value}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trade post — pick trade */}
          {(type === 'trade' || type === 'today') && (
            <div className="field">
              <label className="label">Attach a trade</label>
              <div className="flex-col gap-6" style={{ maxHeight: 200, overflowY: 'auto' }}>
                {trades.slice(0, 20).map((t) => (
                  <button key={t.id}
                    className={`card flex justify-between items-center ${selectedTrade?.id === t.id ? 'active' : ''}`}
                    style={{ background: selectedTrade?.id === t.id ? 'var(--accent-dim)' : undefined, border: selectedTrade?.id === t.id ? '1px solid var(--accent)' : undefined, cursor: 'pointer', textAlign: 'left' }}
                    onClick={() => setSelectedTrade(t)}
                  >
                    <span className="mono" style={{ fontWeight: 700, fontSize: '0.85rem' }}>{t.pair}</span>
                    <span className={`badge badge-${t.result?.toLowerCase()}`}>{t.result}</span>
                    <span className={`mono ${t.pnl >= 0 ? 'profit' : 'loss'}`} style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                      {t.pnl >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Body text */}
          <div className="field">
            <label className="label">{type === 'announcement' ? 'Body' : 'Message'}</label>
            <textarea className="input" rows={4} value={text} onChange={(e) => setText(e.target.value)}
              placeholder={type === 'today' ? "What are you watching for today's macro?" : 'Write your message…'} />
          </div>

          {/* Link (announcement) */}
          {type === 'announcement' && (
            <div className="field">
              <label className="label">Link (optional)</label>
              <input className="input" type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
            </div>
          )}

          {/* Cross-post toggle */}
          {topicId !== '__global__' && (
            <div className="flex items-center gap-12">
              <label className="label" style={{ margin: 0 }}>Also post to War Room</label>
              <div className="toggle-group" style={{ width: 100 }}>
                <button type="button" className={`toggle-btn ${crossPost ? 'active' : ''}`} onClick={() => setCrossPost(true)}>Yes</button>
                <button type="button" className={`toggle-btn ${!crossPost ? 'active' : ''}`} onClick={() => setCrossPost(false)}>No</button>
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

/* ── Main ──────────────────────────────────────────── */
export default function WarRoom() {
  const { user, userDoc, isAdmin } = useAuth()
  const location = useLocation()
  const [topics, setTopics] = useState([])
  const [activeTopic, setActiveTopic] = useState(DEFAULT_TOPIC)
  const [messages, setMessages] = useState([])
  const [pinnedMsgs, setPinnedMsgs] = useState([])
  const [chatText, setChatText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTopicName, setNewTopicName] = useState('')
  const [topicInputOpen, setTopicInputOpen] = useState(false)
  const [myTrades, setMyTrades] = useState([])
  const bottomRef = useRef()

  // Handle reply from Log page
  useEffect(() => {
    if (location.state?.replyTrade) {
      const t = location.state.replyTrade
      setChatText(`[Trade: ${t.pair} ${t.result} $${t.pnl?.toFixed(2)}] `)
    }
  }, [location.state])

  useEffect(() => {
    return onSnapshot(collection(db, 'topics'), (snap) => {
      setTopics(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    if (!user) return
    const q = query(collection(db, 'trades'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'), limit(30))
    return onSnapshot(q, (snap) => {
      setMyTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  useEffect(() => {
    const topicFilter = activeTopic.id === '__global__' ? null : activeTopic.id
    const q = query(
      collection(db, 'messages'),
      where('topicId', '==', topicFilter),
      orderBy('createdAt', 'asc'),
      limit(200)
    )
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      setMessages(all.filter((m) => !m.pinned))
      setPinnedMsgs(all.filter((m) => m.pinned))
    })
  }, [activeTopic])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendChat(e) {
    e.preventDefault()
    if (!chatText.trim()) return
    const topicId = activeTopic.id === '__global__' ? null : activeTopic.id
    await addDoc(collection(db, 'messages'), {
      userId: user.uid,
      userDisplayName: userDoc?.displayName || 'Trader',
      userPhotoURL: user.photoURL || null,
      text: chatText,
      topicId,
      type: 'chat',
      replyTo: replyTo?.id || null,
      replyToName: replyTo?.userDisplayName || null,
      replyToText: replyTo?.text?.slice(0, 80) || null,
      pinned: false,
      createdAt: serverTimestamp(),
      postData: null,
    })
    setChatText('')
    setReplyTo(null)
  }

  async function deleteMsg(id) {
    if (!confirm('Delete this message?')) return
    await deleteDoc(doc(db, 'messages', id))
  }

  async function togglePin(msg) {
    await updateDoc(doc(db, 'messages', msg.id), { pinned: !msg.pinned })
  }

  async function createTopic() {
    if (!newTopicName.trim()) return
    const docRef = await addDoc(collection(db, 'topics'), {
      title: newTopicName.trim(),
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    })
    setActiveTopic({ id: docRef.id, title: newTopicName.trim() })
    setNewTopicName('')
    setTopicInputOpen(false)
  }

  const allTopics = [DEFAULT_TOPIC, ...topics]

  return (
    <div className="warroom-layout">
      {/* Topic bar */}
      <div className="topic-bar">
        <div className="h-scroll" style={{ flex: 1 }}>
          {allTopics.map((t) => (
            <button
              key={t.id}
              className={`topic-chip ${activeTopic.id === t.id ? 'active' : ''}`}
              onClick={() => setActiveTopic(t)}
            >
              {t.title}
            </button>
          ))}
        </div>
        {topicInputOpen ? (
          <div className="flex items-center gap-6" style={{ flexShrink: 0 }}>
            <input
              className="input" style={{ width: 160, padding: '5px 10px', fontSize: '0.82rem' }}
              placeholder="Topic name…"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createTopic()}
              autoFocus
            />
            <button className="btn btn-primary btn-sm" onClick={createTopic}>Add</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setTopicInputOpen(false)}><X size={13} /></button>
          </div>
        ) : (
          <button className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => setTopicInputOpen(true)}>
            <Plus size={13} /> Topic
          </button>
        )}
      </div>

      {/* Pinned messages */}
      {pinnedMsgs.length > 0 && (
        <div className="pinned-bar">
          {pinnedMsgs.map((m) => (
            <div key={m.id} className="pinned-preview" onClick={() => document.getElementById(`msg-${m.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              <Pin size={10} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span className="truncate" style={{ fontSize: '0.78rem' }}>{m.userDisplayName}: {m.text?.slice(0, 60)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Message feed */}
      <div className="msg-feed">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <p className="muted">No messages yet. Start the conversation.</p>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onReply={setReplyTo}
            onPin={togglePin}
            onDelete={deleteMsg}
            isAdmin={isAdmin}
            userId={user?.uid}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Chat input */}
      <div className="chat-input-area">
        {replyTo && (
          <div className="reply-preview">
            <span style={{ fontSize: '0.75rem' }}>Replying to <strong>{replyTo.userDisplayName}</strong>: {replyTo.text?.slice(0, 60)}</span>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <X size={13} />
            </button>
          </div>
        )}
        <form className="chat-form" onSubmit={sendChat}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCreateOpen(true)} title="Create post">
            <Plus size={15} />
          </button>
          <input
            className="input"
            style={{ flex: 1, padding: '8px 14px' }}
            placeholder="Message…"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
          />
          <button type="submit" className="btn btn-primary btn-sm" disabled={!chatText.trim()}>
            Send
          </button>
        </form>
      </div>

      {createOpen && (
        <CreatePostModal
          onClose={() => setCreateOpen(false)}
          topicId={activeTopic.id}
          userId={user?.uid}
          userDoc={userDoc}
          userPhoto={user?.photoURL}
          trades={myTrades}
        />
      )}

      <style>{`
        .warroom-layout {
          display: flex;
          flex-direction: column;
          height: calc(100dvh - var(--top-bar-h) - var(--bottom-bar-h));
        }

        /* Topic bar */
        .topic-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 16px;
          border-bottom: 1px solid var(--card-border);
          background: var(--bg-secondary);
          flex-shrink: 0;
        }
        .topic-chip {
          padding: 5px 14px;
          border-radius: 99px;
          border: 1px solid var(--card-border);
          background: transparent;
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
          font-family: inherit;
          transition: all 0.15s;
        }
        .topic-chip:hover { background: rgba(255,255,255,0.06); }
        .topic-chip.active {
          background: var(--accent-dim);
          border-color: var(--accent);
          color: var(--accent);
        }

        /* Pinned */
        .pinned-bar {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 16px;
          background: rgba(0,229,255,0.04);
          border-bottom: 1px solid rgba(0,229,255,0.12);
          flex-shrink: 0;
        }
        .pinned-preview {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          padding: 2px 0;
        }

        /* Feed */
        .msg-feed {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 720px;
          width: 100%;
          margin: 0 auto;
        }

        /* Message */
        .msg-wrap { display: flex; flex-direction: column; gap: 4px; }
        .msg-pinned { background: rgba(0,229,255,0.04); border-radius: var(--radius); padding: 8px; }
        .pinned-label { display: flex; align-items: center; gap: 4px; font-size: 0.7rem; color: var(--accent); font-weight: 700; letter-spacing: 0.06em; }
        .msg-bubble { position: relative; }
        .post-type-badge {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--accent);
          margin-bottom: 8px;
          text-transform: uppercase;
        }
        .reply-ref {
          background: var(--bg-tertiary);
          border-left: 3px solid var(--accent);
          padding: 6px 10px;
          border-radius: 0 6px 6px 0;
          cursor: pointer;
          margin-bottom: 4px;
          max-width: 500px;
        }
        .msg-action {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-family: inherit;
          padding: 2px 6px;
          border-radius: 4px;
          transition: all 0.12s;
        }
        .msg-action:hover { background: rgba(255,255,255,0.06); color: var(--text-secondary); }

        /* Chat input */
        .chat-input-area {
          border-top: 1px solid var(--card-border);
          padding: 12px 16px;
          background: var(--bg-secondary);
          flex-shrink: 0;
          max-width: 720px;
          width: 100%;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .chat-form { display: flex; align-items: center; gap: 8px; }
        .reply-preview {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: var(--bg-tertiary);
          border-left: 3px solid var(--accent);
          padding: 6px 10px;
          border-radius: 0 6px 6px 0;
          margin-bottom: 8px;
          font-size: 0.8rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
