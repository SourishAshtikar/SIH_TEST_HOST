import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { BarChart3, Layers3, RefreshCw } from 'lucide-react'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const categoryColor = (value) => ({ Safe: '#dbeafe', 'Semi Critical': '#2563eb', Critical: '#facc15', 'Over Exploited': '#dc2626' }[value] || '#64748b')
const dtwColor = (value) => value == null ? '#64748b' : value < 5 ? '#38bdf8' : value < 10 ? '#4ade80' : value < 20 ? '#facc15' : value < 40 ? '#fb923c' : '#f87171'
const esc = (value) => String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

export default function AssessmentExplorer({ request, setError, hideHeader = false }) {
  const el = useRef(null); const map = useRef(null); const thematic = useRef(null); const baseLayers = useRef(null)
  const [scope, setScope] = useState('district'); const [mode, setMode] = useState('category'); const [years, setYears] = useState([]); const [year, setYear] = useState('2025-2026'); const [data, setData] = useState([]); const [details, setDetails] = useState(null); const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!el.current || map.current) return undefined
    const instance = L.map(el.current, { center: [29.15, 76.3], zoom: 8, scrollWheelZoom: false })
    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap contributors' })
    const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 18, attribution: 'Tiles © Esri' })
    satellite.addTo(instance); baseLayers.current = L.control.layers({ Satellite: satellite, Streets: street }, null, { position: 'topright' }).addTo(instance); map.current = instance
    return () => { instance.remove(); map.current = null }
  }, [])
  useEffect(() => { request('/api/groundwater-assessments/years').then(r => { const next = (r.data.years || []).sort().reverse(); setYears(next); if (next.length) setYear(current => next.includes(current) ? current : next[0]) }).catch(err => setError(err.message)) }, [request, setError])
  useEffect(() => { if (year) load() }, [scope, mode, year])

  async function load() {
    setBusy(true); setError('')
    try {
      const assessment = await request(`/api/groundwater-assessments?year=${encodeURIComponent(year)}&scope=${scope}`)
      const rows = assessment.data || []; setData(rows)
      const geometryFile = scope === 'district' ? 'haryana_districts.geojson' : 'haryana_villages.geojson'
      const geo = await fetch(`${API}/${geometryFile}`).then(response => { if (!response.ok) throw new Error(`Could not load ${geometryFile}`); return response.json() })
      render(geo, rows)
      const state = await request(`/api/groundwater-assessments/details?scope=state&year=${encodeURIComponent(year)}`)
      setDetails(state.data)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  function matchRecord(feature, rows) {
    const properties = feature.properties || {}
    const name = String(scope === 'district' ? properties.NAME_2 : properties.NAME || '').trim().toLowerCase()
    const district = String(properties.DISTRICT || '').trim().toLowerCase()
    const block = String(properties.BLOCK || '').trim().toLowerCase()
    return rows.find(row => String(scope === 'district' ? row.district_name : row.village_name).trim().toLowerCase() === name) || (scope === 'village' && rows.find(row => String(row.village_name).trim().toLowerCase() === block)) || (scope === 'village' && rows.find(row => String(row.district_name).trim().toLowerCase() === district))
  }

  function render(geo, rows) {
    if (!map.current) return
    if (thematic.current) map.current.removeLayer(thematic.current)
    const layer = L.geoJSON(geo, {
      style: feature => { const record = matchRecord(feature, rows); return { fillColor: mode === 'dtw' ? dtwColor(record?.dtw_m_bgl) : categoryColor(record?.category), fillOpacity: .8, color: '#32483a', weight: scope === 'district' ? 1.2 : .55 } },
      onEachFeature: (feature, polygon) => {
        const record = matchRecord(feature, rows); const properties = feature.properties || {}; const name = scope === 'district' ? properties.NAME_2 : properties.NAME || 'Village'
        polygon.bindTooltip(`<strong>${esc(name)}</strong><br>${mode === 'dtw' ? `Depth to water: ${record?.dtw_m_bgl ?? 'No data'} m bgl` : `Groundwater category: ${esc(record?.category || 'No data')}`}`, { sticky: true })
        polygon.on('mouseover', () => polygon.setStyle({ weight: 2.6, color: '#173d28', fillOpacity: .94 }))
        polygon.on('mouseout', () => layer.resetStyle(polygon))
        polygon.on('click', () => { map.current.fitBounds(polygon.getBounds(), { padding: [24, 24] }); if (record) inspect(scope, scope === 'district' ? record.district_id : record.village_id) })
      }
    }).addTo(map.current)
    thematic.current = layer
    try { map.current.fitBounds(layer.getBounds(), { padding: [18, 18], maxZoom: scope === 'district' ? 9 : 11 }) } catch { /* empty layer */ }
  }

  async function inspect(nextScope, id) { try { const response = await request(`/api/groundwater-assessments/details?scope=${nextScope}&id=${id}&year=${encodeURIComponent(year)}`); setDetails(response.data) } catch (err) { setError(err.message) } }
  const counts = data.reduce((result, record) => { const key = mode === 'dtw' ? (record.dtw_m_bgl < 5 ? 'Shallow' : record.dtw_m_bgl < 10 ? '5–10 m' : record.dtw_m_bgl < 20 ? '10–20 m' : record.dtw_m_bgl < 40 ? '20–40 m' : 'Deep') : record.category || 'No data'; result[key] = (result[key] || 0) + 1; return result }, {})
  return <section className={`assessment-explorer ${hideHeader ? 'embedded-map' : 'panel'}`}>{!hideHeader && (<><header><div><p className="eyebrow">GIS assessment explorer</p><h2><Layers3 /> Haryana groundwater layers</h2></div><button className="button small" onClick={load} disabled={busy}><RefreshCw />{busy ? 'Loading…' : 'Refresh'}</button></header><p className="muted">Polygon boundaries, category and DTW layers, satellite/street basemaps, hover highlights, and click-to-inspect metrics.</p><div className="assessment-controls"><label>Layer<select value={mode} onChange={e => setMode(e.target.value)}><option value="category">Category & resources</option><option value="dtw">Depth to water (DTW)</option></select></label><label>Boundary scope<select value={scope} onChange={e => setScope(e.target.value)}><option value="district">District polygons</option><option value="village">Village polygons</option></select></label><label>Assessment year<select value={year} onChange={e => setYear(e.target.value)}>{years.map(item => <option key={item}>{item}</option>)}</select></label></div><div className="assessment-summary">{Object.entries(counts).map(([name, count]) => <span key={name}>{name}<strong>{count}</strong></span>)}</div></>)}<div className="assessment-layout"><div className="assessment-map" ref={el} /><aside className="assessment-inspector"><p className="eyebrow">Selected area</p><h3>{details?.focusName || 'Haryana'}</h3><span className="status muted">{details?.is_predicted ? 'AI predicted' : 'Historical assessment'}</span><dl><div><dt>Category</dt><dd>{details?.category || 'State aggregate'}</dd></div><div><dt>Depth to water</dt><dd>{details?.dtw_m_bgl == null ? '—' : `${Number(details.dtw_m_bgl).toFixed(2)} m bgl`}</dd></div><div><dt>Extraction stage</dt><dd>{details?.stage_of_extraction_pct == null ? '—' : `${Number(details.stage_of_extraction_pct).toFixed(1)}%`}</dd></div><div><dt>Recharge</dt><dd>{details?.recharge_bcm == null ? '—' : `${Number(details.recharge_bcm).toFixed(2)} BCM`}</dd></div><div><dt>Extraction</dt><dd>{details?.extraction_all_uses_bcm == null ? '—' : `${Number(details.extraction_all_uses_bcm).toFixed(2)} BCM`}</dd></div><div><dt>Rainfall</dt><dd>{details?.rainfall_mm == null ? '—' : `${Number(details.rainfall_mm).toFixed(1)} mm`}</dd></div></dl><BarChart3 /><small>Click a boundary to inspect its assessment.</small></aside></div><div className="map-legend"><strong>{mode === 'dtw' ? 'DTW legend' : 'Category legend'}</strong>{mode === 'dtw' ? <span><i className="c1" />Shallow {'<'} 5 m <i className="c2" />5–10 m <i className="c3" />10–20 m <i className="c4" />20–40 m <i className="c5" />Deep</span> : <span><i className="safe" />Safe <i className="semi" />Semi-critical <i className="critical" />Critical <i className="over" />Over-exploited</span>}</div></section>
}
