import { useEffect, useMemo, useState } from 'react'
import { Award, BarChart2, Search } from 'lucide-react'
import { DataTable } from '../common/CommonUI'
import SustainabilityScoreModal from '../common/SustainabilityScoreModal'

export default function SustainabilityRankingTable({ request, setError }) {
  const [scores, setScores] = useState([])
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(true)
  const [selectedScore, setSelectedScore] = useState(null)

  const load = () => {
    setBusy(true)
    setError('')
    request('/api/sustainability-scores')
      .then(res => setScores(res.data?.scores || []))
      .catch(err => setError(err.message))
      .finally(() => setBusy(false))
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return scores
    const q = search.toLowerCase()
    return scores.filter(s =>
      s.farm_name?.toLowerCase().includes(q) ||
      s.village_name?.toLowerCase().includes(q) ||
      s.district_name?.toLowerCase().includes(q) ||
      s.season_name?.toLowerCase().includes(q) ||
      s.priority?.toLowerCase().includes(q)
    )
  }, [scores, search])

  return (
    <>
      <section className="toolbar">
        <div>
          <p className="eyebrow">Performance & Intervention Priority</p>
          <h2>Seasonal Sustainability Scores & Ranking</h2>
        </div>
      </section>

      <div className="schemes-search-bar">
        <input
          type="text"
          placeholder="Filter by farm name, village, district, season, or priority..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <DataTable
        headers={['Rank', 'Farm', 'Village', 'District', 'Season', 'Score', 'Priority', 'Action']}
        rows={filtered.map((s, idx) => {
          const pClass = s.priority === 'HIGH' ? 'score-pill good' : s.priority === 'MEDIUM' ? 'score-pill warn' : 'score-pill bad'
          return [
            `#${idx + 1}`,
            <strong>{s.farm_name || `Farm #${s.farm_id}`}</strong>,
            s.village_name || '—',
            s.district_name || 'Karnal',
            `${s.season_name || `Season ${s.season_id}`} (${s.agricultural_year})`,
            <strong key={`sc-${idx}`}>{s.sustainability_score} / 100</strong>,
            <span key={`p-${idx}`} className={pClass}>{s.priority}</span>,
            <button
              key={`btn-${idx}`}
              type="button"
              className="button small ghost"
              onClick={() => setSelectedScore(s)}
            >
              50/30/20 Breakdown
            </button>
          ]
        })}
        empty={busy ? 'Loading sustainability scores...' : 'No seasonal sustainability scores recorded yet. Scores calculate as farm records and audits are logged.'}
      />

      {selectedScore && (
        <SustainabilityScoreModal
          scoreData={selectedScore}
          onClose={() => setSelectedScore(null)}
        />
      )}
    </>
  )
}
