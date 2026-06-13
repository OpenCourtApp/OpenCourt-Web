import { z } from 'zod'
import type { Role } from '@/types'

export const INVITABLE_ROLES = ['teacher', 'student_rep'] as const satisfies readonly Role[]

export const inviteMemberSchema = z.object({
  email: z.email('Enter a valid email address.'),
  role: z.enum(INVITABLE_ROLES, { error: 'Select a role.' }),
})

export const removeMemberSchema = z.object({
  userId: z.uuid(),
})

export const revokeInvitationSchema = z.object({
  invitationId: z.uuid(),
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
