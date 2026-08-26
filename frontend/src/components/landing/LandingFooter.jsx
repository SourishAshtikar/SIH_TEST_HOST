import { useState } from 'react'
import { Droplets } from 'lucide-react'
import SitemapModal from './SitemapModal'

export default function LandingFooter({ onNavClick, onSignInClick, onNavigateToTab, user }) {
  const [showSitemap, setShowSitemap] = useState(false)

  return (
    <>
      <footer className="js-footer">
        <div className="js-footer-inner">
          <div className="js-footer-brand">
            <div className="js-footer-icon">
              <Droplets size={20} />
            </div>
            <div className="js-footer-brand-text">
              <span className="js-footer-title">JalSaarthi</span>
              <span className="js-footer-sub">Groundwater Intelligence Platform</span>
            </div>
          </div>

          <ul className="js-footer-links">
            <li>
              <button type="button" onClick={() => onNavClick && onNavClick('map')}>
                Groundwater Map
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavClick && onNavClick('advisory')}>
                Irrigation Advisory
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavClick && onNavClick('approach')}>
                Sustainability
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavClick && onNavClick('schemes')}>
                Schemes
              </button>
            </li>
          </ul>

          <div className="js-footer-bottom-right">
            <span>© 2025 JalSaarthi. All rights reserved.</span>
            <button
              type="button"
              className="js-footer-sitemap-btn"
              onClick={() => setShowSitemap(true)}
              title="Open Project Sitemap"
            >
              🗺️ Sitemap
            </button>
          </div>
        </div>
      </footer>

      <SitemapModal
        isOpen={showSitemap}
        onClose={() => setShowSitemap(false)}
        onNavClick={onNavClick}
        onNavigateToTab={onNavigateToTab}
        user={user}
      />
    </>
  )
}
