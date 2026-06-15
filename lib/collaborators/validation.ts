import { z } from 'zod'
import type { Role } from '@/types'

export const INVITABLE_ROLES = ['teacher', 'student_rep'] as const satisfies readonly Role[]

export const inviteMemberSchema = z.object({
  email: z.email('Insira um endereço de email válido.'),
  role: z.enum(INVITABLE_ROLES, { error: 'Selecione uma função.' }),
})

export const removeMemberSchema = z.object({
  userId: z.uuid(),
})

export const revokeInvitationSchema = z.object({
  invitationId: z.uuid(),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
