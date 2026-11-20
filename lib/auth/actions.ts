'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'
import {
  friendlyAuthError,
  friendlyOnboardingError,
  GENERIC_AUTH_ERROR,
  EMAIL_ALREADY_EXISTS_GOOGLE,
  EMAIL_ALREADY_EXISTS_PASSWORD,
  PRINCIPAL_CANNOT_DELETE_ACCOUNT,
} from '@/lib/auth/errors'
import {
  acceptInvitationSchema,
  createSchoolSchema,
  forgotPasswordSchema,
  resetPasswordWithOtpSchema,
  signInSchema,
  signUpSchema,
  type CreateSchoolInput,
  type ForgotPasswordInput,
  type ResetPasswordWithOtpInput,
  type SignInInput,
  type SignUpInput,
} from '@/lib/auth/validation'

export type AuthActionResult = { error: string } | undefined

const INVALID_INPUT: AuthActionResult = {
  error: 'Verifique os campos do formulário e tente novamente.',
}

const INVALID_CREDENTIALS = 'Email ou senha incorretos.'

/**
 * Procura os provedores de autenticação de um email.
 *
 * A Admin API (`listUsers`) não é confiável neste projeto: o GoTrue responde
 * 500 ("Database error finding users") ao serializar um dos registros de
 * auth.users, o que fazia a checagem falhar em silêncio e cair na mensagem
 * genérica de "email já cadastrado". Por isso consultamos a RPC
 * `auth_email_providers` (SECURITY DEFINER), que lê auth.users direto.
 *
 * Retorna `null` quando o email não está cadastrado ou quando não há service
 * role key / a migração da RPC ainda não foi aplicada.
 */
async function findAuthProviders(email: string): Promise<string[] | null> {
  if (!hasAdminKey()) return null

  const admin = createAdminClient()

  const { data, error } = await admin.rpc('auth_email_providers', {
    p_email: email,
  })

  if (!error && Array.isArray(data)) {
    return data.length > 0 ? (data as string[]) : null
  }

  if (error) {
    console.error('[findAuthProviders] rpc failed:', error)
  }

  // Fallback para ambientes sem a migração: pagina a Admin API. Se a listagem
  // falhar, desistimos — é melhor não bloquear o cadastro por um erro nosso.
  return findProvidersViaAdminApi(admin, email)
}

/**
 * Plano B para quando a RPC não existe.
 *
 * `listUsers` com `perPage` grande responde 500 neste projeto por causa de um
 * registro corrompido em auth.users; páginas de 5 usuários funcionam. Tentamos
 * primeiro a página grande (rápida em ambientes saudáveis) e depois páginas
 * pequenas, limitadas às 100 contas mais recentes.
 */
async function findProvidersViaAdminApi(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string[] | null> {
  const target = email.toLowerCase()

  for (const perPage of [100, 5]) {
    const maxPages = perPage === 100 ? 10 : 20

    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage })

      if (error || !data?.users) break

      const found = data.users.find(
        (candidate) => candidate.email?.toLowerCase() === target
      )

      if (found) {
        const providers = new Set<string>()
        const primary = found.app_metadata?.provider
        const list = found.app_metadata?.providers
        if (typeof primary === 'string') providers.add(primary)
        if (Array.isArray(list)) {
          for (const provider of list) {
            if (typeof provider === 'string') providers.add(provider)
          }
        }
        for (const identity of found.identities ?? []) {
          if (identity.provider) providers.add(identity.provider)
        }
        return [...providers]
      }

      if (data.users.length < perPage) break
    }
  }

  return null
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
    // Email cadastrado apenas via Google não tem senha: o Supabase responde
    // "credenciais inválidas" e o usuário não entende que precisa usar o
    // botão do Google. Nesse caso específico trocamos a mensagem.
    if (error.code === 'invalid_credentials') {
      const providers = await findAuthProviders(parsed.data.email)
      const onlyGoogle =
        providers !== null &&
        providers.includes('google') &&
        !providers.includes('email')

      if (onlyGoogle) {
        return { error: EMAIL_ALREADY_EXISTS_GOOGLE }
      }

      return { error: INVALID_CREDENTIALS }
    }

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
  const providers = await findAuthProviders(email)
  if (providers) {
    return {
      error: providers.includes('google')
        ? EMAIL_ALREADY_EXISTS_GOOGLE
        : EMAIL_ALREADY_EXISTS_PASSWORD,
    }
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

  // O Supabase retorna um usuário "fantasma" (identities vazio) quando o email
  // já está cadastrado e a confirmação de email está ativa — sem erro, para não
  // revelar a existência da conta. Sem esta checagem o usuário era enviado para
  // /login achando que havia criado uma conta nova.
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    // A pré-checagem acima só roda com a service role key disponível; quando
    // ela falha, tentamos ao menos identificar o provedor para não sugerir
    // "email e senha" a quem entrou pelo Google.
    const ghostProviders = await findAuthProviders(email)

    return {
      error:
        ghostProviders?.includes('google')
          ? EMAIL_ALREADY_EXISTS_GOOGLE
          : EMAIL_ALREADY_EXISTS_PASSWORD,
    }
  }

  redirect(data.session ? '/onboarding' : '/login')
}

// Google OAuth is initiated client-side (browser client must own the PKCE
// verifier + cross-origin redirect) — see components/google-sign-in-button.tsx.
// The /auth/callback route handles exchangeCodeForSession server-side.

/**
 * Resultado do envio de código de recuperação por OTP.
 * Sempre retorna sucesso quando o e-mail é válido, para não revelar se a conta
 * existe (evita enumeração de e-mails).
 */
export type SendResetOtpResult = { success: true } | { error: string }

/**
 * Envia um código de recuperação por e-mail para recuperação de senha.
 * Usa resetPasswordForEmail do Supabase Auth, que dispara o email com o
 * token de recovery. O corpo do email deve conter apenas {{ .Token }} como
 * texto puro (sem link), para que o rastreamento de cliques da Brevo não
 * corrompa o código.
 */
export async function sendResetOtp(
  input: ForgotPasswordInput
): Promise<SendResetOtpResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Insira um endereço de email válido.' }
  }

  const supabase = await createClient()
  const origin =
    (await headers()).get('origin') ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: `${origin}/verify-reset-code?email=${encodeURIComponent(parsed.data.email)}`,
    }
  )

  if (error) {
    console.error(
      '[sendResetOtp] supabase auth error:',
      error.code ?? '(sem código)',
      error.status,
      error.message
    )
    return { error: friendlyAuthError(error) }
  }

  return { success: true }
}

/**
 * Verifica o código OTP recebido por email, cria uma sessão temporária e
 * redefine a senha do usuário. Após a redefinição, encerra a sessão para
 * não deixar o usuário autenticado com um token de uso único.
 */
export type ResetPasswordWithOtpState = { error: string } | null

export async function resetPasswordWithOtp(
  _prevState: ResetPasswordWithOtpState,
  formData: FormData
): Promise<ResetPasswordWithOtpState> {
  const rawEmail = formData.get('email')
  const rawCode = formData.get('code')
  const rawPassword = formData.get('password')
  const rawConfirmPassword = formData.get('confirmPassword')

  const parsed = resetPasswordWithOtpSchema.safeParse({
    email: typeof rawEmail === 'string' ? rawEmail : '',
    code: typeof rawCode === 'string' ? rawCode : '',
    password: typeof rawPassword === 'string' ? rawPassword : '',
    confirmPassword:
      typeof rawConfirmPassword === 'string' ? rawConfirmPassword : '',
  })

  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        'Verifique os campos do formulário e tente novamente.',
    }
  }

  const supabase = await createClient()

  // 1. Valida o código OTP recebido por email. O valor do {{ .Token }} no
  // template é o OTP numérico ("token"), não o hash do link ("token_hash"),
  // então usamos o parâmetro `token`. Isso cria uma sessão temporária no
  // cookie do navegador.
  const { error: otpError } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.code,
    type: 'recovery',
  })

  if (otpError) {
    console.error(
      '[resetPasswordWithOtp] verifyOtp error:',
      otpError.code ?? '(sem código)',
      otpError.status,
      otpError.message
    )
    return { error: 'Código inválido ou expirado. Solicite um novo.' }
  }

  // 2. Redefine a senha enquanto a sessão temporária está ativa.
  const { error: pwError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (pwError) {
    return { error: friendlyAuthError(pwError) }
  }

  // 3. Encerra a sessão temporária: o usuário precisa logar com a nova senha.
  await supabase.auth.signOut()

  redirect('/login')
}

export type AccountDeletionStatus = {
  email: string
  isPrincipal: boolean
  /** Escolas em que o usuário é gestor; vazio quando não é principal. */
  principalSchools: string[]
}

/**
 * Dados necessários para renderizar (e bloquear) a exclusão de conta.
 * A checagem de gestão usa o admin client porque a RLS de memberships só
 * expõe a escola ativa; sem isso, um gestor de escola não-ativa veria o botão
 * de exclusão indevidamente.
 */
export async function getAccountDeletionStatus(): Promise<AccountDeletionStatus | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const email = user.email ?? ''

  const query = hasAdminKey()
    ? createAdminClient()
    : supabase

  const { data: memberships } = await query
    .from('memberships')
    .select('role, schools(name)')
    .eq('user_id', user.id)

  const principalSchools = (memberships ?? [])
    .filter((membership) => membership.role === 'principal')
    .map((membership) => {
      const school = (
        Array.isArray(membership.schools)
          ? membership.schools[0]
          : membership.schools
      ) as { name: string } | null

      return school?.name ?? ''
    })
    .filter(Boolean)

  return {
    email,
    isPrincipal: principalSchools.length > 0,
    principalSchools,
  }
}

export type DeleteAccountState = { error: string } | null

/**
 * Exclui permanentemente a conta do usuário autenticado.
 *
 * Regras:
 *  - O email digitado na confirmação precisa bater com o email da conta.
 *  - Um principal de qualquer escola é bloqueado: a escola não pode ficar sem
 *    gestor. Ele deve transferir a gestão ou excluir a escola antes.
 *  - A exclusão em si usa o admin client (service role), pois remover um
 *    auth.user exige privilégio administrativo. A cascata do banco limpa
 *    users, memberships, bookings e zera invitations.invited_by.
 */
export async function deleteAccount(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const confirmEmail = formData.get('confirmEmail')
  if (
    typeof confirmEmail !== 'string' ||
    confirmEmail.trim().toLowerCase() !== user.email?.toLowerCase()
  ) {
    return { error: 'O email digitado não confere com o da sua conta.' }
  }

  if (!hasAdminKey()) {
    return {
      error:
        'Não foi possível excluir a conta agora. Tente novamente mais tarde.',
    }
  }

  const admin = createAdminClient()

  // Bloqueia se o usuário for principal de QUALQUER escola, não apenas da
  // ativa: nenhuma escola pode ficar sem gestor. A consulta usa o admin client
  // porque a policy de RLS de memberships só expõe vínculos da escola ativa —
  // com o client do usuário, uma gestão em escola não-ativa passaria batido.
  const { data: memberships, error: membershipsError } = await admin
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)

  if (membershipsError) {
    console.error('[deleteAccount] memberships lookup failed:', membershipsError)
    return { error: GENERIC_AUTH_ERROR }
  }

  if (memberships?.some((membership) => membership.role === 'principal')) {
    return { error: PRINCIPAL_CANNOT_DELETE_ACCOUNT }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id)

  if (error) {
    console.error('[deleteAccount] admin.deleteUser failed:', error)
    return { error: GENERIC_AUTH_ERROR }
  }

  await supabase.auth.signOut()
  redirect('/login')
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
