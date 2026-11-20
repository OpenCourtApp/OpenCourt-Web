import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email') ?? ''
  const token = searchParams.get('token') ?? ''

  console.error('[test-verify-direct] chamada recebida:', {
    email,
    tokenLength: token.length,
    tokenPrefix: token.slice(0, 3) + '***',
    hasEmail: Boolean(email),
    hasToken: Boolean(token),
  })

  const supabase = await createClient()
  const { error, data } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'recovery',
  })

  console.error('[test-verify-direct] resultado verifyOtp:', {
    error: error?.message ?? null,
    status: error?.status ?? null,
    code: error?.code ?? null,
    hasSession: !!data?.session,
    hasUser: !!data?.user,
  })

  return NextResponse.json({
    email,
    tokenLength: token.length,
    error: error?.message ?? null,
    status: error?.status ?? null,
    code: error?.code ?? null,
    hasSession: !!data?.session,
    hasUser: !!data?.user,
    data: data ?? null,
  })
}
