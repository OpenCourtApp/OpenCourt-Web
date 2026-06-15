import { z } from 'zod'

const bookingFields = {
  title:     z.string().trim().min(2, 'Insira um título'),
  courtId:   z.uuid('Selecione uma quadra'),
  date:      z.string().min(1, 'Escolha uma data'),
  startTime: z.string().min(1, 'Defina o horário de início'),
  endTime:   z.string().min(1, 'Defina o horário de término'),
  notes:     z.string().optional(),
}

const endAfterStart = {
  message: 'O horário de término deve ser depois do início',
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
