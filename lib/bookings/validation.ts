import { z } from 'zod'

const bookingFields = {
  title:     z.string().trim().min(2, 'Enter a title'),
  courtId:   z.uuid('Select a court'),
  date:      z.string().min(1, 'Pick a date'),
  startTime: z.string().min(1, 'Set a start time'),
  endTime:   z.string().min(1, 'Set an end time'),
  notes:     z.string().optional(),
}

const endAfterStart = {
  message: 'End time must be after the start time',
  path:    ['endTime'],
}

export const createBookingSchema = z
  .object(bookingFields)
  .refine((d) => d.endTime > d.startTime, endAfterStart)

export const updateBookingSchema = z
  .object({ id: z.uuid(), ...bookingFields })
  .refine((d) => d.endTime > d.startTime, endAfterStart)

export const deleteBookingSchema = z.object({ id: z.uuid() })

export type CreateBookingInput = z.infer<typeof createBookingSchema>
export type UpdateBookingInput = z.infer<typeof updateBookingSchema>
