"use client"

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signUp } from '@/lib/auth/actions'
import { signUpSchema, PASSWORD_HINT, type SignUpInput } from '@/lib/auth/validation'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
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

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: {
      fullName: '',
      email: '',
      password: '',
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    startTransition(async () => {
      const result = await signUp(values)
      if (result?.error) {
        setServerError(result.error)
      }
    })
  })

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>{t.auth.register.title}</CardTitle>
        <CardDescription>
          {t.auth.register.subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent>
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
            <Label htmlFor="name">{t.common.fullName}</Label>
            <Input
              id="name"
              type="text"
              placeholder={t.common.fullNamePlaceholder}
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">{errors.fullName.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">{t.common.email}</Label>
            <Input
              id="email"
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

          <div className="grid gap-2">
            <Label htmlFor="password">{t.common.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!errors.password}
              aria-describedby="password-hint"
              {...register('password')}
            />
            {errors.password ? (
              <p id="password-hint" className="text-xs text-destructive">
                {errors.password.message}
              </p>
            ) : (
              <p id="password-hint" className="text-xs text-muted-foreground">
                {PASSWORD_HINT}
              </p>
            )}
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? t.auth.register.creating : t.auth.register.createAccount}
          </Button>

          <div className="relative text-center text-sm">
            <span className="absolute inset-x-0 top-1/2 border-t border-border" />
            <span className="relative bg-card px-2 text-muted-foreground">
              {t.auth.register.orContinue}
            </span>
          </div>

          <GoogleSignInButton onError={setServerError} />

          <div className="text-center text-sm">
            {t.auth.register.haveAccount}{' '}
            <Link href="/login" className="underline underline-offset-4">
              {t.auth.register.signIn}
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
