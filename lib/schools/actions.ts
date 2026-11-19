'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GENERIC_AUTH_ERROR, friendlyOnboardingError } from '@/lib/auth/errors'

export type SchoolActionResult = { error: string } | null

export type TransferOwnershipResult = { error: string } | { success: true } | null

export async function deleteSchool(
  _prevState: SchoolActionResult,
  formData: FormData
): Promise<SchoolActionResult> {
  const schoolId = formData.get('schoolId')
  if (typeof schoolId !== 'string' || schoolId.length === 0) {
    return { error: 'Escola inválida.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  if (user.user_metadata?.role !== 'principal') {
    return { error: friendlyOnboardingError('not_authorized') }
  }

  const { error } = await supabase.rpc('delete_school', {
    p_school_id: schoolId,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession()
  if (refreshError) {
    return { error: GENERIC_AUTH_ERROR }
  }

  const hasNextSchool = Boolean(
    refreshed.session?.user.user_metadata?.active_school_id
  )
  redirect(hasNextSchool ? '/dashboard' : '/onboarding')
}

export async function leaveSchool(
  _prevState: SchoolActionResult,
  _formData: FormData
): Promise<SchoolActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }
  if (user.user_metadata?.role === 'principal') {
    return { error: friendlyOnboardingError('principal_cannot_leave') }
  }

  const { error } = await supabase.rpc('leave_school')

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  const { data: refreshed, error: refreshError } =
    await supabase.auth.refreshSession()
  if (refreshError) {
    return { error: GENERIC_AUTH_ERROR }
  }

  const hasNextSchool = Boolean(
    refreshed.session?.user.user_metadata?.active_school_id
  )
  redirect(hasNextSchool ? '/dashboard' : '/onboarding')
}

/**
 * Transfere a gestão da escola ativa para outro membro.
 *
 * O autor continua na escola como professor (mantendo reservas e histórico) e
 * pode sair depois pela própria zona de perigo. A troca é atômica no banco:
 * `transfer_school_ownership` garante que nunca exista escola sem gestor.
 */
export async function transferSchoolOwnership(
  _prevState: TransferOwnershipResult,
  formData: FormData
): Promise<TransferOwnershipResult> {
  const schoolId = formData.get('schoolId')
  const newPrincipalId = formData.get('newPrincipalId')

  if (
    typeof schoolId !== 'string' ||
    schoolId.length === 0 ||
    typeof newPrincipalId !== 'string' ||
    newPrincipalId.length === 0
  ) {
    return { error: 'Selecione um membro para assumir a gestão.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { error } = await supabase.rpc('transfer_school_ownership', {
    p_school_id: schoolId,
    p_new_principal_id: newPrincipalId,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  // O token do autor ainda diz "principal"; sem isso o app continuaria
  // mostrando menus e ações de gestor até o próximo refresh.
  const { error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError) {
    return { error: GENERIC_AUTH_ERROR }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}
