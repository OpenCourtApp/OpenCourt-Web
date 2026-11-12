'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { hasAdminKey } from '@/lib/supabase/admin'
import { friendlyOnboardingError } from '@/lib/auth/errors'
import {
  GENERIC_COLLABORATOR_ERROR,
  MISSING_ADMIN_KEY_ERROR,
  NOT_PRINCIPAL_ERROR,
} from '@/lib/collaborators/errors'
import {
  inviteMemberSchema,
  removeMemberSchema,
  revokeInvitationSchema,
  type InviteMemberInput,
} from '@/lib/collaborators/validation'
import { sendInviteEmail } from '@/lib/email/resend'

export type CollaboratorActionResult = { error: string } | undefined

async function resolveOrigin(): Promise<string> {
  const origin = (await headers()).get('origin')
  return origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
}

async function requirePrincipal() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  if (user.user_metadata?.role !== 'principal') {
    return { error: NOT_PRINCIPAL_ERROR } as const
  }

  return { supabase, user } as const
}

export async function inviteMember(
  input: InviteMemberInput
): Promise<CollaboratorActionResult> {
  const parsed = inviteMemberSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Check the form fields and try again.' }
  }

  const principal = await requirePrincipal()
  if ('error' in principal) return { error: principal.error as string }
  const { supabase } = principal

  if (!hasAdminKey()) return { error: MISSING_ADMIN_KEY_ERROR }

  const { email, role } = parsed.data

  // invite_member validates principal + dedup, writes invitations row
  const { data: invitationId, error: rpcError } = await supabase.rpc(
    'invite_member',
    { p_email: email, p_role: role }
  )

  if (rpcError) {
    return { error: friendlyOnboardingError(rpcError.message) }
  }

  const origin = await resolveOrigin()

  // Envia email de convite via Resend com link para o callback
  const inviteUrl = `${origin}/auth/callback?invitation_id=${invitationId}&type=invite&next=/welcome`

  try {
    await sendInviteEmail({ email, inviteUrl })
  } catch {
    // Se falhar o envio do e-mail, o convite já está no banco.
    // O usuário pode tentar reenviar depois.
    return { error: 'Convite criado, mas falha ao enviar e-mail. Tente reenviar.' }
  }

  revalidatePath('/collaborators')
}

export async function revokeInvitation(
  invitationId: string
): Promise<CollaboratorActionResult> {
  const parsed = revokeInvitationSchema.safeParse({ invitationId })
  if (!parsed.success) return { error: GENERIC_COLLABORATOR_ERROR }

  const principal = await requirePrincipal()
  if ('error' in principal) return { error: principal.error as string }
  const { supabase } = principal

  const { error } = await supabase.rpc('revoke_invitation', {
    p_invitation_id: invitationId,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  revalidatePath('/collaborators')
}

export async function removeMember(
  userId: string
): Promise<CollaboratorActionResult> {
  const parsed = removeMemberSchema.safeParse({ userId })
  if (!parsed.success) return { error: GENERIC_COLLABORATOR_ERROR }

  const principal = await requirePrincipal()
  if ('error' in principal) return { error: principal.error as string }
  const { supabase, user: principalUser } = principal

  if (userId === principalUser.id) {
    return { error: 'You cannot remove your own account.' }
  }

  const { error } = await supabase.rpc('remove_member', {
    p_user_id: userId,
  })

  if (error) {
    return { error: friendlyOnboardingError(error.message) }
  }

  revalidatePath('/collaborators')
}
