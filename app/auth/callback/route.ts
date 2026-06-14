import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Completes authentication for BOTH entry points, which arrive with different
// params:
//  • Google OAuth (and any PKCE flow started in this same browser) → `?code=`.
//    The PKCE verifier cookie was set here when the flow began, so
//    `exchangeCodeForSession` can complete it.
//  • Admin-generated email links — the invitation `inviteUserByEmail` sends
//    (lands on `?next=/welcome`) and magic links → `?token_hash=&type=`. These
//    are opened in the recipient's browser, which never started a PKCE flow, so
//    there is NO verifier cookie and `exchangeCodeForSession` would fail.
//    `verifyOtp` authenticates straight from the emailed token instead.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const nextParam = searchParams.get('next') ?? '/dashboard'
  // Only allow relative paths to prevent open redirects
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  const supabase = await createClient()

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : null

  if (result && !result.error) {
    // Behind a load balancer the request origin is the internal host, so
    // prefer the forwarded host when building the redirect URL.
    const forwardedHost = request.headers.get('x-forwarded-host')
    if (process.env.NODE_ENV === 'development' || !forwardedHost) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(`https://${forwardedHost}${next}`)
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`)
}
