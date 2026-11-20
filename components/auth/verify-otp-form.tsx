'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPasswordWithOtp } from '@/lib/auth/actions'
import {
  resetPasswordWithOtpSchema,
  type ResetPasswordWithOtpInput,
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

export function VerifyOtpForm({
  defaultEmail,
  ...props
}: React.ComponentProps<typeof Card> & { defaultEmail?: string }) {
  const [serverError, setServerError] = useState('')
  const [state, formAction, isPending] = useActionState(
    resetPasswordWithOtp,
    null
  )

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

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    // useActionState já chama o action com o FormData; aqui apenas disparamos
    // o submit do form pelo React Hook Form para aproveitar a validação Zod.
    // O action recebe o FormData do próprio <form action={formAction}>.
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
        {state?.error && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {state.error}
          </div>
        )}
        <form action={formAction} noValidate className="grid gap-4">
          <input type="hidden" {...register('email')} />

          <div className="grid gap-2">
            <Label htmlFor="otp-code">{t.auth.verifyOtp.codeLabel}</Label>
            <Input
              id="otp-code"
              type="text"
              maxLength={6}
              placeholder="123456"
              autoComplete="otp"
              aria-invalid={!!errors.code}
              {...register('code')}
            />
            {errors.code && (
              <p className="text-xs text-destructive">{errors.code.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="otp-password">{t.common.password}</Label>
            <Input
              id="otp-password"
              type="password"
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
            <Input
              id="otp-confirm-password"
              type="password"
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
