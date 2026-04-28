import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ title, onClose, children, maxWidth = 560, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="modal-header">
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>{title}</span>
            <button onClick={onClose} className="btn btn-ghost btn-sm">
              <X size={14} />
            </button>
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
