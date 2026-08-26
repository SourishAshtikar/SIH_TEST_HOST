import { X, Layers, ShieldCheck, Sprout, Building2, UserCheck } from 'lucide-react'

export default function SitemapModal({ isOpen, onClose, onNavClick, onNavigateToTab, user }) {
  if (!isOpen) return null

  const landingSections = [
    { name: 'Home Hero', id: 'home', desc: 'Platform overview, slogan & quick action buttons' },
    { name: 'GIS Groundwater Map', id: 'map', desc: 'Interactive Leaflet district & village hydrological layer map' },
    { name: '5-Step Stepper', id: 'approach', desc: 'Understand → Analyze → Recommend → Verify → Impact' },
    { name: 'Government Schemes', id: 'schemes', desc: 'Agricultural subsidies & support catalog banner' },
  ]

  const villageHeadPages = [
    { name: 'Farm Register', tabId: 'farms', desc: 'Manage village farms, crop records & sustainability metrics' },
    { name: 'Irrigation Advisory', tabId: 'recommendations', desc: 'Interactive crop & irrigation practice simulation' },
    { name: 'Subsidies & Schemes', tabId: 'schemes', desc: 'Directory of central and state agricultural support' },
    { name: 'Groundwater Maps', tabId: 'maps', desc: 'Full GIS layer explorer & depth to water metrics' },
  ]

  const auditorPages = [
    { name: 'Audit Field Logs', tabId: 'verification', desc: 'Log field adoption status & photo verification logs' },
    { name: 'Groundwater Maps', tabId: 'maps', desc: 'Full GIS layer explorer' },
  ]

  const govtEmployeePages = [
    { name: 'Govt Schemes Catalog', tabId: 'schemes', desc: 'Browse state & central water conservation subsidies' },
    { name: 'Groundwater Maps', tabId: 'maps', desc: 'Full GIS layer explorer' },
  ]

  const adminPages = [
    { name: 'Scheme Catalogue', tabId: 'schemes', desc: 'Create & manage government scheme eligibility rules' },
    { name: 'Sustainability Scores', tabId: 'scores', desc: 'Village & district sustainability ranking leaderboard' },
    { name: 'ML Microservice', tabId: 'ml', desc: 'Machine learning prediction model test portal' },
    { name: 'Groundwater Maps', tabId: 'maps', desc: 'Full GIS layer explorer' },
  ]

  function handleWorkspacePageClick(tabId) {
    onClose()
    if (onNavigateToTab) {
      onNavigateToTab(tabId)
    }
  }

  return (
    <div className="sitemap-modal-overlay" onClick={onClose}>
      <div className="sitemap-modal-card" onClick={e => e.stopPropagation()}>
        <header className="sitemap-modal-header">
          <div>
            <span className="eyebrow">JALSAARTHI PLATFORM</span>
            <h2>Project Sitemap</h2>
          </div>
          <button type="button" className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="sitemap-modal-body">
          {/* Public Landing Page */}
          <section className="sitemap-block">
            <h3><Layers size={16} /> 🌐 Public Landing Page</h3>
            <div className="sitemap-grid">
              {landingSections.map(sec => (
                <button
                  key={sec.id}
                  type="button"
                  className="sitemap-item-btn"
                  onClick={() => {
                    onClose()
                    if (onNavClick) onNavClick(sec.id)
                  }}
                >
                  <strong>{sec.name}</strong>
                  <small>{sec.desc}</small>
                </button>
              ))}
            </div>
          </section>

          {/* Village Head Workspace */}
          <section className="sitemap-block">
            <h3><Sprout size={16} /> 🌾 1. Village Head Workspace</h3>
            <div className="sitemap-grid">
              {villageHeadPages.map(page => (
                <button
                  key={page.name}
                  type="button"
                  className="sitemap-item-btn"
                  onClick={() => handleWorkspacePageClick(page.tabId)}
                >
                  <strong>{page.name}</strong>
                  <small>{page.desc}</small>
                </button>
              ))}
            </div>
          </section>

          {/* Auditor Workspace */}
          <section className="sitemap-block">
            <h3><ShieldCheck size={16} /> 🛡️ 2. Auditor Workspace</h3>
            <div className="sitemap-grid">
              {auditorPages.map(page => (
                <button
                  key={page.name}
                  type="button"
                  className="sitemap-item-btn"
                  onClick={() => handleWorkspacePageClick(page.tabId)}
                >
                  <strong>{page.name}</strong>
                  <small>{page.desc}</small>
                </button>
              ))}
            </div>
          </section>

          {/* Government Employee Workspace */}
          <section className="sitemap-block">
            <h3><UserCheck size={16} /> 🏛️ 3. Government Employee Workspace</h3>
            <div className="sitemap-grid">
              {govtEmployeePages.map(page => (
                <button
                  key={page.name}
                  type="button"
                  className="sitemap-item-btn"
                  onClick={() => handleWorkspacePageClick(page.tabId)}
                >
                  <strong>{page.name}</strong>
                  <small>{page.desc}</small>
                </button>
              ))}
            </div>
          </section>

          {/* Admin Workspace */}
          <section className="sitemap-block">
            <h3><Building2 size={16} /> 👑 4. Government Admin Workspace</h3>
            <div className="sitemap-grid">
              {adminPages.map(page => (
                <button
                  key={page.name}
                  type="button"
                  className="sitemap-item-btn"
                  onClick={() => handleWorkspacePageClick(page.tabId)}
                >
                  <strong>{page.name}</strong>
                  <small>{page.desc}</small>
                </button>
              ))}
            </div>
          </section>
        </div>

        <footer className="sitemap-modal-footer">
          <span>JalSaarthi Groundwater Platform (4 System Roles Included)</span>
          <button type="button" className="button secondary" onClick={onClose}>
            Close Sitemap
          </button>
        </footer>
      </div>
    </div>
  )
}
