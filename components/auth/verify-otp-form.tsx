'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  OTP_CODE_LENGTH,
  resetPasswordWithOtpSchema,
  type ResetPasswordWithOtpInput,
} from '@/lib/auth/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { t } from '@/lib/strings'

export function VerifyOtpForm({
  defaultEmail,
  ...props
}: React.ComponentProps<typeof Card> & { defaultEmail?: string }) {
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordWithOtpInput>({
    resolver: zodResolver(resetPasswordWithOtpSchema),
    mode: 'onChange',
    defaultValues: {
      email: defaultEmail ?? '',
      code: '',
      password: '',
      confirmPassword: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError('')
    startTransition(async () => {
      try {
        const response = await fetch('/api/verify-reset-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: values.email,
            code: values.code,
            password: values.password,
            confirmPassword: values.confirmPassword,
          }),
        })

        const result = await response.json()

        if (!response.ok) {
          setServerError(result.error || 'Código inválido ou expirado.')
          return
        }

        // Sucesso: redireciona para /login
        window.location.href = '/login'
      } catch (err) {
        console.error('[verify-otp-form] fetch error:', err)
        setServerError('Erro interno do servidor. Tente novamente.')
      }
    })
  })

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t.auth.verifyOtp.title}</CardTitle>
        <CardDescription>{t.auth.verifyOtp.subtitle}</CardDescription>
      </CardHeader>
      <CardContent>
        {serverError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <input type="hidden" {...register('email')} />

          <div className="grid gap-2">
            <Label htmlFor="otp-code">{t.auth.verifyOtp.codeLabel}</Label>
            <Input
              id="otp-code"
              type="text"
              inputMode="numeric"
              maxLength={OTP_CODE_LENGTH}
              placeholder="12345678"
              autoComplete="one-time-code"
              aria-invalid={!!errors.code}
              {...register('code')}
            />
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="otp-password">{t.common.password}</Label>
            <PasswordInput
              id="otp-password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="otp-confirm-password">
              {t.auth.verifyOtp.confirmPassword}
            </Label>
            <PasswordInput
              id="otp-confirm-password"
              autoComplete="new-password"
              aria-invalid={!!errors.confirmPassword}
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending
              ? t.auth.verifyOtp.saving
              : t.auth.verifyOtp.submit}
          </Button>

          <div className="text-center text-sm">
            <Link href="/forgot-password" className="underline underline-offset-4">
              {t.auth.verifyOtp.requestNewCode}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
