import { z } from 'zod'
import type { Role } from '@/types'

export const ROLES = ['principal', 'teacher', 'student_rep'] as const satisfies readonly Role[]
export const INVITABLE_ROLES = ['teacher', 'student_rep'] as const satisfies readonly Role[]

const email    = z.email('Enter a valid email address.')
const fullName = z.string().trim().min(2, 'Enter your full name.')

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
})

export const signUpSchema = z.object({
  fullName,
  email,
  password: z.string().min(6, 'Password must be at least 6 characters.'),
})

export const createSchoolSchema = z.object({
  fullName,
  schoolName: z.string().trim().min(3, 'Enter your school name.'),
})

export const acceptInvitationSchema = z.object({
  fullName,
  // Optional — hidden for Google OAuth users
  password: z.string().min(8, 'Password must be at least 8 characters.').optional(),
})

export const inviteMemberSchema = z.object({
  email,
  role: z.enum(INVITABLE_ROLES, { error: 'Select a role.' }),
})

export type SignInInput            = z.infer<typeof signInSchema>
export type SignUpInput            = z.infer<typeof signUpSchema>
export type CreateSchoolInput      = z.infer<typeof createSchoolSchema>
export type AcceptInvitationInput  = z.infer<typeof acceptInvitationSchema>
export type InviteMemberInput      = z.infer<typeof inviteMemberSchema>
