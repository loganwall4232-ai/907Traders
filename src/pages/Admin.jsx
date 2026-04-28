import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, doc, updateDoc, getDoc, setDoc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { Navigate } from 'react-router-dom'

const ADMIN_EMAIL = 'sellerlw30@gmail.com'

export default function Admin() {
  const { user, isAdmin, revokeGroupPassword } = useAuth()
  const [members, setMembers] = useState([])
  const [newPassword, setNewPassword] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [noteEdits, setNoteEdits] = useState({})
  const [tradeCounts, setTradeCounts] = useState({})

  if (!isAdmin) return <Navigate to="/strategy" replace />

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), (snap) => {
      setMembers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    })
  }, [])

  useEffect(() => {
    return onSnapshot(collection(db, 'trades'), (snap) => {
      const counts = {}
      snap.docs.forEach((d) => {
        const uid = d.data().userId
        counts[uid] = (counts[uid] || 0) + 1
      })
      setTradeCounts(counts)
    })
  }, [])

  async function saveNote(uid) {
    const note = noteEdits[uid]
    if (note === undefined) return
    await updateDoc(doc(db, 'users', uid), { privateNote: note })
  }

  async function setPermission(uid, key, val) {
    await updateDoc(doc(db, 'users', uid), { [`permissions.${key}`]: val })
  }

  async function resetGroupPassword() {
    if (!newPassword.trim()) return
    setPwLoading(true)
    await setDoc(doc(db, 'settings', 'app'), {
      groupPassword: newPassword,
      lastPasswordChange: serverTimestamp(),
    }, { merge: true })
    // Revoke all local sessions by clearing the key
    revokeGroupPassword()
    setPwSuccess(true)
    setNewPassword('')
    setPwLoading(false)
  }

  return (
    <div className="page-pad">
      <h2 style={{ marginBottom: 24 }}>Admin Panel</h2>

      {/* Group Password */}
      <section className="card-lg mb-16">
        <div className="section-title">Group Password</div>
        <p className="mt-4 mb-12" style={{ fontSize: '0.88rem' }}>
          Changing the password will force-kick all active sessions. Every user must re-enter on their next load.
        </p>
        <div className="flex gap-10" style={{ flexWrap: 'wrap' }}>
          <input
            className="input"
            type="text"
            placeholder="New group password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={{ maxWidth: 320 }}
          />
          <button
            className="btn btn-primary"
            onClick={resetGroupPassword}
            disabled={pwLoading || !newPassword.trim()}
          >
            {pwLoading ? <span className="spinner" /> : 'Reset Password'}
          </button>
        </div>
        {pwSuccess && (
          <div className="profit mt-8" style={{ fontSize: '0.85rem' }}>
            Password updated. All sessions revoked — users will be prompted on next load.
          </div>
        )}
      </section>

      {/* Member List */}
      <section>
        <div className="section-title mb-12">Members ({members.length})</div>
        <div className="flex-col gap-12">
          {members.map((m) => {
            const perms = m.permissions || {}
            return (
              <div key={m.uid} className="card-lg" style={{ borderLeft: m.uid === user?.uid ? '3px solid var(--accent)' : undefined }}>
                {/* Header */}
                <div className="flex justify-between items-center mb-12">
                  <div className="flex items-center gap-12">
                    {m.photoURL
                      ? <img src={m.photoURL} alt="" className="avatar avatar-md" />
                      : <span className="avatar avatar-md avatar-placeholder">{(m.displayName || 'T')[0]}</span>
                    }
                    <div>
                      <div style={{ fontWeight: 700 }}>{m.displayName}</div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>{m.email}</div>
                      <div className="muted" style={{ fontSize: '0.72rem' }}>
                        Joined {m.joinDate?.toDate
                          ? m.joinDate.toDate().toLocaleDateString()
                          : 'Unknown'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-16 text-right">
                    <div>
                      <div className="mono" style={{ fontWeight: 700, color: 'var(--accent)' }}>
                        {tradeCounts[m.uid] || 0}
                      </div>
                      <div className="muted" style={{ fontSize: '0.7rem' }}>Trades</div>
                    </div>
                    {m.email === ADMIN_EMAIL && (
                      <span className="badge" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>ADMIN</span>
                    )}
                  </div>
                </div>

                {/* Permissions */}
                <div className="section-title mb-8">Permissions</div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
                  {[
                    ['canPost', 'Post'],
                    ['canCreateTopic', 'Create Topics'],
                    ['canPin', 'Pin'],
                    ['canFormalAnnounce', 'Announcements'],
                    ['canCrossPost', 'Cross-Post'],
                  ].map(([key, label]) => (
                    <button
                      key={key}
                      className={`btn btn-ghost btn-sm ${perms[key] ? 'active' : ''}`}
                      style={perms[key] ? { borderColor: 'var(--profit)', color: 'var(--profit)' } : { color: 'var(--loss)' }}
                      onClick={() => setPermission(m.uid, key, !perms[key])}
                      disabled={m.uid === user?.uid}
                    >
                      {perms[key] ? '✓' : '✗'} {label}
                    </button>
                  ))}
                </div>

                {/* Moderation */}
                <div className="flex gap-8" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
                  <button
                    className={`btn btn-sm ${perms.muted ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => setPermission(m.uid, 'muted', !perms.muted)}
                    disabled={m.uid === user?.uid}
                  >
                    {perms.muted ? 'Unmute' : 'Mute Chat'}
                  </button>
                  <button
                    className={`btn btn-sm ${perms.restricted ? 'btn-danger' : 'btn-ghost'}`}
                    onClick={() => setPermission(m.uid, 'restricted', !perms.restricted)}
                    disabled={m.uid === user?.uid}
                  >
                    {perms.restricted ? 'Unrestrict Trading' : 'Restrict Trading'}
                  </button>
                  <button
                    className={`btn btn-sm ${perms.banned ? 'btn-danger' : 'btn-ghost'}`}
                    style={!perms.banned ? { color: 'var(--loss)', borderColor: 'rgba(255,23,68,0.3)' } : {}}
                    onClick={() => setPermission(m.uid, 'banned', !perms.banned)}
                    disabled={m.uid === user?.uid}
                  >
                    {perms.banned ? 'Unban' : 'Ban'}
                  </button>
                </div>

                {/* Private note */}
                <div className="field">
                  <label className="label">Private Admin Note (only you see this)</label>
                  <div className="flex gap-8">
                    <textarea
                      className="input"
                      rows={2}
                      value={noteEdits[m.uid] !== undefined ? noteEdits[m.uid] : (m.privateNote || '')}
                      onChange={(e) => setNoteEdits((n) => ({ ...n, [m.uid]: e.target.value }))}
                      placeholder="Notes about this member…"
                    />
                    {noteEdits[m.uid] !== undefined && (
                      <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }} onClick={() => saveNote(m.uid)}>
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <style>{`
        .mb-16 { margin-bottom: 16px; }
      `}</style>
    </div>
  )
}
