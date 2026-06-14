'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acceptInvitation } from '@/lib/auth/actions'
import {
  acceptInvitationSchema,
  PASSWORD_HINT,
  type AcceptInvitationInput,
} from '@/lib/auth/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const ROLE_LABELS: Record<string, string> = {
  teacher:     'Teacher',
  student_rep: 'Student Rep',
  principal:   'Principal',
}

type WelcomeFormProps = {
  invitation: {
    id: string
    role: 'teacher' | 'student_rep'
    schools: { name: string } | null
  }
  defaultFullName: string
  isGoogleUser: boolean
}

export function WelcomeForm({
  invitation,
  defaultFullName,
  isGoogleUser,
}: WelcomeFormProps) {
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationInput>({
    resolver: zodResolver(acceptInvitationSchema),
    mode: 'onChange',
    defaultValues: { fullName: defaultFullName, password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    startTransition(async () => {
      const result = await acceptInvitation(
        isGoogleUser ? { fullName: values.fullName } : values
      )
      if (result?.error) {
        setServerError(result.error)
      }
    })
  })

  const schoolName = invitation.schools?.name ?? 'your school'

  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;ve been invited</CardTitle>
        <CardDescription>
          Accept your invitation to join{' '}
          <span className="font-medium text-foreground">{schoolName}</span>.
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
            <Label>Role</Label>
            <div>
              <Badge variant="outline">{ROLE_LABELS[invitation.role]}</Badge>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="welcome-name">Full name</Label>
            <Input
              id="welcome-name"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              aria-invalid={!!errors.fullName}
              {...register('fullName')}
            />
            {errors.fullName && (
              <p className="text-xs text-destructive">
                {errors.fullName.message}
              </p>
            )}
          </div>

          {!isGoogleUser && (
            <div className="grid gap-2">
              <Label htmlFor="welcome-password">
                Set a password{' '}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="welcome-password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby="welcome-password-hint"
                {...register('password')}
              />
              {errors.password ? (
                <p
                  id="welcome-password-hint"
                  className="text-xs text-destructive"
                >
                  {errors.password.message}
                </p>
              ) : (
                <p
                  id="welcome-password-hint"
                  className="text-xs text-muted-foreground"
                >
                  {PASSWORD_HINT}
                </p>
              )}
            </div>
          )}

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Joining...' : `Join ${schoolName}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
