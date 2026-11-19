'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'
import {
  friendlyAuthError,
  friendlyOnboardingError,
  GENERIC_AUTH_ERROR,
  EMAIL_ALREADY_EXISTS_GOOGLE,
  EMAIL_ALREADY_EXISTS_PASSWORD,
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

  // Verifica proativamente se o email já está cadastrado no Supabase Auth,
  // para dar um erro claro e diferenciado (Google vs email/senha) antes de
  // tentar criar a conta — evitando que o usuário pense que cadastrou quando
  // na verdade o email já existe (ex: conta criada pelo Google).
  if (hasAdminKey()) {
    const admin = createAdminClient()
    let page = 1
    let usersData: { users: Array<{ email?: string | null; app_metadata?: Record<string, unknown> | null }> } | null = null

    // Percorre as páginas de usuários procurando pelo email. O SDK instalado
    // não suporta filtro por email em listUsers(), então filtramos localmente.
    do {
      const { data, error: listError } = await admin.auth.admin.listUsers({
        page,
        perPage: 100,
      })
      if (listError || !data?.users) break
      usersData = data
      const found = usersData.users.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase()
      )
      if (found) {
        const isGoogle = found.app_metadata?.provider === 'google'
        return {
          error: isGoogle ? EMAIL_ALREADY_EXISTS_GOOGLE : EMAIL_ALREADY_EXISTS_PASSWORD,
        }
      }
      page++
    } while (usersData?.users?.length === 100)
  }

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
