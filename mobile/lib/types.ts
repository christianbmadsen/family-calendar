export interface User {
  id: string
  email: string
  name: string
  photo_url?: string
  family_id?: string
  push_tokens: string[]
  notify_push: boolean
  notify_email: boolean
  created_at: string
}

export interface Family {
  id: string
  name: string
  owner_id: string
  member_ids: string[]
  home_location: string
  home_airport: string
  created_at: string
}

export interface CalendarEvent {
  id: string
  family_id: string
  title: string
  description?: string
  start_datetime?: string
  end_datetime?: string
  is_all_day: boolean
  location?: string
  references?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface EventCreate {
  title: string
  description?: string
  start_datetime?: string
  end_datetime?: string
  location?: string
  references?: string
}

export interface Suggestion {
  id: string
  family_id: string
  type: 'opportunity' | 'travel_deal'
  title: string
  description: string
  start_datetime: string
  end_datetime: string
  location?: string
  price?: string
  source_url?: string
  status: 'pending' | 'accepted' | 'dismissed'
  created_at: string
}

export interface NotificationPreferences {
  notify_push: boolean
  notify_email: boolean
}

export interface AuthResponse {
  access_token: string
  user: User
  is_new_user: boolean
}
