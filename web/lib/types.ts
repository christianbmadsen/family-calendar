export interface User {
  id: string
  email: string
  name: string
  photo_url?: string
  family_id?: string
  push_tokens: string[]
  notify_push: boolean
  notify_email: boolean
  google_calendar_id?: string
  created_at: string
}

export interface Family {
  id: string
  name: string
  owner_id: string
  member_ids: string[]
  home_location?: string
  home_airport?: string
  google_calendar_id?: string
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
  google_event_id?: string
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

export interface EventUpdate extends Partial<EventCreate> {}

export interface Invitation {
  id: string
  family_id: string
  invited_email: string
  invited_by: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
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
  source: string
  status: 'pending' | 'accepted' | 'dismissed'
  created_at: string
}

export interface AuthResponse {
  access_token: string
  user: User
  is_new_user: boolean
}

export interface NotificationPreferences {
  notify_push: boolean
  notify_email: boolean
}
