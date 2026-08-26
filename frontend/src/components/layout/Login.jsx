import { useState } from 'react'
import { Droplets } from 'lucide-react'
import { ApiError } from '../common/CommonUI'

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export default function Login({ onSuccess }) {
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
      if (!r.ok) throw new Error(p.message)
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
        <div className="login-header">
          <div className="brand-mark"><Droplets /></div>
          <p className="eyebrow">Haryana groundwater platform</p>
          <h1>Sign in to your workspace</h1>
          <p className="muted">Use your assigned system account to manage agricultural water adoption.</p>
        </div>
        <form className="login-form" onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              placeholder="e.g. admin@test.com"
              onChange={e => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              placeholder="••••••••"
              onChange={e => setPassword(e.target.value)}
              required
            />
          </label>
          <ApiError message={error} />
          <button className="button primary login-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  )
}
