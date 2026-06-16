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

  // No active-org guard here: the only automatic entry to /onboarding is the
  // post-signup redirect (users who have no school yet), and the sidebar's
  // "create new organization" action sends existing members here on purpose.
  // Bouncing org-having users to /dashboard is exactly what broke that button.

  // A brand-new account with a pending invitation (e.g. an invited user who
  // signed in via the generic Google button instead of the invite email link)
  // should accept it rather than create a school. But an already-onboarded
  // gestor lands here on purpose to create an *additional* organization — don't
  // hijack them to /welcome just because they also have a pending invite.
  const isOnboarded = Boolean(user.user_metadata?.active_school_id)
  if (!isOnboarded) {
    const { data: invitation } = await supabase
      .from('invitations')
      .select('id')
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()

    if (invitation) {
      redirect('/welcome')
    }
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
