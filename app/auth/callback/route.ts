import { NextResponse, type NextRequest } from 'next/server'
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
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const tokenHash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as EmailOtpType | null
  const nextParam = requestUrl.searchParams.get('next') ?? '/dashboard'
  // Only allow relative paths to prevent open redirects
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  const supabase = await createClient()

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : null

  if (result && !result.error) {
    const response = NextResponse.redirect(new URL(next, requestUrl.origin))
    return response
  }

  return NextResponse.redirect(new URL('/login?error=oauth_failed', requestUrl.origin))
}
