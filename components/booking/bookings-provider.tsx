'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { createClient } from '@/lib/supabase/client'

export type CourtOption = {
  id: string
  name: string
}

/** Flattened booking row ready for the calendar + dashboard to consume. */
export type BookingRecord = {
  id: string
  title: string
  date: string
  start_time: string
  end_time: string
  notes: string | null
  booked_by: string
  court_id: string
  courtName: string
  professor: string
}

type BookingsContextType = {
  courts: CourtOption[]
  bookings: BookingRecord[]
  loading: boolean
  refresh: () => Promise<void>
}

const BookingsContext = createContext<BookingsContextType>({
  courts: [],
  bookings: [],
  loading: true,
  refresh: async () => {},
})

// Supabase embeds can come back as an object or a single-element array
// depending on the relationship; normalize both.
function pick<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

export function BookingsProvider({ children }: { children: ReactNode }) {
  const [courts, setCourts] = useState<CourtOption[]>([])
  const [bookings, setBookings] = useState<BookingRecord[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const supabase = createClient()

    try {
      // RLS scopes both queries to the active school automatically.
      const [{ data: courtRows }, { data: bookingRows }] = await Promise.all([
        supabase.from('courts').select('id, name').order('name'),
        supabase
          .from('bookings')
          .select(
            'id, title, date, start_time, end_time, notes, booked_by, court_id, courts(name), users:booked_by(full_name)'
          )
          .order('date')
          .order('start_time'),
      ])

      setCourts((courtRows ?? []) as CourtOption[])

      setBookings(
        (bookingRows ?? []).map((b) => {
          const court = pick(b.courts as { name: string } | { name: string }[] | null)
          const author = pick(
            b.users as { full_name: string } | { full_name: string }[] | null
          )
          return {
            id: b.id,
            title: b.title,
            date: b.date,
            start_time: b.start_time,
            end_time: b.end_time,
            notes: b.notes,
            booked_by: b.booked_by,
            court_id: b.court_id,
            courtName: court?.name ?? 'Court',
            professor: author?.full_name ?? '',
          }
        })
      )
    } catch {
      // Silently recover – courts/bookings stay at their previous values.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <BookingsContext.Provider value={{ courts, bookings, loading, refresh }}>
      {children}
    </BookingsContext.Provider>
  )
}

export function useBookings() {
  return useContext(BookingsContext)
}
