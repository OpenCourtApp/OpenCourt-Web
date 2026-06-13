'use server'

import { headers } from 'next/headers'
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
  type AcceptInvitationInput,
  type CreateSchoolInput,
  type SignInInput,
  type SignUpInput,
} from '@/lib/auth/validation'

export type AuthActionResult = { error: string } | undefined

const INVALID_INPUT: AuthActionResult = {
  error: 'Check the form fields and try again.',
}

async function resolveOrigin(): Promise<string> {
  const origin = (await headers()).get('origin')
  return origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

export async function signIn(input: SignInInput): Promise<AuthActionResult> {
  const parsed = signInSchema.safeParse(input)
  if (!parsed.success) return INVALID_INPUT

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    return { error: friendlyAuthError(error) }
  }

  redirect('/dashboard')
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

export async function signInWithGoogle(): Promise<AuthActionResult> {
  const supabase = await createClient()
  const origin = await resolveOrigin()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    return { error: friendlyAuthError(error) }
  }

  redirect(data.url)
}

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

export async function acceptInvitation(
  input: AcceptInvitationInput
): Promise<AuthActionResult> {
  const parsed = acceptInvitationSchema.safeParse(input)
  if (!parsed.success) return INVALID_INPUT

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Set password when the invitee came via email link and wants one
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
