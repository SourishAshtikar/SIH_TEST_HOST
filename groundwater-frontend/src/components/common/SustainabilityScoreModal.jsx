import { Award, CheckCircle2, ShieldCheck, TrendingUp, X } from 'lucide-react'
import { Modal } from './CommonUI'

export default function SustainabilityScoreModal({ scoreData, onClose }) {
  if (!scoreData) return null

  const score = scoreData.sustainability_score ?? 0
  const priority = scoreData.priority || 'LOW'
  const priorityClass = priority === 'HIGH' ? 'good' : priority === 'MEDIUM' ? 'warn' : 'bad'

  const adoptionPts = scoreData.scores?.adoption ?? 0
  const continuedPts = scoreData.scores?.continued_adoption ?? 0
  const auditPts = scoreData.scores?.audit ?? 0

  return (
    <Modal title="Seasonal Sustainability Score Breakdown" onClose={onClose}>
      <div className="score-modal-hero">
        <div className="score-main-display">
          <div className="score-number-wrap">
            <span className="score-value">{score}</span>
            <span className="score-max">/ 100</span>
          </div>
          <div>
            <span className={`status ${priorityClass}`} style={{ fontSize: '0.78rem', padding: '4px 12px' }}>
              {priority} INTERVENTION PRIORITY
            </span>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: '0.86rem' }}>
              {scoreData.farm_name || `Farm #${scoreData.farm_id}`} · {scoreData.season_name || `Season ${scoreData.season_id}`} ({scoreData.agricultural_year})
            </p>
          </div>
        </div>
      </div>

      <div className="score-breakdown-stack">
        <h4 style={{ margin: '0 0 4px', fontSize: '0.92rem', color: 'var(--ink)' }}>
          50 / 30 / 20 Evaluation Metric Breakdown
        </h4>

        {/* 1. Adoption (Max 50) */}
        <div className="score-metric-card">
          <div className="metric-header">
            <div className="metric-title-group">
              <span className="metric-icon-badge" style={{ background: '#e4efe3', color: 'var(--green)' }}>
                <Award style={{ width: 16, height: 16 }} />
              </span>
              <div>
                <strong>Water-Saving Practice Adoption</strong>
                <small className="muted" style={{ display: 'block' }}>Efficiency of deployed irrigation method</small>
              </div>
            </div>
            <strong className="metric-pts">{adoptionPts} / 50 pts</strong>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(adoptionPts / 50) * 100}%`, background: 'var(--green)' }} />
          </div>
        </div>

        {/* 2. Continued Adoption (Max 30) */}
        <div className="score-metric-card">
          <div className="metric-header">
            <div className="metric-title-group">
              <span className="metric-icon-badge" style={{ background: '#e0f2fe', color: '#0369a1' }}>
                <TrendingUp style={{ width: 16, height: 16 }} />
              </span>
              <div>
                <strong>Historical Adoption Consistency</strong>
                <small className="muted" style={{ display: 'block' }}>Consecutive seasons of sustainable practice</small>
              </div>
            </div>
            <strong className="metric-pts">{continuedPts} / 30 pts</strong>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(continuedPts / 30) * 100}%`, background: '#0284c7' }} />
          </div>
        </div>

        {/* 3. Physical Audit Verification (Max 20) */}
        <div className="score-metric-card">
          <div className="metric-header">
            <div className="metric-title-group">
              <span className="metric-icon-badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                <ShieldCheck style={{ width: 16, height: 16 }} />
              </span>
              <div>
                <strong>Physical Field Audit Verification</strong>
                <small className="muted" style={{ display: 'block' }}>Independent on-site inspection result</small>
              </div>
            </div>
            <strong className="metric-pts">{auditPts} / 20 pts</strong>
          </div>
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{ width: `${(auditPts / 20) * 100}%`, background: '#f59e0b' }} />
          </div>
        </div>
      </div>
    </Modal>
  )
}
