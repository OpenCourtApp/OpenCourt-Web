import { z } from 'zod'
import type { Role } from '@/types'

export const ROLES = ['principal', 'teacher', 'student_rep'] as const satisfies readonly Role[]
export const INVITABLE_ROLES = ['teacher', 'student_rep'] as const satisfies readonly Role[]

const email    = z.email('Insira um endereço de email válido.')
const fullName = z.string().trim().min(2, 'Insira seu nome completo.')

// Password policy for new password creation (email/password signup, invitee
// password-set, profile password change). Google users never set a password,
// so this only ever applies to non-Google flows.
//
// "Especial" = qualquer pontuação ou símbolo Unicode (categorias P e S), o que
// cobre !@#$%^&* e também - _ + = ~ / \ ; ' [ ] etc. A lista fechada anterior
// rejeitava senhas válidas que usavam, por exemplo, "_" ou "-".
const PASSWORD_SPECIAL_CHAR = /[\p{P}\p{S}]/u

export const PASSWORD_HINT =
  'Pelo menos 6 caracteres, incluindo um caractere especial.'

export const passwordSchema = z
  .string()
  .min(6, 'A senha deve ter pelo menos 6 caracteres.')
  .regex(
    PASSWORD_SPECIAL_CHAR,
    'A senha deve conter pelo menos um caractere especial.'
  )

const password = passwordSchema

export const signInSchema = z.object({
  email,
  password: z.string().min(1, 'Insira sua senha.'),
})

export const signUpSchema = z.object({
  fullName,
  email,
  password,
})

export const createSchoolSchema = z.object({
  fullName,
  schoolName: z.string().trim().min(3, 'Insira o nome da sua escola.'),
})

export const forgotPasswordSchema = z.object({
  email,
})

// O Supabase envia o código de recuperação com a quantidade de dígitos
// configurada no projeto (8 no nosso caso). O valor é compartilhado com o
// formulário para limitar o campo ao mesmo tamanho.
export const OTP_CODE_LENGTH = 8

const otpCode = z
  .string()
  .min(1, 'Informe o código de recuperação.')
  .regex(/^\d+$/, 'Informe apenas dígitos numéricos.')
  .length(OTP_CODE_LENGTH, `O código deve ter ${OTP_CODE_LENGTH} dígitos.`)

export const resetPasswordWithOtpSchema = z.object({
  email,
  code: otpCode,
  password,
  confirmPassword: z.string().min(1, 'Confirme sua nova senha.'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'As senhas não coincidem.',
  path: ['confirmPassword'],
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
  role: z.enum(INVITABLE_ROLES, { error: 'Selecione uma função.' }),
})

export type SignInInput            = z.infer<typeof signInSchema>
export type SignUpInput            = z.infer<typeof signUpSchema>
export type CreateSchoolInput      = z.infer<typeof createSchoolSchema>
export type AcceptInvitationInput  = z.infer<typeof acceptInvitationSchema>
export type InviteMemberInput      = z.infer<typeof inviteMemberSchema>
export type ForgotPasswordInput    = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordWithOtpInput = z.infer<typeof resetPasswordWithOtpSchema>
