import { useEffect, useState } from 'react'
import { Building2, Plus } from 'lucide-react'
import SchemeForm from './SchemeForm'

export default function AdminContent({ request, notify, setError }) {
  const [schemes, setSchemes] = useState([])
  const [editing, setEditing] = useState(null)

  const load = () => {
    setError('')
    request('/api/schemes').then(r => setSchemes(r.data.schemes)).catch(e => setError(e.message))
  }
  useEffect(() => { load() }, [])

  async function save(values) {
    try {
      if (editing?.scheme_id) {
        await request(`/api/schemes/${editing.scheme_id}`, { method: 'PUT', body: JSON.stringify(values) })
      } else {
        await request('/api/schemes', { method: 'POST', body: JSON.stringify(values) })
      }
      setEditing(null)
      load()
      notify(editing?.scheme_id ? 'Scheme updated.' : 'Scheme created.')
    } catch (e) {
      setError(e.message)
    }
  }

  async function remove(scheme) {
    if (!window.confirm(`Delete “${scheme.name}”?`)) return
    try {
      await request(`/api/schemes/${scheme.scheme_id}`, { method: 'DELETE' })
      load()
      notify('Scheme deleted.')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="eyebrow">Government schemes</p>
          <h2>Scheme catalogue</h2>
        </div>
        <button className="button primary" onClick={() => setEditing({})}><Plus />Create scheme</button>
      </section>

      <section className="scheme-grid">
        {schemes.map(s => (
          <article className="scheme-card" key={s.scheme_id}>
            <span className="status muted">{s.government_level || 'Government'}</span>
            <h3>{s.name}</h3>
            <p>{s.description}</p>
            <div className="card-actions">
              <button className="button small" onClick={() => setEditing(s)}>Edit</button>
              <button className="button small danger" onClick={() => remove(s)}>Delete</button>
            </div>
          </article>
        ))}
        {!schemes.length && (
          <section className="empty">
            <Building2 />
            <h2>No schemes yet</h2>
          </section>
        )}
      </section>

      {editing && <SchemeForm scheme={editing} onClose={() => setEditing(null)} onSubmit={save} />}
    </>
  )
}
