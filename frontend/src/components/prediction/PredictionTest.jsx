import { useEffect, useMemo, useState } from 'react'
import { Bot, CheckCircle2, Droplets, MapPin, Sparkles } from 'lucide-react'
import SearchableSelect from '../common/SearchableSelect'
import { ApiError } from '../common/CommonUI'

export default function PredictionTest({ request, setError }) {
  const [locations, setLocations] = useState([])
  const [selectedStation, setSelectedStation] = useState('')
  const [form, setForm] = useState({
    District: '',
    Tehsil: '',
    Block: '',
    Station: '',
    Latitude: '',
    Longitude: '',
    Year: new Date().getFullYear(),
    Month: new Date().getMonth() + 1
  })
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    request('/api/geography/villages')
      .then(response => {
        const list = response.data || []
        setLocations(list)
        if (list.length > 0 && !selectedStation) {
          const first = list[0]
          const stationName = first.station_name || first.name
          setSelectedStation(stationName)
          setForm({
            District: first.district_name || '',
            Tehsil: first.tehsil || '',
            Block: first.block || first.tehsil || '',
            Station: stationName,
            Latitude: first.latitude || '',
            Longitude: first.longitude || '',
            Year: new Date().getFullYear(),
            Month: new Date().getMonth() + 1
          })
        }
      })
      .catch(err => setError(err.message))
  }, [request, setError])

  const stationOptions = useMemo(() => {
    return locations.map(loc => ({
      value: loc.station_name || loc.name,
      label: loc.station_name || loc.name,
      sublabel: `${loc.tehsil || loc.block || 'Tehsil'} · (${Number(loc.latitude).toFixed(3)}, ${Number(loc.longitude).toFixed(3)})`,
      badge: loc.district_name || 'District'
    }))
  }, [locations])

  function handleStationSelect(stationName) {
    setSelectedStation(stationName)
    const loc = locations.find(
      l => (l.station_name || l.name)?.toLowerCase() === stationName.toLowerCase()
    )
    if (loc) {
      setForm(prev => ({
        ...prev,
        Station: loc.station_name || loc.name,
        District: loc.district_name || prev.District,
        Tehsil: loc.tehsil || prev.Tehsil,
        Block: loc.block || loc.tehsil || prev.Block,
        Latitude: loc.latitude,
        Longitude: loc.longitude
      }))
    } else {
      setForm(prev => ({ ...prev, Station: stationName }))
    }
  }

  function handleChange(name, value) {
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setResult(null)
    setLocalError('')
    if (setError) setError('')

    try {
      const payload = {
        District: form.District,
        Tehsil: form.Tehsil,
        Block: form.Block,
        Station: form.Station,
        Latitude: parseFloat(form.Latitude),
        Longitude: parseFloat(form.Longitude),
        Year: parseInt(form.Year, 10),
        Month: parseInt(form.Month, 10)
      }

      const response = await request('/api/ml/predict', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      // Fix: Support both response structures returned by backend & microservices
      const predictedVal = response.predicted_gwl_meters ?? 
        response.data?.predicted_gwl_meters ?? 
        response.data?.predicted_groundwater_level_m_bgl ?? 
        response.predicted_groundwater_level_m_bgl ??
        response.data?.predicted_level;

      if (predictedVal !== undefined && predictedVal !== null) {
        setResult(Number(predictedVal))
      } else {
        throw new Error('Prediction result was empty or malformed')
      }
    } catch (err) {
      setLocalError(err.message || 'Failed to generate ML prediction')
      if (setError) setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const depthVal = result !== null ? Number(result) : null
  const statusTone = depthVal !== null ? (depthVal > 20 ? 'Critical (Severe Drawdown)' : depthVal > 10 ? 'Semi-Critical (Moderate)' : 'Safe (High Availability)') : ''
  const statusClass = depthVal !== null ? (depthVal > 20 ? 'bad' : depthVal > 10 ? 'warn' : 'good') : ''

  return (
    <section className="panel compact-panel">
      <header>
        <div>
          <Bot />
          <h2>ML Groundwater Depth Prediction</h2>
        </div>
      </header>
      <p className="muted">
        Select a monitoring station or village to auto-fill geospatial coordinates, then run live machine learning predictions.
      </p>

      <ApiError message={localError} onDismiss={() => setLocalError('')} />

      <form className="compact-form" onSubmit={submit}>
        <div style={{ gridColumn: '1 / -1' }}>
          <SearchableSelect
            label="Monitoring Station / Village"
            value={selectedStation}
            onChange={handleStationSelect}
            options={stationOptions}
            placeholder="Search monitoring station or village..."
            icon={<MapPin />}
          />
        </div>

        <label>
          District
          <input
            value={form.District}
            onChange={e => handleChange('District', e.target.value)}
            placeholder="e.g. Karnal"
            required
          />
        </label>

        <label>
          Tehsil
          <input
            value={form.Tehsil}
            onChange={e => handleChange('Tehsil', e.target.value)}
            placeholder="e.g. Gharaunda"
            required
          />
        </label>

        <label>
          Block
          <input
            value={form.Block}
            onChange={e => handleChange('Block', e.target.value)}
            placeholder="e.g. Gharaunda"
            required
          />
        </label>

        <label>
          Station Name
          <input
            value={form.Station}
            onChange={e => handleChange('Station', e.target.value)}
            placeholder="e.g. Gharaunda-Pz"
            required
          />
        </label>

        <label>
          Latitude
          <input
            type="number"
            step="any"
            value={form.Latitude}
            onChange={e => handleChange('Latitude', e.target.value)}
            required
          />
        </label>

        <label>
          Longitude
          <input
            type="number"
            step="any"
            value={form.Longitude}
            onChange={e => handleChange('Longitude', e.target.value)}
            required
          />
        </label>

        <label>
          Year
          <input
            type="number"
            min="2000"
            max="2100"
            value={form.Year}
            onChange={e => handleChange('Year', e.target.value)}
            required
          />
        </label>

        <label>
          Month
          <input
            type="number"
            min="1"
            max="12"
            value={form.Month}
            onChange={e => handleChange('Month', e.target.value)}
            required
          />
        </label>

        <div style={{ gridColumn: '1 / -1', marginTop: '6px' }}>
          <button className="button primary" disabled={busy} style={{ width: '100%', justifyContent: 'center' }}>
            {busy ? 'Running ML Inference…' : 'Run Prediction'}
          </button>
        </div>
      </form>

      {result !== null && (
        <div className="prediction-result" style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--green-dark)' }}>
              <Sparkles style={{ width: 18, height: 18 }} /> ML Inference Result
            </span>
            <span className={`status ${statusClass}`}>{statusTone}</span>
          </div>

          <div style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--ink)', fontFamily: 'IBM Plex Mono, monospace' }}>
            {depthVal.toFixed(2)} <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--muted)' }}>meters below ground level (m bgl)</span>
          </div>

          <div style={{ marginTop: '10px', fontSize: '0.82rem', color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <span><strong>Station:</strong> {form.Station}</span>
            <span><strong>Location:</strong> {form.Tehsil}, {form.District}</span>
            <span><strong>Target Period:</strong> {form.Month}/{form.Year}</span>
            <span><strong>Coordinates:</strong> {Number(form.Latitude).toFixed(4)}°N, {Number(form.Longitude).toFixed(4)}°E</span>
          </div>
        </div>
      )}
    </section>
  )
}
