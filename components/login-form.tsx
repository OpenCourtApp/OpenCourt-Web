"use client"

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { signIn } from '@/lib/auth/actions'
import { signInSchema, type SignInInput } from '@/lib/auth/validation'
import { GoogleSignInButton } from '@/components/google-sign-in-button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type LoginFormProps = React.ComponentProps<'form'> & {
  initialError?: string
}

export function LoginForm({ initialError, className, ...props }: LoginFormProps) {
  const [serverError, setServerError] = useState(initialError ?? '')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    startTransition(async () => {
      const result = await signIn(values)
      if (result?.error) {
        setServerError(result.error)
      }
    })
  })

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className={cn('flex flex-col gap-6', className)}
      {...props}
    >
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Enter your credentials to access your account
        </p>
      </div>

      {serverError && (
        <div
          role="alert"
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
        >
          {serverError}
        </div>
      )}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register('password')}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Signing in...' : 'Sign in'}
        </Button>
      </div>

      <div className="relative text-center text-sm">
        <span className="absolute inset-x-0 top-1/2 border-t border-border" />
        <span className="relative bg-background px-2 text-muted-foreground">
          Or continue with
        </span>
      </div>

      <GoogleSignInButton onError={setServerError} />

      <div className="text-center text-sm">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="underline underline-offset-4">
          Sign up
        </Link>
      </div>
    </form>
  )
}
