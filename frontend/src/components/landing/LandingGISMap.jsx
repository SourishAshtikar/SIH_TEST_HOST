import { lazy, Suspense, useState } from 'react'
import '../../decision-support.css'

const AssessmentExplorer = lazy(() => import('../../AssessmentExplorer'))

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const defaultRequest = async (url) => {
  const res = await fetch(`${API}${url}`)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.message || 'Failed to fetch GIS data')
  }
  return res.json()
}

export default function LandingGISMap({ request }) {
  const [error, setError] = useState('')
  const activeRequest = request || defaultRequest

  return (
    <div className="js-hero-map-wrapper">
      {error && (
        <div style={{ color: '#a43e2e', fontSize: '0.82rem', padding: '8px 12px', background: '#f7e3de', borderRadius: '8px', marginBottom: '12px' }}>
          {error}
        </div>
      )}
      <Suspense fallback={<p style={{ color: '#64715f', fontSize: '0.9rem', padding: '24px', textAlign: 'center' }}>Loading GIS Groundwater Maps…</p>}>
        <AssessmentExplorer request={activeRequest} setError={setError} hideHeader={true} />
      </Suspense>
    </div>
  )
}
