import { useEffect, useMemo, useState } from 'react'
import { BadgeCheck, Building2, CheckCircle2, ChevronDown, ChevronRight, Droplets, Filter, MapPin, Plus, Search, ShieldCheck, Sprout } from 'lucide-react'
import { Metric, Status, Modal, Form } from '../common/CommonUI'
import SearchableSelect from '../common/SearchableSelect'

const today = new Date().toISOString().slice(0, 10)

export function AuditForm({ audit, methods, onClose, onSubmit }) {
  const [actualMethodId, setActualMethodId] = useState(
    audit.actual_irrigation_method_id || (methods?.[0]?.id ?? '')
  )
  const [adoptionStatus, setAdoptionStatus] = useState(
    audit.adoption_status === 'UNAUDITED' ? 'ADOPTED' : (audit.adoption_status || 'ADOPTED')
  )
  const [auditDate, setAuditDate] = useState(
    audit.audit_date ? String(audit.audit_date).slice(0, 10) : today
  )
  const [notes, setNotes] = useState(audit.notes || '')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    await onSubmit({
      actual_irrigation_method_id: Number(actualMethodId),
      adoption_status: adoptionStatus,
      audit_date: auditDate,
      notes
    })
    setBusy(false)
  }

  const methodOptions = (methods || []).map(m => ({
    value: m.id,
    label: m.name,
    sublabel: m.water_efficiency || m.waterEfficiency ? `${m.water_efficiency || m.waterEfficiency} Efficiency` : undefined,
    badge: m.water_savings_percentage !== undefined ? `${m.water_savings_percentage}% savings` : (m.waterSavingsPercentage !== undefined ? `${m.waterSavingsPercentage}% savings` : undefined)
  }))

  const statusOptions = [
    { value: 'ADOPTED', label: 'Adopted (Water-saving practice verified)' },
    { value: 'NOT_ADOPTED', label: 'Not Adopted (Conventional flood used)' },
    { value: 'PENDING', label: 'Pending Inspection' }
  ]

  return (
    <Modal title={audit.audit_id ? 'Update Audit Verification' : 'Verify Irrigation Adoption'} onClose={onClose}>
      <div className="record-meta-bar" style={{ marginBottom: '16px' }}>
        <div className="record-meta-item">
          <span>Farm:</span>
          <strong>{audit.farm_name}</strong>
        </div>
        <div className="record-meta-item">
          <span>Crop:</span>
          <strong>{audit.crop_name}</strong>
        </div>
        <div className="record-meta-item">
          <span>Season:</span>
          <strong>{audit.season_name} ({audit.agricultural_year})</strong>
        </div>
        {audit.cultivated_area_hectares && (
          <div className="record-meta-item">
            <span>Plot:</span>
            <strong>{audit.cultivated_area_hectares} ha</strong>
          </div>
        )}
      </div>

      <form className="stack" onSubmit={handleSubmit}>
        <SearchableSelect
          label="Actual Verified Irrigation Method"
          value={actualMethodId}
          onChange={setActualMethodId}
          options={methodOptions}
          placeholder="Select verified irrigation method on-site..."
          icon={<Droplets />}
        />

        <SearchableSelect
          label="Adoption Status"
          value={adoptionStatus}
          onChange={setAdoptionStatus}
          options={statusOptions}
          placeholder="Select audit verification status..."
          icon={<BadgeCheck />}
        />

        <label>
          Audit Date
          <input
            name="audit_date"
            type="date"
            value={auditDate}
            onChange={e => setAuditDate(e.target.value)}
            required
          />
        </label>

        <label>
          Auditor Field Notes
          <textarea
            name="notes"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Field observations, pipe integrity, meter reading, or reason for non-adoption..."
          />
        </label>

        <button className="button primary" disabled={busy} style={{ marginTop: '6px' }}>
          {busy ? 'Saving Verification…' : 'Save Verification'}
        </button>
      </form>
    </Modal>
  )
}

export default function AuditorContent({ request, notify, setError }) {
  const [audits, setAudits] = useState([])
  const [methods, setMethods] = useState([])
  const [editing, setEditing] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [busy, setBusy] = useState(true)

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const [a, m] = await Promise.all([
        request('/api/audits'),
        request('/api/agriculture/irrigation-methods')
      ])
      setAudits(a.data.audits || [])
      setMethods(m.data || [])
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { load() }, [])

  async function save(values) {
    try {
      const payload = {
        actual_irrigation_method_id: Number(values.actual_irrigation_method_id),
        adoption_status: values.adoption_status,
        audit_date: values.audit_date,
        notes: values.notes
      }
      if (editing.audit_id) {
        await request(`/api/audits/${editing.audit_id}`, { method: 'PUT', body: JSON.stringify(payload) })
      } else {
        await request('/api/audits', { method: 'POST', body: JSON.stringify({ ...payload, record_id: editing.record_id }) })
      }
      setEditing(null)
      await load()
      notify('Field audit verification saved successfully.')
    } catch (e) {
      setError(e.message)
    }
  }

  // Group plots/records by Farm
  const farmGroups = useMemo(() => {
    const q = search.toLowerCase().trim()
    const groupsMap = new Map()

    audits.forEach(audit => {
      // Filter matching
      const matchesSearch = !q ||
        audit.farm_name?.toLowerCase().includes(q) ||
        audit.village_name?.toLowerCase().includes(q) ||
        audit.crop_name?.toLowerCase().includes(q) ||
        audit.season_name?.toLowerCase().includes(q) ||
        audit.agricultural_year?.toLowerCase().includes(q)

      const matchesStatus = statusFilter === 'ALL' ||
        (statusFilter === 'ADOPTED' && audit.adoption_status === 'ADOPTED') ||
        (statusFilter === 'NOT_ADOPTED' && audit.adoption_status === 'NOT_ADOPTED') ||
        (statusFilter === 'PENDING' && (audit.adoption_status === 'PENDING' || audit.adoption_status === 'UNAUDITED' || !audit.adoption_status))

      if (!matchesSearch || !matchesStatus) return

      const farmKey = audit.farm_id || audit.farm_name
      if (!groupsMap.has(farmKey)) {
        groupsMap.set(farmKey, {
          farm_id: audit.farm_id,
          farm_name: audit.farm_name || `Farm #${audit.farm_id}`,
          village_name: audit.village_name || 'Assigned Village',
          district_name: audit.district_name || 'Assigned District',
          total_land_area_hectares: audit.total_land_area_hectares,
          plots: []
        })
      }
      groupsMap.get(farmKey).plots.push(audit)
    })

    return Array.from(groupsMap.values())
  }, [audits, search, statusFilter])

  const totalPlots = audits.length
  const adoptedCount = audits.filter(a => a.adoption_status === 'ADOPTED').length
  const pendingCount = audits.filter(a => a.adoption_status !== 'ADOPTED' && a.adoption_status !== 'NOT_ADOPTED').length

  return (
    <>
      <section className="summary">
        <Metric icon={<Building2 />} label="Assigned Farms" value={new Set(audits.map(a => a.farm_id)).size} />
        <Metric icon={<Sprout />} label="Total Crop Plots" value={totalPlots} />
        <Metric icon={<BadgeCheck />} label="Verified Adopted" value={adoptedCount} />
        <Metric icon={<Droplets />} label="Pending Audits" value={pendingCount} />
      </section>

      <section className="toolbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap' }}>
        <div>
          <p className="eyebrow">District Auditor Workspace</p>
          <h2>Field Verification by Farm</h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <input
              type="text"
              placeholder="Search farm, village, or crop..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', padding: '9px 12px', fontSize: '0.88rem' }}
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 'auto', padding: '9px 12px', fontSize: '0.88rem' }}
          >
            <option value="ALL">All Audit Statuses</option>
            <option value="PENDING">Pending Audits</option>
            <option value="ADOPTED">Verified Adopted</option>
            <option value="NOT_ADOPTED">Not Adopted</option>
          </select>
        </div>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
        {farmGroups.map(farm => {
          const farmAdopted = farm.plots.filter(p => p.adoption_status === 'ADOPTED').length
          const farmPending = farm.plots.filter(p => p.adoption_status !== 'ADOPTED' && p.adoption_status !== 'NOT_ADOPTED').length

          return (
            <section className="panel" key={farm.farm_id} style={{ padding: '0', overflow: 'hidden' }}>
              {/* Farm Group Header */}
              <div style={{
                padding: '16px 20px',
                background: 'linear-gradient(135deg, #f8faf7 0%, #f0f5ee 100%)',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    background: 'var(--green-pale)',
                    color: 'var(--green-dark)',
                    display: 'grid',
                    placeItems: 'center'
                  }}>
                    <Building2 style={{ width: '20px', height: '20px' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: '0', fontSize: '1.15rem', color: 'var(--ink)' }}>{farm.farm_name}</h3>
                    <p className="muted" style={{ margin: '2px 0 0', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin style={{ width: '13px', height: '13px' }} />
                      {farm.village_name} · {farm.district_name}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span className="status muted" style={{ fontSize: '0.74rem' }}>
                    {farm.plots.length} {farm.plots.length === 1 ? 'Plot' : 'Plots'}
                  </span>
                  {farmAdopted > 0 && (
                    <span className="status good" style={{ fontSize: '0.74rem' }}>
                      {farmAdopted} Adopted
                    </span>
                  )}
                  {farmPending > 0 && (
                    <span className="status warn" style={{ fontSize: '0.74rem' }}>
                      {farmPending} Pending
                    </span>
                  )}
                </div>
              </div>

              {/* Plots Table for this Farm */}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Crop</th>
                      <th>Season</th>
                      <th>Year</th>
                      <th>Plot Area</th>
                      <th>Reported Irrigation</th>
                      <th>Verified Irrigation</th>
                      <th>Status</th>
                      <th>Audit Date</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {farm.plots.map(plot => (
                      <tr key={plot.audit_id || plot.record_id}>
                        <td><strong>{plot.crop_name}</strong></td>
                        <td>{plot.season_name}</td>
                        <td>{plot.agricultural_year}</td>
                        <td>{plot.cultivated_area_hectares ? `${plot.cultivated_area_hectares} ha` : '—'}</td>
                        <td>{plot.current_irrigation_method_name || '—'}</td>
                        <td>{plot.actual_irrigation_method_name || '—'}</td>
                        <td><Status value={plot.adoption_status} /></td>
                        <td>{plot.audit_date ? String(plot.audit_date).slice(0, 10) : '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="button small primary"
                            onClick={() => setEditing(plot)}
                          >
                            {plot.audit_id ? 'Update Audit' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}

        {!farmGroups.length && !busy && (
          <section className="empty">
            <Building2 />
            <h2>No farm records found</h2>
            <p>No farms or crop plots match your filter in your assigned district.</p>
          </section>
        )}
      </div>

      {editing && (
        <AuditForm
          audit={editing}
          methods={methods}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}
    </>
  )
}
