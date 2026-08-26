import { useEffect, useMemo, useState } from 'react'
import { Building2 } from 'lucide-react'

export default function VillageHeadSchemes({ request, setError }) {
  const [schemes, setSchemes] = useState([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    setBusy(true)
    setError('')
    request('/api/schemes')
      .then(res => setSchemes(res.data?.schemes || []))
      .catch(err => setError(err.message))
      .finally(() => setBusy(false))
  }, [request, setError])

  const filtered = useMemo(() => {
    if (!search.trim()) return schemes
    const q = search.toLowerCase()
    return schemes.filter(s =>
      s.name?.toLowerCase().includes(q) ||
      s.description?.toLowerCase().includes(q) ||
      s.benefit_description?.toLowerCase().includes(q) ||
      s.eligibility?.toLowerCase().includes(q)
    )
  }, [schemes, search])

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="eyebrow">Support & Subsidies</p>
          <h2>Government Agricultural Schemes</h2>
        </div>
      </section>

      <div className="schemes-search-bar">
        <input
          type="text"
          placeholder="Search schemes by name, subsidy benefit, eligibility, or crop..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <section className="scheme-grid">
        {filtered.map(s => (
          <article className="scheme-card" key={s.scheme_id}>
            <span className="status muted">{s.government_level || 'State Government'}</span>
            <h3>{s.name}</h3>
            <p>{s.benefit_description || s.description}</p>
            {s.eligibility && (
              <small style={{ display: 'block', marginTop: '8px', color: 'var(--muted)' }}>
                <strong>Eligibility:</strong> {s.eligibility}
              </small>
            )}
            {s.external_link && (
              <div style={{ marginTop: '14px' }}>
                <a
                  href={s.external_link}
                  target="_blank"
                  rel="noreferrer"
                  className="button small"
                  style={{ textDecoration: 'none', display: 'inline-flex' }}
                >
                  Official Portal ↗
                </a>
              </div>
            )}
          </article>
        ))}
        {!filtered.length && !busy && (
          <section className="empty">
            <Building2 />
            <h2>No matching schemes found</h2>
            <p>Try searching with a different keyword.</p>
          </section>
        )}
      </section>
    </>
  )
}
