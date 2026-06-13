import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/register', '/auth/callback']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
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

  const isOnboarded = Boolean(user.user_metadata?.active_school_id)

  if (!isOnboarded) {
    // Allow /onboarding and /welcome (accepting a first invite)
    if (pathname === '/onboarding' || pathname === '/welcome') {
      return supabaseResponse
    }
    return redirectTo('/onboarding')
  }

  // Fully onboarded: allow /welcome so they can accept additional invites
  if (pathname === '/welcome') {
    return supabaseResponse
  }

  // Redirect away from public/onboarding paths
  if (isPublicPath(pathname) || pathname === '/onboarding') {
    return redirectTo('/dashboard')
  }

  return supabaseResponse
}
