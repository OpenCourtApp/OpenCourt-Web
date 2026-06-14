import { z } from 'zod'
import type { Role } from '@/types'

export const ROLES = ['principal', 'teacher', 'student_rep'] as const satisfies readonly Role[]
export const INVITABLE_ROLES = ['teacher', 'student_rep'] as const satisfies readonly Role[]

const email    = z.email('Enter a valid email address.')
const fullName = z.string().trim().min(2, 'Enter your full name.')

// Password policy for new password creation (email/password signup, invitee
// password-set, profile password change). Google users never set a password,
// so this only ever applies to non-Google flows.
const PASSWORD_SPECIAL_CHAR = /[!@#$%^&*(),.?":{}|<>]/

export const PASSWORD_HINT =
  'At least 6 characters, including one special character.'

export const passwordSchema = z
  .string()
  .min(6, 'Password must be at least 6 characters.')
  .regex(
    PASSWORD_SPECIAL_CHAR,
    'Password must contain at least one special character.'
  )

const password = passwordSchema

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
})

export const signUpSchema = z.object({
  fullName,
  email,
  password,
})

export const createSchoolSchema = z.object({
  fullName,
  schoolName: z.string().trim().min(3, 'Enter your school name.'),
})

// Server-side schema. Password is optional here ONLY because Google OAuth
// invitees authenticate via Google and submit no password — the action checks
// the provider and rejects a missing password for non-Google users. When
// present it must meet the signup policy.
export const acceptInvitationSchema = z.object({
  fullName,
  password: password.optional(),
})

// Client schema for non-Google invitees: a password is required (it becomes
// their only credential, since the invite link is single-use and expires).
export const acceptInvitationWithPasswordSchema = z.object({
  fullName,
  password,
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
