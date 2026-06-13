import { z } from 'zod'

export const courtNameSchema = z
  .string()
  .trim()
  .min(1, 'Enter a court name')
  .max(40, 'Keep it under 40 characters')

export const createCourtSchema = z.object({
  name: courtNameSchema,
})

export const renameCourtSchema = z.object({
  courtId: z.uuid(),
  name: courtNameSchema,
})

export const deleteCourtSchema = z.object({
  courtId: z.uuid(),
})

export type CreateCourtInput = z.infer<typeof createCourtSchema>
export type RenameCourtInput = z.infer<typeof renameCourtSchema>
