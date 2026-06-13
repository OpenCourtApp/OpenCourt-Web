import type { AuthError } from '@supabase/supabase-js'

export const GENERIC_AUTH_ERROR =
  'Something went wrong while authenticating. Please try again.'

export const OAUTH_CALLBACK_ERROR =
  'Could not sign in with Google. Please try again.'

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Confirm your email before signing in.',
  user_already_exists:
    'An account with this email already exists. Try signing in instead.',
  email_exists:
    'An account with this email already exists. Try signing in instead.',
  weak_password: 'Password is too weak. Use at least 6 characters.',
  over_request_rate_limit: 'Too many attempts. Wait a moment and try again.',
  user_banned: 'This account has been disabled. Contact your principal.',
  provider_disabled:
    'Google sign-in is not enabled. Contact your administrator.',
}

export function friendlyAuthError(error: AuthError): string {
  if (error.code && AUTH_ERROR_MESSAGES[error.code]) {
    return AUTH_ERROR_MESSAGES[error.code]
  }
  return GENERIC_AUTH_ERROR
}

// Keys match the RAISE EXCEPTION messages in the SQL functions
const ONBOARDING_ERROR_MESSAGES: Record<string, string> = {
  not_authenticated:     'Your session has expired. Please sign in again.',
  no_invitation:         'No pending invitation was found for your email address.',
  already_member:        'You are already a member of this school.',
  not_a_member:          'You are not a member of that school.',
  member_already_exists: 'This person is already a member of your school.',
  not_authorized:        'Only principals can perform this action.',
  invitation_not_found:  'Invitation not found or already cancelled.',
  cannot_remove_self:    'You cannot remove your own account.',
  cannot_remove_principal: 'Principals cannot be removed.',
}

export function friendlyOnboardingError(message: string): string {
  const known = Object.keys(ONBOARDING_ERROR_MESSAGES).find((key) =>
    message.includes(key)
  )
  return known ? ONBOARDING_ERROR_MESSAGES[known] : GENERIC_AUTH_ERROR
}
