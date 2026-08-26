import { Droplets, Map, Sprout } from 'lucide-react'
import LandingGISMap from './LandingGISMap'

export default function LandingHero({ onExploreMap, onGetAdvisory, request }) {
  return (
    <section className="js-hero" id="home">
      <div className="js-hero-content">
        <div className="js-eyebrow-pill">
          <Sprout size={14} />
          <span>SMART WATER. STRONGER FARMS.</span>
        </div>

        <h1 className="js-hero-title">
          Intelligent Groundwater <br />
          Insights for a <br />
          <span className="accent">Sustainable India.</span>
        </h1>

        <p className="js-hero-description">
          JalSaarthi combines groundwater, weather, soil and crop intelligence to help farmers and authorities make smarter water decisions.
        </p>

        <div className="js-hero-buttons">
          <button type="button" className="js-btn-primary" onClick={onExploreMap}>
            <span>Explore Groundwater Map</span>
            <Map size={17} />
          </button>

          <button type="button" className="js-btn-secondary" onClick={onGetAdvisory}>
            <span>Get Irrigation Advisory</span>
            <Droplets size={17} />
          </button>
        </div>
      </div>

      <div className="js-hero-map-container" id="map">
        <LandingGISMap onExploreClick={onExploreMap} request={request} />
      </div>
    </section>
  )
}
