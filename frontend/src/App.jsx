import { useEffect, useState } from 'react'
import Login from './components/layout/Login'
import Shell from './components/layout/Shell'
import LandingPage from './components/landing/LandingPage'
import { apiRequest, TOKEN_KEY, USER_KEY } from './services/api'

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(() => {
    try {
      const cached = localStorage.getItem(USER_KEY)
      return cached ? JSON.parse(cached) : null
    } catch {
      return null
    }
  })
  
  // Instant SWR restoration if token and cached user exist
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY) && !localStorage.getItem(USER_KEY)))
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [viewMode, setViewMode] = useState(() => (localStorage.getItem(TOKEN_KEY) ? 'workspace' : 'landing'))
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState(null)

  // Background token verification & session refresh
  useEffect(() => {
    if (!token) {
      setLoading(false)
      setUser(null)
      return
    }

    apiRequest('/api/auth/me')
      .then(({ data }) => {
        if (data?.user) {
          setUser(data.user)
          localStorage.setItem(USER_KEY, JSON.stringify(data.user))
        }
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        setToken(null)
        setUser(null)
        setViewMode('landing')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [token])

  function signOut() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setToken(null)
    setUser(null)
    setViewMode('landing')
  }

  function handleLoginSuccess(nextToken, nextUser) {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    setToken(nextToken)
    setUser(nextUser)
    setViewMode('workspace')
  }

  function notify(message) {
    setToast(message)
    window.setTimeout(() => setToast(''), 3600)
  }

  function handleNavigateToTab(tabId) {
    if (!user) {
      setViewMode('login')
      return
    }
    if (tabId) {
      setActiveWorkspaceTab(tabId)
    }
    setViewMode('workspace')
  }

  if (loading) return <main className="centered">Loading secure session…</main>
  
  if (!user) {
    if (viewMode === 'login') {
      return <Login onSuccess={handleLoginSuccess} onBackToLanding={() => setViewMode('landing')} />
    }
    return (
      <LandingPage
        onSignInClick={() => setViewMode('login')}
        onNavigateToTab={handleNavigateToTab}
        request={apiRequest}
      />
    )
  }

  // Authenticated User Routing
  if (viewMode === 'landing') {
    return (
      <LandingPage
        user={user}
        onSignInClick={() => setViewMode('workspace')}
        onNavigateToTab={handleNavigateToTab}
        request={apiRequest}
      />
    )
  }

  return (
    <Shell
      user={user}
      initialTab={activeWorkspaceTab}
      onLogout={signOut}
      onGoToLanding={() => setViewMode('landing')}
      notify={notify}
      request={apiRequest}
      error={error}
      setError={setError}
      toast={toast}
    />
  )
}
