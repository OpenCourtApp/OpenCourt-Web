import { z } from 'zod'

export const courtNameSchema = z
  .string()
  .trim()
  .min(1, 'Insira o nome da quadra')
  .max(40, 'Use no máximo 40 caracteres')

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
