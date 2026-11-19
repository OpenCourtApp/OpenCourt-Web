import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { OpenCourtLogo } from '@/components/shared/oc-logo'

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // O callback de recuperação deve ter criado a sessão via verifyOtp.
  // Sem sessão, o link é inválido/expirado — volta para o pedido de reset.
  if (!user) {
    redirect('/forgot-password')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <div className="p-6 md:p-10">
        <Link href="/">
          <OpenCourtLogo className="h-6 w-auto text-foreground" />
        </Link>
      </div>
      <div className="flex flex-1 items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-sm">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  )
}
