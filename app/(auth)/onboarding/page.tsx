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
