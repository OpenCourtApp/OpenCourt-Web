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
  over_request_rate_limit:
    'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
  user_banned: 'Esta conta foi desativada. Fale com o gestor.',
  provider_disabled:
    'O login com o Google não está habilitado. Fale com o administrador.',
  email_address_invalid: 'Insira um endereço de email válido.',
  email_address_not_authorized:
    'Não foi possível enviar o email para este endereço. Fale com o suporte.',
  same_password:
    'A nova senha precisa ser diferente da senha atual.',
  session_not_found: 'Sua sessão expirou. Solicite um novo link.',
  session_expired: 'Sua sessão expirou. Solicite um novo link.',
  reauthentication_needed: 'Confirme sua identidade para continuar.',
  otp_expired: 'Este link expirou. Solicite um novo.',
  invalid_otp: 'Código inválido ou expirado. Solicite um novo.',
}

// `over_email_send_rate_limit` cobre duas situações diferentes no Supabase:
// o limite do projeto (2 emails por hora no provedor padrão) e a janela de
// 60 segundos por endereço. Só a mensagem da API distingue as duas.
export const EMAIL_PROJECT_RATE_LIMIT =
  'O limite de envio de emails do serviço foi atingido. Aguarde cerca de uma hora e tente novamente.'

export const EMAIL_USER_RATE_LIMIT =
  'Aguarde cerca de um minuto antes de solicitar outro email.'

// Mensagens específicas para quando o email já está cadastrado, diferenciando
// se a conta existente é do Google ou de email/senha.
export const EMAIL_ALREADY_EXISTS_GOOGLE =
  'Este email já está cadastrado com o Google. Entre com o Google.'

export const EMAIL_ALREADY_EXISTS_PASSWORD =
  'Já existe uma conta com este email. Tente entrar.'

export const PRINCIPAL_CANNOT_DELETE_ACCOUNT =
  'Você é o gestor de uma escola. Transfira a gestão ou exclua a escola antes de excluir sua conta.'

export function friendlyAuthError(error: AuthError): string {
  if (error.code === 'over_email_send_rate_limit') {
    // A mensagem do GoTrue para a janela por endereço começa com
    // "For security purposes, you can only request this after N seconds".
    return /security purposes/i.test(error.message)
      ? EMAIL_USER_RATE_LIMIT
      : EMAIL_PROJECT_RATE_LIMIT
  }

  // 429 sem código reconhecível também é limite de requisições.
  if (error.status === 429) {
    return AUTH_ERROR_MESSAGES.over_request_rate_limit
  }

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
  not_active_school:     'Esta não é a sua escola ativa.',
  no_active_school:      'Você não tem uma escola ativa.',
  principal_cannot_leave:'Gestores não podem sair da escola. Exclua a escola ou transfira a gestão.',
  cannot_transfer_to_self:'Você já é o gestor desta escola.',
  already_principal:     'Este membro já é gestor desta escola.',
}

export function friendlyOnboardingError(message: string): string {
  const known = Object.keys(ONBOARDING_ERROR_MESSAGES).find((key) =>
    message.includes(key)
  )
  return known ? ONBOARDING_ERROR_MESSAGES[known] : GENERIC_AUTH_ERROR
}
