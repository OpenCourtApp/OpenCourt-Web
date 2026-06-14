import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles the PKCE code exchange for BOTH Google OAuth and the email invitation
// link the principal sends via `inviteUserByEmail` (which lands on
// `?next=/welcome`). Both return here with `?code=…` plus the `next` we set in
// `redirectTo`; `exchangeCodeForSession` is identical for either origin.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/dashboard'
  // Only allow relative paths to prevent open redirects
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Behind a load balancer the request origin is the internal host, so
      // prefer the forwarded host when building the redirect URL.
      const forwardedHost = request.headers.get('x-forwarded-host')
      if (process.env.NODE_ENV === 'development' || !forwardedHost) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      return NextResponse.redirect(`https://${forwardedHost}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
