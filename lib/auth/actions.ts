'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  friendlyAuthError,
  friendlyOnboardingError,
  GENERIC_AUTH_ERROR,
} from '@/lib/auth/errors'
import {
  acceptInvitationSchema,
  createSchoolSchema,
  signInSchema,
  signUpSchema,
  type CreateSchoolInput,
  type SignInInput,
  type SignUpInput,
} from '@/lib/auth/validation'

export type AuthActionResult = { error: string } | undefined

const INVALID_INPUT: AuthActionResult = {
  error: 'Verifique os campos do formulário e tente novamente.',
}

export async function signIn(
  input: SignInInput,
  next?: string
): Promise<{ success: true; next: string } | { error: string }> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return { error: 'Verifique os campos do formulário e tente novamente.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: friendlyAuthError(error) }
  }

  return { success: true, next: next ?? '/dashboard' }
}

export async function signUp(input: SignUpInput): Promise<AuthActionResult> {
  const parsed = signUpSchema.safeParse(input)
  if (!parsed.success) return INVALID_INPUT

  const { email, password, fullName } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  })

  if (error) {
    return { error: friendlyAuthError(error) }
  }

  redirect(data.session ? '/onboarding' : '/login')
}

// Google OAuth is initiated client-side (browser client must own the PKCE
// verifier + cross-origin redirect) — see components/google-sign-in-button.tsx.
// The /auth/callback route handles exchangeCodeForSession server-side.

export async function createSchool(
  input: CreateSchoolInput
): Promise<AuthActionResult> {
  const parsed = createSchoolSchema.safeParse(input)
  if (!parsed.success) return INVALID_INPUT

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.rpc('create_school', {
    p_school_name: parsed.data.schoolName,
    p_full_name: parsed.data.fullName,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return { error: GENERIC_AUTH_ERROR }
  }

  redirect('/dashboard')
}

export type AcceptInvitationState = { error: string } | null

export async function acceptInvitation(
  _prevState: AcceptInvitationState,
  formData: FormData
): Promise<AcceptInvitationState> {
  const rawFullName = formData.get('fullName')
  const rawPassword = formData.get('password')

  const parsed = acceptInvitationSchema.safeParse({
    fullName: typeof rawFullName === 'string' ? rawFullName : '',
    password:
      typeof rawPassword === 'string' && rawPassword.length > 0
        ? rawPassword
        : undefined,
  })

  if (!parsed.success) {
    return { error: 'Verifique os campos do formulário e tente novamente.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Google invitees authenticate via Google and set no password. Everyone else
  // (the email-invite link) must choose one — it becomes their only credential,
  // since the invite link is single-use and expires.
  const isGoogleUser = user.app_metadata?.provider === 'google'
  if (!isGoogleUser && !parsed.data.password) {
    return { error: 'Escolha uma senha para concluir a configuração da sua conta.' }
  }

  if (parsed.data.password) {
    const { error: pwError } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })
    if (pwError) {
      return { error: friendlyAuthError(pwError) }
    }
  }

  const { error } = await supabase.rpc('accept_invitation', {
    p_full_name: parsed.data.fullName,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return { error: GENERIC_AUTH_ERROR }
  }

  // Redirect on the server so the refreshed session cookies (active_school_id)
  // travel with the redirect response and the proxy lets /dashboard through.
  redirect('/dashboard')
}

export async function switchSchool(
  schoolId: string
): Promise<AuthActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.rpc('switch_school', {
    p_school_id: schoolId,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return { error: GENERIC_AUTH_ERROR }
  }

  revalidatePath('/', 'layout')
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
