import { useEffect, useState } from 'react'
import { Droplets, Sparkles, Sprout } from 'lucide-react'
import SearchableSelect from '../common/SearchableSelect'
import { DEFAULT_RECOMMENDATION_OPTIONS } from '../../constants/recommendations'

export default function GeneralRecommendationWorkspace({ request, setError, user }) {
  const [cropName, setCropName] = useState('Paddy / Rice (धान / जीरी)')
  const [currentPractice, setCurrentPractice] = useState('Flood Irrigation (पारंपरिक बहाव)')
  const [reference, setReference] = useState(DEFAULT_RECOMMENDATION_OPTIONS)
  const [report, setReport] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    request('/api/reference/recommendation-options')
      .then(result => {
        if (result?.data?.crops?.length) setReference(result.data)
      })
      .catch(() => {})
  }, [request])

  async function generate(e) {
    e.preventDefault()
    setBusy(true)
    setReport(null)
    setError('')
    try {
      const result = await request('/api/recommendations', {
        method: 'POST',
        body: JSON.stringify({
          villageId: user.village_id || 1,
          cropName,
          currentPractice
        })
      })
      setReport(result.data)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const diagnostics = report?.diagnostics

  return (
    <div className="general-advisory-container">
      <section className="panel advisory-form-card">
        <header>
          <div>
            <p className="eyebrow">Interactive Advisory</p>
            <h2>Simulation parameters</h2>
          </div>
        </header>
        <p className="muted">
          Select any crop and current irrigation method to evaluate water efficiency and agronomic suitability for{' '}
          <strong>{user.village_name || 'your assigned area'}</strong>.
        </p>

        <form className="stack" onSubmit={generate}>
          <SearchableSelect
            label="Crop selection"
            value={cropName}
            onChange={(val, item) => setCropName(item?.label || val)}
            options={reference.crops}
            placeholder="Search crop by name, season..."
            icon={<Sprout />}
          />

          <SearchableSelect
            label="Current irrigation practice"
            value={currentPractice}
            onChange={(val, item) => setCurrentPractice(item?.label || val)}
            options={reference.irrigationPractices}
            placeholder="Search irrigation method..."
            icon={<Droplets />}
          />

          <button className="button primary" disabled={busy}>
            {busy ? 'Running AI simulation…' : 'Generate AI recommendation'}
          </button>
        </form>
      </section>

      <section className="panel advisory-result-card">
        <header>
          <div>
            <p className="eyebrow">AI Evaluation & Agronomic Decision</p>
            <h2>Recommendation report</h2>
          </div>
        </header>

        {busy && (
          <div className="empty">
            <Sparkles />
            <h2>Evaluating agronomic factors…</h2>
            <p>Computing FAO-56 crop coefficients, soil water retention, and regional groundwater drawdown.</p>
          </div>
        )}

        {!busy && !report && (
          <div className="empty">
            <Sparkles />
            <h2>No active simulation</h2>
            <p>Select your crop and irrigation method, then click "Generate AI recommendation".</p>
          </div>
        )}

        {report && (
          <>
            <div className="advisory-hero">
              <div className="advisory-hero-header">
                <span className={`status ${report.actionRequired === 'MAINTAIN_CURRENT_PRACTICE' ? 'good' : report.actionRequired === 'HIGH_PRIORITY_UPGRADE' ? 'warn' : 'good'}`}>
                  {report.actionRequired?.replaceAll('_', ' ')}
                </span>
                <span className="advisory-practice-title">{report.recommendedPractice?.name}</span>
              </div>
              <p className="muted">{report.recommendedPractice?.description || 'Optimal irrigation practice evaluated for local soil and hydrological conditions.'}</p>
            </div>

            <dl className="advisory-metrics-grid">
              <div className="advisory-stat-card">
                <dt>Water Savings</dt>
                <dd className="highlight">{report.waterSavingsPercentage ?? '—'}%</dd>
              </div>
              <div className="advisory-stat-card">
                <dt>Conserved Volume</dt>
                <dd className="highlight">{(report.waterSavedVolumeM3PerHa ?? report.estimatedWaterSavedM3PerHa ?? 0).toLocaleString()} m³/ha</dd>
              </div>
              <div className="advisory-stat-card">
                <dt>AI Confidence</dt>
                <dd>{report.confidenceScore ?? '—'}%</dd>
              </div>
              <div className="advisory-stat-card">
                <dt>Groundwater Depth</dt>
                <dd>{diagnostics?.groundwaterLevelMeters ? `${Number(diagnostics.groundwaterLevelMeters).toFixed(1)} m` : '—'}</dd>
              </div>
            </dl>

            {report.reasons?.length > 0 && (
              <div className="reasons-box">
                <h4><Sparkles /> Scientific & Agronomic Justification</h4>
                <ul className="reasons-list">
                  {report.reasons.map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}

            {report.allTechniqueScores?.length > 0 && (
              <div>
                <h3>Technique Suitability Ranking</h3>
                <table className="technique-score-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Technique</th>
                      <th>Efficiency</th>
                      <th>Water Savings</th>
                      <th>Conserved Volume</th>
                      <th>Suitability Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.allTechniqueScores.map((t, idx) => (
                      <tr key={t.id} className={idx === 0 ? 'top-pick' : ''}>
                        <td>#{idx + 1}</td>
                        <td>{t.name}</td>
                        <td>{t.efficiency || 'Standard'}</td>
                        <td>{t.waterSavingsPercentage}%</td>
                        <td>{(t.waterSavedVolumeM3PerHa || 0).toLocaleString()} m³/ha</td>
                        <td><strong>{t.score}/100</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
