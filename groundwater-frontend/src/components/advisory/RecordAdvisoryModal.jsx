import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Modal } from '../common/CommonUI'

export default function RecordAdvisoryModal({ record, user, request, onClose }) {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!record) return
    setLoading(true)
    setError('')
    request('/api/recommendations', {
      method: 'POST',
      body: JSON.stringify({
        villageId: user.village_id || 1,
        cropName: record.crop_name,
        currentPractice: record.current_irrigation_method_name
      })
    })
      .then(res => setReport(res.data))
      .catch(err => setError(err.message || 'Failed to generate advisory'))
      .finally(() => setLoading(false))
  }, [record, user.village_id])

  const waterSavedHa = report?.waterSavedVolumeM3PerHa || report?.estimatedWaterSavedM3PerHa || 0
  const areaHa = Number(record.cultivated_area_hectares) || 1
  const totalFarmSavings = Math.round(waterSavedHa * areaHa)
  const isMaintain = report?.actionRequired === 'MAINTAIN_CURRENT_PRACTICE'

  return (
    <Modal title={`AI Irrigation Advisory: ${record.crop_name}`} onClose={onClose}>
      <div className="record-meta-bar">
        <div className="record-meta-item">
          <span>Crop:</span>
          <strong>{record.crop_name}</strong>
        </div>
        <div className="record-meta-item">
          <span>Season:</span>
          <strong>{record.season_name} ({record.agricultural_year})</strong>
        </div>
        <div className="record-meta-item">
          <span>Current:</span>
          <strong>{record.current_irrigation_method_name}</strong>
        </div>
        <div className="record-meta-item">
          <span>Plot Area:</span>
          <strong>{record.cultivated_area_hectares} ha</strong>
        </div>
      </div>

      {loading && <p className="muted">Analyzing soil hydrology, crop water requirements, and local groundwater metrics…</p>}
      {error && <p className="error">{error}</p>}

      {report && (
        <div className="advisory-result-card">
          <div className="advisory-hero">
            <div className="advisory-hero-header">
              <span className={`status ${isMaintain ? 'good' : report.actionRequired === 'HIGH_PRIORITY_UPGRADE' ? 'warn' : 'good'}`}>
                {report.actionRequired?.replaceAll('_', ' ')}
              </span>
              <span className="advisory-practice-title">{report.recommendedPractice?.name}</span>
            </div>
            <p className="muted">
              {isMaintain
                ? 'Your farm is already utilizing an optimal water-saving technique for this crop. Continue this practice to maintain groundwater conservation.'
                : report.recommendedPractice?.description || 'Optimal irrigation practice evaluated for local soil and hydrological conditions.'}
            </p>
          </div>

          <dl className="advisory-metrics-grid">
            <div className="advisory-stat-card">
              <dt>{isMaintain ? 'Efficiency Savings' : 'Potential Water Savings'}</dt>
              <dd className="highlight">{report.waterSavingsPercentage ?? '—'}%</dd>
            </div>
            <div className="advisory-stat-card">
              <dt>{isMaintain ? 'Total Plot Conserved' : 'Potential Plot Savings'}</dt>
              <dd className="highlight">{totalFarmSavings.toLocaleString()} m³</dd>
            </div>
            <div className="advisory-stat-card">
              <dt>AI Confidence</dt>
              <dd>{report.confidenceScore ?? '—'}%</dd>
            </div>
            <div className="advisory-stat-card">
              <dt>Groundwater Depth</dt>
              <dd>{report.diagnostics?.groundwaterLevelMeters ? `${Number(report.diagnostics.groundwaterLevelMeters).toFixed(1)} m` : '—'}</dd>
            </div>
          </dl>

          <p className="muted" style={{ fontSize: '0.78rem', margin: '2px 0 10px', color: 'var(--muted)' }}>
            * Calculation: {report.waterSavingsPercentage}% savings on {record.crop_name} ({waterSavedHa.toLocaleString()} m³/ha) × {areaHa} ha = {totalFarmSavings.toLocaleString()} m³ conserved vs conventional flood irrigation.
          </p>

          {report.reasons?.length > 0 && (
            <div className="reasons-box">
              <h4><Sparkles /> Agronomic & Hydrological Insights</h4>
              <ul className="reasons-list">
                {report.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
