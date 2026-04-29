import { useState, useRef } from 'react'
import { X, Upload, Trash2 } from 'lucide-react'
import {
  collection, addDoc, updateDoc, doc, serverTimestamp, increment,
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, storage } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { PAIRS, CONFLUENCES, detectMacroWindow } from '../../utils/constants'
import Modal from '../shared/Modal'

const EMPTY = {
  pair: 'NQ',
  result: '',
  pnl: '',
  risk: '',
  reward: '',
  entryPrice: '',
  exitPrice: '',
  stopPrice: '',
  targetPrice: '',
  date: new Date().toISOString().split('T')[0],
  entryTime: '',
  exitTime: '',
  confluences: { reversal: [], confirmation: [], continuation: [] },
  confidence: 70,
  notes: '',
  wouldTakeAgain: true,
  accountIds: [],
}

export default function LogTradeModal({ onClose, propAccounts = [], editTrade = null }) {
  const { user, userDoc } = useAuth()
  const [form, setForm] = useState(editTrade ? {
    ...EMPTY,
    ...editTrade,
    date: editTrade.date?.toDate
      ? editTrade.date.toDate().toISOString().split('T')[0]
      : editTrade.date || EMPTY.date,
  } : EMPTY)
  const [screenshots, setScreenshots] = useState([])
  const [existingUrls, setExistingUrls] = useState(editTrade?.screenshots || [])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef()
  const [dragOver, setDragOver] = useState(false)

  const rr = form.risk && form.reward
    ? (parseFloat(form.reward) / parseFloat(form.risk)).toFixed(2)
    : ''

  const macroWindow = detectMacroWindow(form.entryTime)

  function set(key, val) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function toggleConf(type, name) {
    setForm((f) => {
      const arr = f.confluences[type]
      return {
        ...f,
        confluences: {
          ...f.confluences,
          [type]: arr.includes(name) ? arr.filter((x) => x !== name) : [...arr, name],
        },
      }
    })
  }

  function toggleAccount(id) {
    set('accountIds', form.accountIds.includes(id)
      ? form.accountIds.filter((x) => x !== id)
      : [...form.accountIds, id])
  }

  function handleFiles(files) {
    const valid = Array.from(files).filter((f) => f.type.startsWith('image/'))
    setScreenshots((prev) => [...prev, ...valid])
  }

  function removeNew(i) {
    setScreenshots((prev) => prev.filter((_, idx) => idx !== i))
  }

  function removeExisting(url) {
    setExistingUrls((prev) => prev.filter((u) => u !== url))
  }

  async function uploadScreenshots() {
    const urls = []
    for (const file of screenshots) {
      const r = ref(storage, `trades/${user.uid}/${Date.now()}_${file.name}`)
      await uploadBytes(r, file)
      urls.push(await getDownloadURL(r))
    }
    return urls
  }

  async function submit(e) {
    e.preventDefault()
    if (!form.result) return
    setLoading(true)
    try {
      if (screenshots.length) setUploading(true)
      const newUrls = await uploadScreenshots()
      setUploading(false)

      const data = {
        userId: user.uid,
        userDisplayName: userDoc?.displayName || user.email,
        userPhotoURL: user.photoURL || null,
        pair: form.pair,
        result: form.result,
        pnl: parseFloat(form.pnl) || 0,
        risk: parseFloat(form.risk) || 0,
        reward: parseFloat(form.reward) || 0,
        rr: parseFloat(rr) || 0,
        entryPrice: parseFloat(form.entryPrice) || 0,
        exitPrice: parseFloat(form.exitPrice) || 0,
        stopPrice: parseFloat(form.stopPrice) || 0,
        targetPrice: parseFloat(form.targetPrice) || 0,
        date: new Date(form.date),
        entryTime: form.entryTime,
        exitTime: form.exitTime,
        confluences: form.confluences,
        macroWindow,
        confidence: parseInt(form.confidence) || 0,
        notes: form.notes,
        wouldTakeAgain: form.wouldTakeAgain,
        accountIds: form.accountIds,
        screenshots: [...existingUrls, ...newUrls],
      }

      const pnlDelta = parseFloat(form.pnl) || 0

      if (editTrade) {
        // On edit: reverse the old P&L, apply the new one to each account
        const oldPnl = editTrade.pnl || 0
        const oldAccounts = editTrade.accountIds || []
        await updateDoc(doc(db, 'trades', editTrade.id), data)
        // Remove old delta from accounts that are no longer selected
        for (const accId of oldAccounts) {
          if (!form.accountIds.includes(accId)) {
            await updateDoc(doc(db, 'propAccounts', accId), { currentBalance: increment(-oldPnl) })
          }
        }
        // Apply new delta to newly selected or kept accounts
        for (const accId of form.accountIds) {
          const delta = oldAccounts.includes(accId) ? pnlDelta - oldPnl : pnlDelta
          if (delta !== 0) await updateDoc(doc(db, 'propAccounts', accId), { currentBalance: increment(delta) })
        }
      } else {
        await addDoc(collection(db, 'trades'), { ...data, createdAt: serverTimestamp() })
        for (const accId of form.accountIds) {
          await updateDoc(doc(db, 'propAccounts', accId), { currentBalance: increment(pnlDelta) })
        }
      }
      onClose()
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  return (
    <Modal
      title={editTrade ? 'Edit Trade' : 'Log Trade'}
      onClose={onClose}
      maxWidth={620}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={loading || !form.result}
          >
            {loading
              ? <span className="spinner" />
              : editTrade ? 'Save Changes' : 'Post to Group Log'}
          </button>
        </>
      }
    >
      <form onSubmit={submit} className="flex-col gap-16">

        {/* Screenshots */}
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
          onClick={() => fileRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        >
          <Upload size={18} className="accent" style={{ margin: '0 auto 6px', display: 'block' }} />
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Drop screenshots or click to upload
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
        {(existingUrls.length > 0 || screenshots.length > 0) && (
          <div className="screenshot-grid">
            {existingUrls.map((url) => (
              <div key={url} className="relative">
                <img src={url} className="screenshot-thumb" alt="" />
                <button
                  type="button"
                  onClick={() => removeExisting(url)}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <X size={10} color="#fff" />
                </button>
              </div>
            ))}
            {screenshots.map((f, i) => (
              <div key={i} className="relative">
                <img src={URL.createObjectURL(f)} className="screenshot-thumb" alt="" />
                <button
                  type="button"
                  onClick={() => removeNew(i)}
                  style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <X size={10} color="#fff" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Pair */}
        <div className="field">
          <label className="label">Instrument</label>
          <div className="pair-grid">
            {PAIRS.map((p) => (
              <button
                key={p} type="button"
                className={`pair-chip ${form.pair === p ? 'active' : ''}`}
                onClick={() => set('pair', p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* P&L + R:R */}
        <div className="field-row">
          <div className="field">
            <label className="label">P&L ($)</label>
            <input className="input" type="number" step="0.01" placeholder="0.00"
              value={form.pnl} onChange={(e) => set('pnl', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Risk</label>
            <input className="input" type="number" step="0.01" placeholder="0.00"
              value={form.risk} onChange={(e) => set('risk', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Reward</label>
            <input className="input" type="number" step="0.01" placeholder="0.00"
              value={form.reward} onChange={(e) => set('reward', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">R:R</label>
            <input className="input mono" readOnly value={rr ? `1:${rr}` : '—'} style={{ color: 'var(--accent)' }} />
          </div>
        </div>

        {/* Prices */}
        <div className="field-row">
          <div className="field">
            <label className="label">Entry</label>
            <input className="input mono" type="number" step="0.25" placeholder="0"
              value={form.entryPrice} onChange={(e) => set('entryPrice', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Exit</label>
            <input className="input mono" type="number" step="0.25" placeholder="0"
              value={form.exitPrice} onChange={(e) => set('exitPrice', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Stop</label>
            <input className="input mono" type="number" step="0.25" placeholder="0"
              value={form.stopPrice} onChange={(e) => set('stopPrice', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Target</label>
            <input className="input mono" type="number" step="0.25" placeholder="0"
              value={form.targetPrice} onChange={(e) => set('targetPrice', e.target.value)} />
          </div>
        </div>

        {/* Date / Times */}
        <div className="field-row">
          <div className="field">
            <label className="label">Date</label>
            <input className="input" type="date"
              value={form.date} onChange={(e) => set('date', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Entry Time (ET)</label>
            <input className="input mono" type="time"
              value={form.entryTime} onChange={(e) => set('entryTime', e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Exit Time (ET)</label>
            <input className="input mono" type="time"
              value={form.exitTime} onChange={(e) => set('exitTime', e.target.value)} />
          </div>
        </div>
        {macroWindow && (
          <div style={{ marginTop: -8 }}>
            <span className="badge badge-macro">{macroWindow} detected</span>
          </div>
        )}

        {/* Confluences */}
        <div className="field">
          <label className="label">Confluences</label>
          <div className="flex-col gap-12">
            {Object.entries(CONFLUENCES).map(([type, { label, items }]) => (
              <div key={type}>
                <div className="section-title" style={{ marginBottom: 8 }}>{label}</div>
                <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
                  {items.map((name) => (
                    <button
                      key={name} type="button"
                      className={`chip chip-${type} ${form.confluences[type].includes(name) ? 'active' : ''}`}
                      onClick={() => toggleConf(type, name)}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="field">
          <label className="label">Notes</label>
          <textarea className="input" rows={3} placeholder="What did you see? What worked? What didn't?"
            value={form.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {/* Confidence */}
        <div className="field">
          <label className="label">Confidence Rate — {form.confidence}%</label>
          <input type="range" min={0} max={100} value={form.confidence}
            onChange={(e) => set('confidence', e.target.value)}
            style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>

        {/* Would take again */}
        <div className="flex items-center gap-12">
          <label className="label" style={{ margin: 0 }}>Would take again?</label>
          <div className="toggle-group" style={{ width: 160 }}>
            <button type="button" className={`toggle-btn ${form.wouldTakeAgain ? 'active' : ''}`}
              onClick={() => set('wouldTakeAgain', true)}>Yes</button>
            <button type="button" className={`toggle-btn ${!form.wouldTakeAgain ? 'active' : ''}`}
              onClick={() => set('wouldTakeAgain', false)}>No</button>
          </div>
        </div>

        {/* Prop accounts */}
        {propAccounts.length > 0 && (
          <div className="field">
            <label className="label">Apply to Accounts</label>
            <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
              {propAccounts.map((acc) => (
                <button
                  key={acc.id} type="button"
                  className={`pair-chip ${form.accountIds.includes(acc.id) ? 'active' : ''}`}
                  onClick={() => toggleAccount(acc.id)}
                >
                  {acc.firmName} {acc.accountSize ? `$${(acc.accountSize / 1000).toFixed(0)}K` : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* WIN / LOSS */}
        <div className="field">
          <label className="label">Result</label>
          <div className="result-toggle">
            <button type="button"
              className={`result-btn ${form.result === 'WIN' ? 'win-active' : ''}`}
              onClick={() => set('result', 'WIN')}>WIN</button>
            <button type="button"
              className={`result-btn ${form.result === 'LOSS' ? 'loss-active' : ''}`}
              onClick={() => set('result', 'LOSS')}>LOSS</button>
          </div>
        </div>

      </form>
    </Modal>
  )
}
