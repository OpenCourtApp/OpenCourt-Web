import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Role } from '@/types'
import { CollaboratorsView } from '@/components/collaborators/collaborators-view'

export type ActiveMember = {
  type: 'member'
  id: string
  user_id: string
  full_name: string
  email: string
  role: Role
}

export type PendingInvite = {
  type: 'invite'
  id: string
  email: string
  role: Role
  expires_at: string
}

export type CollaboratorRow = ActiveMember | PendingInvite

export default async function CollaboratorsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const activeSchoolId = user.user_metadata?.active_school_id as string | undefined
  if (!activeSchoolId) redirect('/onboarding')

  const [{ data: memberships }, { data: invitations }] = await Promise.all([
    supabase
      .from('memberships')
      .select('id, user_id, role, users(id, full_name, email)')
      .eq('school_id', activeSchoolId)
      .order('role')
      .order('created_at'),
    supabase
      .from('invitations')
      .select('id, email, role, expires_at')
      .eq('school_id', activeSchoolId)
      .eq('status', 'pending'),
  ])

  const members: ActiveMember[] = (memberships ?? []).map((m) => ({
    type: 'member',
    id: m.id,
    user_id: m.user_id,
    full_name: (m.users as { id: string; full_name: string; email: string } | null)?.full_name ?? '',
    email: (m.users as { id: string; full_name: string; email: string } | null)?.email ?? '',
    role: m.role as Role,
  }))

  const pending: PendingInvite[] = (invitations ?? []).map((i) => ({
    type: 'invite',
    id: i.id,
    email: i.email,
    role: i.role as Role,
    expires_at: i.expires_at,
  }))

  return (
    <CollaboratorsView
      members={members}
      pending={pending}
      currentUserId={user.id}
      isPrincipal={user.user_metadata?.role === 'principal'}
    />
  )
}
