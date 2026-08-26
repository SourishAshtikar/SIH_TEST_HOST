import { ArrowRight, Home } from 'lucide-react'

export default function LandingNavbar({ onSignInClick, onNavClick, activeSection, user }) {
  function handleHomeClick() {
    if (onNavClick) {
      onNavClick('home')
    }
  }

  return (
    <nav className="js-navbar">
      <div className="js-nav-brand" onClick={handleHomeClick} style={{ cursor: 'pointer' }}>
        <div className="js-brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
        </div>
        <div className="js-brand-text">
          <span className="js-brand-name">JalSaarthi</span>
          <span className="js-brand-sub">Groundwater Intelligence Platform</span>
        </div>
      </div>

      <div className="js-nav-actions">
        <button type="button" className="js-nav-home-link" onClick={handleHomeClick}>
          <Home size={16} />
          <span>HOME</span>
        </button>
        <button type="button" className="js-btn-signin" onClick={onSignInClick}>
          <span>{user ? 'Go to Workspace' : 'Sign in to Workspace'}</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </nav>
  )
}
