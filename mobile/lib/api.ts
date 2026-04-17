import type {
  AuthResponse, CalendarEvent, EventCreate,
  Family, NotificationPreferences, Suggestion, User,
} from './types'

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000'

// Token is loaded from SecureStore into memory by AuthProvider on startup
let _token: string | null = null
export const setApiToken = (t: string | null) => { _token = t }

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
      ...options.headers,
    },
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const authApi = {
  googleLogin: (auth_code: string, redirect_uri: string) =>
    request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ auth_code, redirect_uri }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

export const familyApi = {
  get: () => request<Family>('/family'),
  create: (data: { name: string; home_location: string; home_airport: string }) =>
    request<Family>('/family', { method: 'POST', body: JSON.stringify(data) }),
  update: (data: Partial<{ name: string; home_location: string; home_airport: string }>) =>
    request<Family>('/family', { method: 'PUT', body: JSON.stringify(data) }),
  invite: (email: string) =>
    request<unknown>('/family/invite', { method: 'POST', body: JSON.stringify({ email }) }),
  removeMember: (user_id: string) =>
    request<void>(`/family/members/${user_id}`, { method: 'DELETE' }),
}

export const eventsApi = {
  list: (from?: string, to?: string) => {
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    const qs = params.toString()
    return request<CalendarEvent[]>(`/events${qs ? `?${qs}` : ''}`)
  },
  get: (id: string) => request<CalendarEvent>(`/events/${id}`),
  create: (data: EventCreate) =>
    request<CalendarEvent>('/events', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<EventCreate>) =>
    request<CalendarEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
  sync: () => request<void>('/events/sync', { method: 'POST' }),
}

export const suggestionsApi = {
  list: (type?: 'opportunity' | 'travel_deal') => {
    const qs = type ? `?type=${type}` : ''
    return request<Suggestion[]>(`/suggestions${qs}`)
  },
  accept: (id: string) => request<Suggestion>(`/suggestions/${id}/accept`, { method: 'PUT' }),
  dismiss: (id: string) => request<Suggestion>(`/suggestions/${id}/dismiss`, { method: 'PUT' }),
}

export const notificationsApi = {
  getPreferences: () => request<NotificationPreferences>('/notifications/preferences'),
  updatePreferences: (data: Partial<NotificationPreferences>) =>
    request<NotificationPreferences>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  registerPushToken: (token: string) =>
    request<void>('/notifications/push-token', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
}

export const agentsApi = {
  runOpportunities: () => request<void>('/agents/opportunities/run', { method: 'POST' }),
  runTravel: () => request<void>('/agents/travel/run', { method: 'POST' }),
}
