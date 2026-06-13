import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OpenCourtLogo } from '@/components/shared/oc-logo'
import { WelcomeForm } from '@/components/auth/welcome-form'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { signOut } from '@/lib/auth/actions'

export default async function WelcomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Find a pending, non-expired invitation for the authenticated email
  const { data: invitation } = await supabase
    .from('invitations')
    .select('*, schools(name)')
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .maybeSingle()

  const defaultFullName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name  as string | undefined) ??
    ''

  const isGoogleUser = user.app_metadata?.provider === 'google'

  return (
    <div className="flex min-h-svh flex-col">
      <div className="p-6 md:p-10">
        <Link href="/">
          <OpenCourtLogo className="h-6 w-auto text-foreground" />
        </Link>
      </div>

      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          {invitation ? (
            <WelcomeForm
              invitation={invitation as {
                id: string
                role: 'teacher' | 'student_rep'
                schools: { name: string } | null
              }}
              defaultFullName={defaultFullName}
              isGoogleUser={isGoogleUser}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>No invitation found</CardTitle>
                <CardDescription>
                  There is no pending invitation for{' '}
                  <span className="font-medium">{user.email}</span>. You can
                  create your own organization instead.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                <Button asChild>
                  <Link href="/onboarding">Create an organization</Link>
                </Button>
                <form
                  action={async () => {
                    'use server'
                    await signOut()
                  }}
                >
                  <Button type="submit" variant="ghost" className="w-full">
                    Sign out
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
