'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resetPassword } from '@/lib/auth/actions'
import {
  resetPasswordSchema,
  PASSWORD_HINT,
  type ResetPasswordInput,
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

export function ResetPasswordForm({ ...props }: React.ComponentProps<typeof Card>) {
  const [state, formAction, isPending] = useActionState(resetPassword, null)

  const {
    register,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  })

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t.auth.resetPassword.title}</CardTitle>
        <CardDescription>
          {t.auth.resetPassword.subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} noValidate className="grid gap-4">
          {state?.error && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {state.error}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="reset-password">{t.common.password}</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby="reset-password-hint"
              {...register('password')}
            />
            {errors.password ? (
              <p id="reset-password-hint" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : (
              <p id="reset-password-hint" className="text-xs text-muted-foreground">
                {PASSWORD_HINT}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="reset-confirm-password">
              {t.auth.resetPassword.confirmPassword}
            </Label>
            <Input
              id="reset-confirm-password"
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
              ? t.auth.resetPassword.saving
              : t.auth.resetPassword.submit}
          </Button>

          <div className="text-center text-sm">
            <Link href="/login" className="underline underline-offset-4">
              {t.auth.resetPassword.backToLogin}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
