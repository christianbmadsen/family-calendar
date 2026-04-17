import type {
  AuthResponse, CalendarEvent, EventCreate, EventUpdate,
  Family, FamilyCreate, Invitation, NotificationPreferences,
  Suggestion, User,
} from './types'

// Defined here to avoid circular import with auth context
type FamilyCreate = { name: string; home_location: string; home_airport: string }

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.location.href = '/'
    throw new Error('Unauthorized')
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(error.detail ?? 'Request failed')
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

// Auth
export const authApi = {
  googleLogin: (auth_code: string) =>
    request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ auth_code }),
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

// Family
export const familyApi = {
  get: () => request<Family>('/family'),
  create: (data: FamilyCreate) =>
    request<Family>('/family', { method: 'POST', body: JSON.stringify(data) }),
  update: (data: Partial<FamilyCreate>) =>
    request<Family>('/family', { method: 'PUT', body: JSON.stringify(data) }),
  invite: (email: string) =>
    request<Invitation>('/family/invite', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  join: (invitation_id: string) =>
    request<Family>(`/family/join/${invitation_id}`, { method: 'POST' }),
  removeMember: (user_id: string) =>
    request<void>(`/family/members/${user_id}`, { method: 'DELETE' }),
}

// Events
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
  update: (id: string, data: EventUpdate) =>
    request<CalendarEvent>(`/events/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/events/${id}`, { method: 'DELETE' }),
  sync: () => request<void>('/events/sync', { method: 'POST' }),
}

// Suggestions
export const suggestionsApi = {
  list: (type?: 'opportunity' | 'travel_deal') => {
    const qs = type ? `?type=${type}` : ''
    return request<Suggestion[]>(`/suggestions${qs}`)
  },
  accept: (id: string) =>
    request<Suggestion>(`/suggestions/${id}/accept`, { method: 'PUT' }),
  dismiss: (id: string) =>
    request<Suggestion>(`/suggestions/${id}/dismiss`, { method: 'PUT' }),
}

// Notifications
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

// Agents
export const agentsApi = {
  runOpportunities: () =>
    request<void>('/agents/opportunities/run', { method: 'POST' }),
  runTravel: () =>
    request<void>('/agents/travel/run', { method: 'POST' }),
}
