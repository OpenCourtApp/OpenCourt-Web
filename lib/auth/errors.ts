import type { AuthError } from '@supabase/supabase-js'

export const GENERIC_AUTH_ERROR =
  'Algo deu errado durante a autenticação. Tente novamente.'

export const OAUTH_CALLBACK_ERROR =
  'Não foi possível entrar com o Google. Tente novamente.'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Email ou senha incorretos.',
  email_not_confirmed: 'Confirme seu email antes de entrar.',
  user_already_exists:
    'Já existe uma conta com este email. Tente entrar.',
  email_exists:
    'Já existe uma conta com este email. Tente entrar.',
  weak_password: 'A senha é muito fraca. Use pelo menos 6 caracteres.',
  over_request_rate_limit: 'Muitas tentativas. Aguarde um momento e tente novamente.',
  user_banned: 'Esta conta foi desativada. Fale com o gestor.',
  provider_disabled:
    'O login com o Google não está habilitado. Fale com o administrador.',
}

export function friendlyAuthError(error: AuthError): string {
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code]
  }
  return GENERIC_AUTH_ERROR
}

// Keys match the RAISE EXCEPTION messages in the SQL functions
const ONBOARDING_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated:     'Sua sessão expirou. Entre novamente.',
  no_invitation:         'Nenhum convite pendente foi encontrado para o seu email.',
  already_member:        'Você já é membro desta escola.',
  not_a_member:          'Você não é membro dessa escola.',
  member_already_exists: 'Esta pessoa já é membro da sua escola.',
  not_authorized:        'Apenas gestores podem realizar esta ação.',
  invitation_not_found:  'Convite não encontrado ou já cancelado.',
  cannot_remove_self:    'Você não pode remover a sua própria conta.',
  cannot_remove_principal: 'Gestores não podem ser removidos.',
}

export function friendlyOnboardingError(message: string): string {
  const known = Object.keys(ONBOARDING_ERROR_MESSAGES).find((key) =>
    message.includes(key)
  )
  return known ? ONBOARDING_ERROR_MESSAGES[known] : GENERIC_AUTH_ERROR
}
