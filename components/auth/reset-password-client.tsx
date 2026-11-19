'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { t } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

type Status = 'checking' | 'ready' | 'invalid'

/**
 * A recuperação de senha do Supabase usa implicit flow: o link do e-mail
 * redireciona com os tokens no FRAGMENTO da URL (#access_token=...), que o
 * servidor nunca recebe. Por isso a sessão precisa ser montada aqui no client,
 * antes de liberar o formulário de nova senha.
 */
export function ResetPasswordClient() {
  const [status, setStatus] = useState<Status>('checking')

  useEffect(() => {
    let active = true

    async function resolveSession() {
      const supabase = createClient()
      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
      const accessToken = hash.get('access_token')
      const refreshToken = hash.get('refresh_token')
      const hashError = hash.get('error_description') ?? hash.get('error')

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })

        if (error) {
          if (active) setStatus('invalid')
          return
        }

        // Não deixa os tokens no histórico do navegador.
        window.history.replaceState(null, '', window.location.pathname)
      } else if (hashError) {
        if (active) setStatus('invalid')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (active) setStatus(user ? 'ready' : 'invalid')
    }

    resolveSession()

    return () => {
      active = false
    }
  }, [])

  if (status === 'ready') return <ResetPasswordForm />

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {status === 'checking'
            ? t.auth.resetPassword.title
            : t.auth.resetPassword.invalidTitle}
        </CardTitle>
        <CardDescription>
          {status === 'checking'
            ? t.auth.resetPassword.checking
            : t.auth.resetPassword.invalidBody}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {status === 'checking' ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <Button asChild className="w-full">
            <Link href="/forgot-password">
              {t.auth.resetPassword.requestNew}
            </Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
