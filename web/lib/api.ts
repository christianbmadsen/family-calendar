import type {
  AuthResponse, CalendarEvent, EventCreate, EventUpdate,
  Family, Invitation, NotificationPreferences, Suggestion,
} from './types'

type FamilyCreateInput = { name: string; home_location?: string; home_airport?: string }

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
    localStorage.removeItem('auth_user')
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
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  me: () => request<User>('/auth/me'),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
}

// Family
export const familyApi = {
  get: () => request<Family>('/family'),
  create: (data: FamilyCreateInput) =>
    request<Family>('/family', { method: 'POST', body: JSON.stringify(data) }),
  update: (data: Partial<FamilyCreateInput>) =>
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
  getIcalToken: () => request<{ token: string; family_id: string }>('/family/ical-token'),
  regenerateIcalToken: () =>
    request<{ token: string; family_id: string }>('/family/ical-token/regenerate', { method: 'POST' }),
}

// Suggestions
export const suggestionsApi = {
  list: () => request<Suggestion[]>('/suggestions'),
  generate: () => request<{ status: string }>('/suggestions/generate', { method: 'POST' }),
  accept: (id: string) => request<Suggestion>(`/suggestions/${id}/accept`, { method: 'POST' }),
  dismiss: (id: string) => request<void>(`/suggestions/${id}/dismiss`, { method: 'POST' }),
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
