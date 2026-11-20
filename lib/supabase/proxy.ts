import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/forgot-password',
  '/verify-reset-code',
  '/auth/callback',
  '/api/ping',
  '/api/test-recovery',
  '/api/test-verify-otp',
  '/api/test-verify-direct',
]

// Páginas de auth que também devem ser acessíveis quando já há sessão
// (ex.: a sessão temporária de recovery criada pelo callback), sem o
// redirect automático para /dashboard.
const AUTH_FLOW_PATHS = ['/auth/callback', '/verify-reset-code']

// Páginas acessíveis mesmo sem escola ativa. `/account/delete-confirmation` é
// o destino após um principal excluir a própria escola: ali ele pode excluir a
// conta ou seguir para o onboarding.
const NO_ONBOARDING_PATHS = [
  '/onboarding',
  '/welcome',
  '/account/delete-confirmation',
]

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

function isNoOnboardingPath(pathname: string): boolean {
  return NO_ONBOARDING_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export async function updateSession(
  request: NextRequest
): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Treat Supabase outages as "no session" instead of crashing every request
  }

  const { pathname } = request.nextUrl

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const response = NextResponse.redirect(url)
    supabaseResponse.cookies
      .getAll()
      .forEach((cookie) => response.cookies.set(cookie))
    return response
  }

  if (!user) {
    return isPublicPath(pathname) ? supabaseResponse : redirectTo('/login')
  }

  // OAuth callback must always complete with a session present
  if (pathname.startsWith('/auth/callback')) {
    return supabaseResponse
  }

  // Recovery flow pages must remain reachable with the temporary session
  // created by the callback — do not bounce them to /dashboard or /onboarding.
  if (
    AUTH_FLOW_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`)
    )
  ) {
    return supabaseResponse
  }

  const isOnboarded = Boolean(user.user_metadata?.active_school_id)

  if (!isOnboarded) {
    // Allow /onboarding, /welcome (accepting a first invite) and the account
    // deletion confirmation reached after a principal deletes their school.
    return isNoOnboardingPath(pathname)
      ? supabaseResponse
      : redirectTo('/onboarding')
  }

  // Fully onboarded users still reach these intentionally from the in-app
  // school switcher: /welcome to accept another school's invite, /onboarding
  // to create an additional organization. Bouncing them to /dashboard is what
  // made the "Criar organização" button appear to do nothing.
  if (pathname === '/welcome' || pathname === '/onboarding') {
    return supabaseResponse
  }

  // Redirect away from public/auth paths
  if (isPublicPath(pathname)) {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}
