import { useState } from 'react'
import { X } from 'lucide-react'

export function ApiError({ message, onDismiss }) {
  if (!message) return null
  return (
    <div className="error">
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          className="icon-button error-dismiss"
          onClick={onDismiss}
          aria-label="Dismiss error"
        >
          <X />
        </button>
      )}
    </div>
  )
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section className="modal" onMouseDown={e => e.stopPropagation()}>
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function Status({ value }) {
  const tone = value === 'ADOPTED' ? 'good' : value === 'NOT_ADOPTED' ? 'bad' : value === 'UNAUDITED' ? 'muted' : 'warn'
  return <span className={`status ${tone}`}>{String(value || 'PENDING').replaceAll('_', ' ')}</span>
}

export function Metric({ icon, label, value }) {
  return (
    <article className="metric">
      <span>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </article>
  )
}

export function DataTable({ headers, rows, empty }) {
  return (
    <section className="panel">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, x) => (
                  <td key={x}>{cell || '—'}</td>
                ))}
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td className="empty-cell" colSpan={headers.length}>{empty}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function Form({ children, onSubmit, submit }) {
  const [busy, setBusy] = useState(false)
  const submitForm = async e => {
    e.preventDefault()
    setBusy(true)
    const values = Object.fromEntries(new FormData(e.currentTarget))
    await onSubmit(values)
    setBusy(false)
  }
  return (
    <form className="stack" onSubmit={submitForm}>
      {children}
      <button className="button primary" disabled={busy}>
        {busy ? 'Saving…' : submit}
      </button>
    </form>
  )
}
