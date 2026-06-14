import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from '@/components/onboarding-form'
import { OpenCourtLogo } from '@/components/shared/oc-logo'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  if (user.user_metadata?.active_school_id) {
    redirect('/dashboard')
  }

  // If this account has a pending invitation (e.g. an invited user who signed in
  // via the generic Google button instead of the invite email link), send them to
  // accept it rather than create a new school. RLS scopes this to their email.
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id')
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  if (invitation) {
    redirect('/welcome')
  }

  const defaultFullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    ''

  return (
    <div className="flex min-h-svh flex-col">
      <div className="p-6 md:p-10">
        <Link href="/">
          <OpenCourtLogo className="h-6 w-auto text-foreground" />
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <OnboardingForm
            email={user.email ?? ''}
            defaultFullName={defaultFullName}
          />
        </div>
      </div>
    </div>
  )
}
