const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
export const TOKEN_KEY = 'groundwater_jwt'
export const USER_KEY = 'groundwater_user'

export async function apiRequest(path, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }
  const active = localStorage.getItem(TOKEN_KEY)
  if (active) headers.Authorization = `Bearer ${active}`
  const response = await fetch(`${API}${path}`, { ...options, headers })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || `Request failed (${response.status})`)
  return payload
}
