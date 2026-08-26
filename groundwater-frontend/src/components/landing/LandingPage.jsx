import { useState } from 'react'
import LandingNavbar from './LandingNavbar'
import LandingHero from './LandingHero'
import LandingApproach from './LandingApproach'
import LandingFooter from './LandingFooter'
import '../../styles/landing.css'

export default function LandingPage({ onSignInClick, onNavigateToTab, request, user }) {
  const [activeSection, setActiveSection] = useState('home')

  function scrollToSection(id) {
    setActiveSection(id)
    if (id === 'schemes') {
      onSignInClick()
      return
    }
    const element = document.getElementById(id)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div className="jalsaarthi-landing">
      <LandingNavbar
        onSignInClick={onSignInClick}
        onNavClick={scrollToSection}
        activeSection={activeSection}
        user={user}
      />

      <main>
        <LandingHero
          onExploreMap={() => scrollToSection('map')}
          onGetAdvisory={() => scrollToSection('advisory')}
          request={request}
        />

        <LandingApproach
          onGetStarted={onSignInClick}
          onAdvisoryClick={() => scrollToSection('advisory')}
        />
      </main>

      <LandingFooter
        onNavClick={scrollToSection}
        onSignInClick={onSignInClick}
        onNavigateToTab={onNavigateToTab}
        user={user}
      />
    </div>
  )
}
