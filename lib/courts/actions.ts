'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  COURT_HAS_BOOKINGS_ERROR,
  DUPLICATE_COURT_ERROR,
  GENERIC_COURT_ERROR,
  NO_ACTIVE_SCHOOL_ERROR,
  NOT_PRINCIPAL_ERROR,
} from '@/lib/courts/errors'
import {
  createCourtSchema,
  deleteCourtSchema,
  renameCourtSchema,
  type CreateCourtInput,
  type RenameCourtInput,
} from '@/lib/courts/validation'

export type CourtActionResult = { error: string } | undefined

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

type PrincipalContext =
  | { ok: false; error: string }
  | { ok: true; supabase: SupabaseServerClient; activeSchoolId: string }

async function requirePrincipal(): Promise<PrincipalContext> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (user.user_metadata?.role !== 'principal') {
    return { ok: false, error: NOT_PRINCIPAL_ERROR }
  }

  const activeSchoolId = user.user_metadata?.active_school_id as
    | string
    | undefined
  if (!activeSchoolId) return { ok: false, error: NO_ACTIVE_SCHOOL_ERROR }

  return { ok: true, supabase, activeSchoolId }
}

export async function createCourt(
  input: CreateCourtInput
): Promise<CourtActionResult> {
  const parsed = createCourtSchema.safeParse(input)
  if (!parsed.success) return { error: 'Enter a valid court name.' }

  const principal = await requirePrincipal()
  if (!principal.ok) return { error: principal.error }
  const { supabase, activeSchoolId } = principal

  const { error } = await supabase.from('courts').insert({
    school_id: activeSchoolId,
    name: parsed.data.name,
  })

  if (error) {
    if (error.code === '23505') return { error: DUPLICATE_COURT_ERROR }
    return { error: GENERIC_COURT_ERROR }
  }
}

export async function renameCourt(
  input: RenameCourtInput
): Promise<CourtActionResult> {
  const parsed = renameCourtSchema.safeParse(input)
  if (!parsed.success) return { error: 'Enter a valid court name.' }

  const principal = await requirePrincipal()
  if (!principal.ok) return { error: principal.error }
  const { supabase, activeSchoolId } = principal

  const { error } = await supabase
    .from('courts')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.courtId)
    .eq('school_id', activeSchoolId)

  if (error) {
    if (error.code === '23505') return { error: DUPLICATE_COURT_ERROR }
    return { error: GENERIC_COURT_ERROR }
  }
}

export async function deleteCourt(courtId: string): Promise<CourtActionResult> {
  const parsed = deleteCourtSchema.safeParse({ courtId })
  if (!parsed.success) return { error: GENERIC_COURT_ERROR }

  const principal = await requirePrincipal()
  if (!principal.ok) return { error: principal.error }
  const { supabase, activeSchoolId } = principal

  const { error } = await supabase
    .from('courts')
    .delete()
    .eq('id', parsed.data.courtId)
    .eq('school_id', activeSchoolId)

  if (error) {
    // FK violation — the court is still referenced by bookings.
    if (error.code === '23503') return { error: COURT_HAS_BOOKINGS_ERROR }
    return { error: GENERIC_COURT_ERROR }
  }
}
