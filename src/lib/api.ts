// API utility for making requests to our backend
const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:5173'

export async function apiRequest(endpoint: string, options: RequestInit & { body?: any } = {}) {
  const url = `${API_BASE}/api${endpoint}`

  const config: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  }

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body)
  }

  const response = await fetch(url, config)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }

  return response.text()
}

// Auth API calls
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    apiRequest('/auth/register', {
      method: 'POST',
      body: data,
    }),

  login: (data: { username: string; password: string }) =>
    apiRequest('/auth/login', {
      method: 'POST',
      body: data,
    }),

  verify: (token: string) =>
    apiRequest('/auth/verify', {
      method: 'POST',
      body: { token },
    }),
}

// Timeline API calls
export const timelineAPI = {
  create: (data: any, token: string) =>
    apiRequest('/timelines', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    }),

  list: (token: string) =>
    apiRequest('/timelines', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),

  get: (id: string, token: string) =>
    apiRequest(`/timelines/${id}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    }),

  update: (id: string, data: any, token: string) =>
    apiRequest(`/timelines/${id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: data,
    }),

  delete: (id: string, token: string) =>
    apiRequest(`/timelines/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
}
