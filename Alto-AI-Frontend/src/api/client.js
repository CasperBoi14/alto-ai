const BASE = import.meta.env.VITE_API_URL || 'https://api.alto-ai.tech'

// Access token lives in memory only — never localStorage
let _accessToken = null

export function setAccessToken(token) {
  _accessToken = token
}

export function getAccessToken() {
  return _accessToken
}

export function clearTokens() {
  _accessToken = null
  localStorage.removeItem('refresh_token')
}

// ─── Token expiry check ───────────────────────────────────────────────────────

function tokenIsExpiredOrSoon(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.exp * 1000 < Date.now() + 30_000
  } catch {
    return true
  }
}

// ─── Token refresh ────────────────────────────────────────────────────────────

async function maybeRefresh() {
  if (_accessToken && !tokenIsExpiredOrSoon(_accessToken)) return

  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) return

  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) {
    clearTokens()
    window.location.href = '/login'
    return
  }

  const data = await res.json()
  _accessToken = data.access_token
  localStorage.setItem('refresh_token', data.refresh_token)
}

// ─── Core request wrapper ─────────────────────────────────────────────────────

async function request(method, path, body = null, skipAuth = false) {
  if (!skipAuth) await maybeRefresh()

  const headers = { 'Content-Type': 'application/json' }
  if (_accessToken && !skipAuth) {
    headers['Authorization'] = `Bearer ${_accessToken}`
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !skipAuth) {
    clearTokens()
    window.location.href = '/login'
    return
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({
      error: { code: 'UNKNOWN', message: res.statusText },
    }))
    throw err.error
  }

  if (res.status === 204) return null
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  const data = await request('POST', '/auth/login', { username, password }, true)
  _accessToken = data.access_token
  localStorage.setItem('refresh_token', data.refresh_token)
  return data
}

export async function logout() {
  const refreshToken = localStorage.getItem('refresh_token')
  await request('POST', '/auth/logout', { refresh_token: refreshToken }).catch(() => {})
  clearTokens()
}

export async function changePassword(current_password, new_password) {
  return request('PUT', '/auth/password', { current_password, new_password })
}

// ─── Tools ────────────────────────────────────────────────────────────────────

export async function getTools() {
  return request('GET', '/tools')
}

export async function getTool(id) {
  return request('GET', `/tools/${id}`)
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function updateSettings(patch) {
  return request('PUT', '/settings', patch)
}

export async function deleteSetting(key) {
  return request('DELETE', `/settings/${key}`)
}

// ─── Agent behaviour ──────────────────────────────────────────────────────────

export async function getAgent() {
  return request('GET', '/agent')
}

export async function updateAgent(patch) {
  return request('PUT', '/agent', patch)
}

// ─── OAuth ───────────────────────────────────────────────────────────────────

export async function startOAuth(toolId) {
  return request('GET', `/oauth/${toolId}/start`)
}

export async function disconnectOAuth(toolId) {
  return request('DELETE', `/oauth/${toolId}`)
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth() {
  const res = await fetch(`${BASE}/health`)
  return res.json()
}

// ─── Logs SSE ─────────────────────────────────────────────────────────────────
// Returns an EventSource connected to the live log stream.
// The caller must close it when done: source.close()

export async function openLogStream() {
  await maybeRefresh()
  if (!_accessToken) throw new Error('Not authenticated')
  return new EventSource(`${BASE}/logs/stream?token=${_accessToken}`)
}
