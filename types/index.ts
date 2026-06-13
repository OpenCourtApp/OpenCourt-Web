export type Role = 'principal' | 'teacher' | 'student_rep'

export interface School {
  id: string
  name: string
  access_token: string
  created_at: string
}

export interface User {
  id: string
  full_name: string
  email: string
  active_school_id: string | null
  created_at: string
}

export interface Membership {
  id: string
  user_id: string
  school_id: string
  role: Role
  created_at: string
}

export interface Invitation {
  id: string
  school_id: string
  email: string
  role: Role
  invited_by: string | null
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string
}

/** Lightweight shape for the school switcher. */
export type UserSchool = {
  school_id: string
  school_name: string
  role: Role
}

export interface Court {
  id: string
  school_id: string
  name: string
  created_at: string
}

export interface Booking {
  id: string
  title: string
  school_id: string
  court_id: string
  booked_by: string
  date: string
  start_time: string
  end_time: string
  notes: string | null
  created_at: string
}
