import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Handles the PKCE code exchange for BOTH Google OAuth and passwordless magic
// links. The @supabase/ssr browser client uses the PKCE flow, so both flows
// return here with `?code=…` (plus the `next` we set in `emailRedirectTo`/
// `redirectTo`); a `?type=magiclink` param, if present, needs no special
// handling since `exchangeCodeForSession` is the same for either origin.
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
