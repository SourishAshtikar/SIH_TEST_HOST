import { useState } from 'react'
import { ArrowLeft, ArrowRight, Droplets, Lock, Mail } from 'lucide-react'
import { ApiError } from '../common/CommonUI'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default function Login({ onSuccess, onBackToLanding }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const p = await r.json()
      if (!r.ok) throw new Error(p.message || 'Invalid credentials')
      onSuccess(p.data.token, p.data.user)
    } catch (err) {
      setError(err.message || 'Unable to sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        {onBackToLanding && (
          <button
            type="button"
            className="back-landing-btn"
            onClick={onBackToLanding}
          >
            <ArrowLeft size={16} />
            <span>Back to Landing Page</span>
          </button>
        )}

        <div className="login-header">
          <div className="brand-mark">
            <Droplets size={24} />
          </div>
          <p className="eyebrow">JALSAARTHI PLATFORM</p>
          <h1>Sign in to your workspace</h1>
          <p className="muted">
            Access secure groundwater intelligence, farm records, and irrigation advisories.
          </p>
        </div>

        <form className="login-form" onSubmit={submit}>
          <label>
            <span>Email Address</span>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                type="password"
                value={password}
                placeholder="••••••••"
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </label>

          <ApiError message={error} />

          <button className="button primary login-submit" disabled={busy}>
            <span>{busy ? 'Signing in…' : 'Sign in to Workspace'}</span>
            <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  )
}
