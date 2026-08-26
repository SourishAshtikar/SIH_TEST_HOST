import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Droplets,
  Leaf,
  ShieldCheck,
  Sprout,
  TrendingUp,
  Waves
} from 'lucide-react'

export default function LandingApproach({ onGetStarted, onAdvisoryClick }) {
  const steps = [
    {
      num: 1,
      icon: <Droplets size={20} />,
      title: 'Understand',
      desc: 'Collect data from trusted sources'
    },
    {
      num: 2,
      icon: <Brain size={20} />,
      title: 'Analyze',
      desc: 'Assess conditions and identify needs'
    },
    {
      num: 3,
      icon: <Leaf size={20} />,
      title: 'Recommend',
      desc: 'Get the best irrigation practice'
    },
    {
      num: 4,
      icon: <ShieldCheck size={20} />,
      title: 'Verify',
      desc: 'Field verification ensures reliability'
    },
    {
      num: 5,
      icon: <TrendingUp size={20} />,
      title: 'Impact',
      desc: 'Measure savings and sustainability'
    }
  ]

  return (
    <section className="js-approach-wrapper" id="approach">
      <div className="js-approach-inner">
        {/* Section Header */}
        <div className="js-section-header">
          <h2 className="js-section-title">How JalSaarthi Works</h2>
        </div>

        {/* 5-Step Horizontal Stepper with Dotted Connections */}
        <div className="js-stepper-container">
          {steps.map((step, index) => (
            <div key={step.num} className="js-stepper-item">
              <div className="js-stepper-node">
                <div className="js-stepper-icon">{step.icon}</div>
                <span className="js-stepper-badge">{step.num}</span>
              </div>
              <h3 className="js-stepper-title">{step.title}</h3>
              <p className="js-stepper-desc">{step.desc}</p>
              {index < steps.length - 1 && <div className="js-stepper-connector" />}
            </div>
          ))}
        </div>

        {/* Bottom Banner Card */}
        <div className="js-banner-card" id="advisory">
          <div className="js-banner-leaf-graphic">
            <svg viewBox="0 0 160 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M20 100C40 60 70 30 130 20C120 70 90 90 20 100Z"
                fill="url(#leafGrad)"
                opacity="0.35"
              />
              <path
                d="M50 110C70 80 100 50 150 40C140 85 110 105 50 110Z"
                fill="url(#leafGrad)"
                opacity="0.2"
              />
              <defs>
                <linearGradient id="leafGrad" x1="20" y1="20" x2="150" y2="110">
                  <stop stopColor="#43552d" />
                  <stop offset="1" stopColor="#9e8e6a" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="js-banner-text">
            <h3 className="js-banner-title">Make every drop count.</h3>
            <p className="js-banner-sub">
              Better decisions today ensure a more sustainable tomorrow.
            </p>
          </div>

          <div className="js-banner-features">
            <div className="js-banner-feat-item">
              <div className="js-feat-icon"><Droplets size={18} /></div>
              <div className="js-feat-text">
                <strong>Smart Irrigation</strong>
                <span>Better practices</span>
              </div>
            </div>

            <div className="js-banner-feat-item">
              <div className="js-feat-icon"><Waves size={18} /></div>
              <div className="js-feat-text">
                <strong>Water Savings</strong>
                <span>Lower extraction</span>
              </div>
            </div>

            <div className="js-banner-feat-item">
              <div className="js-feat-icon"><Sprout size={18} /></div>
              <div className="js-feat-text">
                <strong>Sustainable Future</strong>
                <span>Secured resources</span>
              </div>
            </div>
          </div>

          <button type="button" className="js-banner-cta-btn" onClick={onGetStarted}>
            <span>Get Started</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  )
}
