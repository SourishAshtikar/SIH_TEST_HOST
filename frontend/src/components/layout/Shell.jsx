import { useEffect, useMemo, useState, lazy, Suspense } from 'react'
import { Award, BadgeCheck, Bot, Building2, Droplets, Leaf, LogOut, Map, MapPin, ShieldCheck } from 'lucide-react'
import { ApiError } from '../common/CommonUI'
import VillageHeadContent from '../farms/VillageHeadContent'
import GeneralRecommendationWorkspace from '../advisory/GeneralRecommendationWorkspace'
import VillageHeadSchemes from '../schemes/VillageHeadSchemes'
import AdminContent from '../schemes/AdminContent'
import SustainabilityRankingTable from '../admin/SustainabilityRankingTable'
import AuditorContent from '../audits/AuditorContent'
import PredictionTest from '../prediction/PredictionTest'

// Code-split heavy Leaflet GIS map component on demand
const AssessmentExplorer = lazy(() => import('../../AssessmentExplorer.jsx'))

export default function Shell({ user, initialTab, onLogout, onGoToLanding, notify, request, error, setError, toast }) {
  const roleLabel = user.role.replaceAll('_', ' ')

  // Define tab navigation per user role
  const tabs = useMemo(() => {
    if (user.role === 'ADMIN') {
      return [
        { id: 'schemes', label: 'Scheme Catalogue', icon: <Building2 /> },
        { id: 'scores', label: 'Sustainability Scores', icon: <Award /> },
        { id: 'ml', label: 'ML Microservice', icon: <Bot /> },
        { id: 'maps', label: 'Groundwater Maps', icon: <Map /> }
      ]
    }
    if (user.role === 'AUDITOR') {
      return [
        { id: 'verification', label: 'Audit Field Logs', icon: <ShieldCheck /> },
        { id: 'maps', label: 'Groundwater Maps', icon: <Map /> }
      ]
    }
    if (user.role === 'GOVERNMENT_EMPLOYEE') {
      return [
        { id: 'schemes', label: 'Govt Schemes', icon: <Building2 /> },
        { id: 'maps', label: 'Groundwater Maps', icon: <Map /> }
      ]
    }
    // VILLAGE_HEAD & fallback
    return [
      { id: 'farms', label: 'Farm Register', icon: <Leaf /> },
      { id: 'recommendations', label: 'Irrigation Advisory', icon: <Droplets /> },
      { id: 'schemes', label: 'Subsidies & Schemes', icon: <BadgeCheck /> },
      { id: 'maps', label: 'Groundwater Maps', icon: <Map /> }
    ]
  }, [user.role])

  const [activeTab, setActiveTab] = useState(() => (initialTab && tabs.some(t => t.id === initialTab)) ? initialTab : (tabs[0]?.id || 'farms'))

  useEffect(() => {
    if (initialTab && tabs.some(t => t.id === initialTab)) {
      setActiveTab(initialTab)
    }
  }, [initialTab, tabs])

  useEffect(() => {
    if (tabs.length && !tabs.some(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id)
    }
  }, [tabs, activeTab])

  const activeTabMeta = tabs.find(t => t.id === activeTab) || tabs[0]

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div
          className="brand"
          onClick={onGoToLanding}
          style={{ cursor: 'pointer' }}
          title="Return to JalSaarthi Landing Page"
        >
          <span className="brand-mark"><Droplets /></span>
          <div>
            <strong>JalSaarthi</strong>
            <small>Groundwater Platform</small>
          </div>
        </div>

        <nav>
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setError('')
                setActiveTab(tab.id)
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
          <div className="nav-location">
            <MapPin />
            <span>{user.village_name || user.district_name || 'Haryana'}</span>
          </div>
        </nav>

        <div className="sidebar-foot">
          <span className="role-pill"><ShieldCheck />{roleLabel}</span>
          <button className="nav-item logout" onClick={onLogout}><LogOut />Sign out</button>
        </div>
      </aside>

      <div className="content">
        <header className="top-header">
          <div>
            <p className="eyebrow">
              {user.village_name
                ? `Assigned village · ${user.village_name}`
                : user.district_name
                  ? `Assigned district · ${user.district_name}`
                  : `Platform administration · ${activeTabMeta?.label || ''}`}
            </p>
            <h1>Welcome, {user.name}</h1>
          </div>
          <div className="profile"><BadgeCheck /> {roleLabel}</div>
        </header>

        <ApiError message={error} onDismiss={() => setError('')} />

        {user.role === 'ADMIN' ? (
          activeTab === 'schemes' ? (
            <AdminContent request={request} notify={notify} setError={setError} />
          ) : activeTab === 'scores' ? (
            <SustainabilityRankingTable request={request} setError={setError} />
          ) : activeTab === 'ml' ? (
            <PredictionTest request={request} setError={setError} />
          ) : (
            <Suspense fallback={<section className="panel"><p className="muted">Loading GIS Groundwater Maps…</p></section>}>
              <AssessmentExplorer request={request} setError={setError} />
            </Suspense>
          )
        ) : user.role === 'AUDITOR' ? (
          activeTab === 'verification' ? (
            <AuditorContent request={request} notify={notify} setError={setError} />
          ) : (
            <Suspense fallback={<section className="panel"><p className="muted">Loading GIS Groundwater Maps…</p></section>}>
              <AssessmentExplorer request={request} setError={setError} />
            </Suspense>
          )
        ) : user.role === 'VILLAGE_HEAD' || user.role === 'GOVERNMENT_EMPLOYEE' ? (
          activeTab === 'farms' ? (
            <VillageHeadContent request={request} notify={notify} setError={setError} user={user} />
          ) : activeTab === 'recommendations' ? (
            <GeneralRecommendationWorkspace request={request} setError={setError} user={user} />
          ) : activeTab === 'schemes' ? (
            <VillageHeadSchemes request={request} setError={setError} />
          ) : (
            <Suspense fallback={<section className="panel"><p className="muted">Loading GIS Groundwater Maps…</p></section>}>
              <AssessmentExplorer request={request} setError={setError} />
            </Suspense>
          )
        ) : (
          <section className="empty">
            <Leaf />
            <h2>No workspace is assigned to this role</h2>
            <p>The account is authenticated, but this demo currently supports Village Head, Auditor, Government Employee, and Admin workspaces.</p>
          </section>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}