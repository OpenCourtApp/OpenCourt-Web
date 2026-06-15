'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  BOOKING_CONFLICT_ERROR,
  GENERIC_BOOKING_ERROR,
  NO_ACTIVE_SCHOOL_ERROR,
  NOT_ALLOWED_ERROR,
} from '@/lib/bookings/errors'
import {
  createBookingSchema,
  deleteBookingSchema,
  updateBookingSchema,
  type CreateBookingInput,
  type UpdateBookingInput,
} from '@/lib/bookings/validation'

export type BookingActionResult = { error: string } | undefined

export async function createBooking(
  input: CreateBookingInput
): Promise<BookingActionResult> {
  const parsed = createBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Verifique os campos do formulário e tente novamente.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const activeSchoolId = user.user_metadata?.active_school_id as
    | string
    | undefined
  if (!activeSchoolId) return { error: NO_ACTIVE_SCHOOL_ERROR }

  const { title, courtId, date, startTime, endTime, notes } = parsed.data

  // Reject overlapping bookings on the same court + day.
  // Two ranges overlap when each starts before the other ends.
  const { data: clashes, error: clashError } = await supabase
    .from('bookings')
    .select('id')
    .eq('court_id', courtId)
    .eq('date', date)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .limit(1)

  if (clashError) return { error: GENERIC_BOOKING_ERROR }
  if (clashes && clashes.length > 0) return { error: BOOKING_CONFLICT_ERROR }

  const { error: insertError } = await supabase.from('bookings').insert({
    title,
    court_id: courtId,
    school_id: activeSchoolId,
    booked_by: user.id,
    date,
    start_time: startTime,
    end_time: endTime,
    notes: notes?.trim() ? notes.trim() : null,
  })

  if (insertError) return { error: GENERIC_BOOKING_ERROR }
}

export async function updateBooking(
  input: UpdateBookingInput
): Promise<BookingActionResult> {
  const parsed = updateBookingSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Verifique os campos do formulário e tente novamente.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { id, title, courtId, date, startTime, endTime, notes } = parsed.data

  // Reject overlaps with *other* bookings on the same court + day.
  const { data: clashes, error: clashError } = await supabase
    .from('bookings')
    .select('id')
    .eq('court_id', courtId)
    .eq('date', date)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
    .neq('id', id)
    .limit(1)

  if (clashError) return { error: GENERIC_BOOKING_ERROR }
  if (clashes && clashes.length > 0) return { error: BOOKING_CONFLICT_ERROR }

  // RLS gates this to the owner or the principal; a blocked update touches
  // no rows, so an empty result means "not allowed".
  const { data: updated, error: updateError } = await supabase
    .from('bookings')
    .update({
      title,
      court_id: courtId,
      date,
      start_time: startTime,
      end_time: endTime,
      notes: notes?.trim() ? notes.trim() : null,
    })
    .eq('id', id)
    .select('id')

  if (updateError) return { error: GENERIC_BOOKING_ERROR }
  if (!updated || updated.length === 0) return { error: NOT_ALLOWED_ERROR }
}

export async function deleteBooking(id: string): Promise<BookingActionResult> {
  const parsed = deleteBookingSchema.safeParse({ id })
  if (!parsed.success) return { error: GENERIC_BOOKING_ERROR }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // RLS gates deletes to owner/principal; no rows removed ⇒ not allowed.
  const { data: deleted, error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', parsed.data.id)
    .select('id')

  if (error) return { error: GENERIC_BOOKING_ERROR }
  if (!deleted || deleted.length === 0) return { error: NOT_ALLOWED_ERROR }
}
