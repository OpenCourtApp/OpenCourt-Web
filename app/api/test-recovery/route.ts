import { NextResponse } from 'next/server'
import { createAdminClient, hasAdminKey } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  const results: Record<string, unknown> = {}

  // 1. Verifica se a service role key existe
  results.hasAdminKey = hasAdminKey()
  if (!hasAdminKey()) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY não definida' }, { status: 500 })
  }

  const email = 'brenousandoia@gmail.com'
  const admin = createAdminClient()

  // 2. Gera o código de recovery via resetPasswordForEmail (anon client, como o app faz)
  const supabase = await createClient()
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://open-court-web-breno-vs-projects.vercel.app/verify-reset-code?email=brenousandoia@gmail.com',
  })
  results.resetPasswordForEmail = { error: resetError?.message ?? null, status: resetError?.status ?? null }

  // Pequena pausa para o Supabase gravar o one_time_token
  await new Promise((r) => setTimeout(r, 1000))

  // 3. Acessa a tabela one_time_tokens via admin para ver o que foi gerado
  let oneTimeTokens: unknown = null
  let otpToken: string | null = null
  try {
    const { data, error } = await admin
      .from('one_time_tokens')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(5)

    results.oneTimeTokensError = error?.message ?? null
    oneTimeTokens = data
    if (data && Array.isArray(data) && data.length > 0) {
      // O token pode estar em diferentes colunas dependendo da versão do Supabase
      const row = data[0] as Record<string, unknown> | null
      otpToken = (
        row?.[
          'token' as keyof Record<string, unknown>
        ] ??
        row?.[
          'otp' as keyof Record<string, unknown>
        ] ??
        row?.[
          'hash' as keyof Record<string, unknown>
        ] ??
        null
      ) as string | null
      results.tokenField = otpToken
      results.oneTimeTokenRow = {
        id: row?.[
          'id' as keyof Record<string, unknown>
        ],
        email: row?.[
          'email' as keyof Record<string, unknown>
        ],
        type: row?.[
          'type' as keyof Record<string, unknown>
        ],
        used: row?.[
          'used' as keyof Record<string, unknown>
        ],
        expires_at: row?.[
          'expires_at' as keyof Record<string, unknown>
        ],
        created_at: row?.[
          'created_at' as keyof Record<string, unknown>
        ],
      }
    }
  } catch (e) {
    results.oneTimeTokensError = e instanceof Error ? e.message : String(e)
  }

  // 4. Tenta verifyOtp com o token extraído (OTP numérico)
  let verifyResult: unknown = null
  if (otpToken) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpToken,
      type: 'recovery',
    })
    verifyResult = { error: error?.message ?? null, status: error?.status ?? null, data: data ?? null }
  }
  results.verifyOtpWithExtractedToken = verifyResult

  // 5. Testa generateLink com service role (fluxo por token_hash) para comparação
  let generateLinkResult: unknown = null
  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
    })
    generateLinkResult = { error: error?.message ?? null, data: data ?? null }
  } catch (e) {
    generateLinkResult = { error: e instanceof Error ? e.message : String(e) }
  }
  results.generateLinkWithServiceRole = generateLinkResult

  // 6. Se gerou token_hash, tenta verifyOtp com token_hash
  let verifyHashResult: unknown = null
  const glr = generateLinkResult as Record<string, unknown> | null
  if (glr && !('error' in glr) && glr['data']) {
    const linkData = glr['data'] as Record<string, unknown>
    const properties = (linkData['properties'] as Record<string, unknown> | undefined)
    const tokenHash = properties?.['action_link'] as string | undefined
    // O action_link contém o token_hash como query param
    const hashMatch = tokenHash?.match(/token_hash=([^&]+)/)
    if (hashMatch) {
      const { data, error } = await supabase.auth.verifyOtp({
        token_hash: hashMatch[1],
        type: 'recovery',
      })
      verifyHashResult = { error: error?.message ?? null, status: error?.status ?? null, data: data ?? null }
    }
  }
  results.verifyOtpWithTokenHash = verifyHashResult

  return NextResponse.json(results)
}
