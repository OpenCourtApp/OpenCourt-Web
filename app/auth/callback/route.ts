import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

// Ponte para o fluxo de recuperação em implicit flow. Os tokens chegam no
// fragmento da URL, que só o browser consegue ler — este HTML repassa o hash
// intacto para /reset-password em vez de perder o token num redirect HTTP.
const RECOVERY_BRIDGE_HTML = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>Redefinir senha</title>
  </head>
  <body>
    <script>location.replace('/reset-password' + location.hash)</script>
  </body>
</html>`

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
  const invitationId = requestUrl.searchParams.get('invitation_id')
  // Recuperação de senha sempre termina em /reset-password, independentemente
  // do `next` que vier na URL — o token de recovery não dá acesso ao app.
  // No implicit flow o `type` não vem no query (fica no fragmento da URL),
  // então também reconhecemos pelo `next` que nós mesmos enviamos.
  const requestedNext = requestUrl.searchParams.get('next')
  const isRecovery = type === 'recovery' || requestedNext === '/reset-password'
  const nextParam = isRecovery ? '/reset-password' : requestedNext ?? '/dashboard'
  // Only allow relative paths to prevent open redirects
  const next = nextParam.startsWith('/') ? nextParam : '/dashboard'

  const supabase = await createClient()

  // Convite via link de e-mail (Resend): validar invitation_id no banco
  if (invitationId) {
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .maybeSingle()

    if (inviteError || !invitation) {
      return NextResponse.redirect(
        new URL('/login?error=invitation_not_found', requestUrl.origin)
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?invitation_id=${invitationId}&next=${next}`, requestUrl.origin)
      )
    }

    if (user.email !== invitation.email) {
      return NextResponse.redirect(
        new URL('/login?error=invitation_email_mismatch', requestUrl.origin)
      )
    }

    return NextResponse.redirect(
      new URL(`/welcome?invitation_id=${invitationId}`, requestUrl.origin)
    )
  }

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
      : null

  if (result && !result.error) {
    const response = NextResponse.redirect(new URL(next, requestUrl.origin))
    return response
  }

  // Recuperação de senha em implicit flow: o GoTrue devolve os tokens no
  // FRAGMENTO da URL (#access_token=...), que nunca chega ao servidor. Em vez
  // de falhar para /login?error=oauth_failed, devolvemos um HTML que repassa o
  // fragmento para /reset-password, onde o client monta a sessão.
  if (isRecovery) {
    return new NextResponse(RECOVERY_BRIDGE_HTML, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }

  return NextResponse.redirect(new URL('/login?error=oauth_failed', requestUrl.origin))
}
