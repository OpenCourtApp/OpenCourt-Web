'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { forgotPassword } from '@/lib/auth/actions'
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/auth/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { t } from '@/lib/strings'

export function ForgotPasswordForm({ ...props }: React.ComponentProps<typeof Card>) {
  const [serverError, setServerError] = useState('')
  const [sent, setSent] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    startTransition(async () => {
      const result = await forgotPassword(values)
      if ('error' in result) {
        setServerError(result.error)
      } else {
        setSent(true)
      }
    })
  })

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t.auth.forgotPassword.title}</CardTitle>
        <CardDescription>
          {t.auth.forgotPassword.subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sent ? (
          <div className="grid gap-4">
            <div
              role="status"
              className="rounded-md bg-success/10 p-3 text-sm text-success"
            >
              {t.auth.forgotPassword.sent}
            </div>
            <Link
              href="/login"
              className="text-center text-sm underline underline-offset-4"
            >
              {t.auth.forgotPassword.backToLogin}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="grid gap-4">
            {serverError && (
              <div
                role="alert"
                className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
              >
                {serverError}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="forgot-email">{t.common.email}</Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder={t.common.emailPlaceholder}
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button type="submit" disabled={isPending} className="w-full">
              {isPending
                ? t.auth.forgotPassword.sending
                : t.auth.forgotPassword.submit}
            </Button>

            <div className="text-center text-sm">
              <Link href="/login" className="underline underline-offset-4">
                {t.auth.forgotPassword.backToLogin}
              </Link>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
