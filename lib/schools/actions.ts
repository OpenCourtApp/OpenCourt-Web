'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GENERIC_AUTH_ERROR, friendlyOnboardingError } from '@/lib/auth/errors'

export type SchoolActionResult = { error: string } | null

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
