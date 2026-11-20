import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resetPasswordWithOtpSchema } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()

    const parsed = resetPasswordWithOtpSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Verifique os campos do formulário e tente novamente.' },
        { status: 400 }
      )
    }

    const { email, code, password } = parsed.data

    console.error(
      '[verify-reset-otp] calling verifyOtp:',
      JSON.stringify({
        email,
        codeLength: code.length,
        codePrefix: code.slice(0, 3) + '***',
        type: 'recovery',
      })
    )

    const supabase = await createClient()

    // 1. Valida o código OTP recebido por email.
    const { error: otpError, data: otpData } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'recovery',
    })

    if (otpError) {
      console.error(
        '[verify-reset-otp] verifyOtp error:',
        otpError.code ?? '(sem código)',
        otpError.status,
        otpError.message,
        { email, codeLength: code.length }
      )

      return NextResponse.json(
        { error: 'Código inválido ou expirado. Cada código pode ser usado apenas uma vez.' },
        { status: 403 }
      )
    }

    console.error(
      '[verify-reset-otp] verifyOtp success:',
      JSON.stringify({
        email,
        hasSession: !!otpData?.session,
        hasUser: !!otpData?.user,
      })
    )

    // 2. Redefine a senha enquanto a sessão temporária está ativa.
    const { error: pwError } = await supabase.auth.updateUser({
      password,
    })

    if (pwError) {
      return NextResponse.json(
        { error: 'Não foi possível redefinir a senha. Tente novamente.' },
        { status: 400 }
      )
    }

    // 3. Encerra a sessão temporária.
    await supabase.auth.signOut()

    console.error('[verify-reset-otp] password reset completed successfully')

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[verify-reset-otp] unexpected error:', err)
    return NextResponse.json(
      { error: 'Erro interno do servidor. Tente novamente.' },
      { status: 500 }
    )
  }
}
