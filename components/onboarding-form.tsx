'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSchool, signOut } from '@/lib/auth/actions'
import {
  createSchoolSchema,
  type CreateSchoolInput,
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
import { RiSchoolLine } from '@remixicon/react'

type OnboardingFormProps = React.ComponentProps<typeof Card> & {
  email: string
  defaultFullName: string
}

export function OnboardingForm({
  email,
  defaultFullName,
  ...props
}: OnboardingFormProps) {
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()
  const [isSigningOut, startSignOut] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSchoolInput>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { fullName: defaultFullName, schoolName: '' },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    startTransition(async () => {
      const result = await createSchool(values)
      if (result?.error) setServerError(result.error)
    })
  })

  return (
    <Card {...props}>
      <CardHeader>
        <CardTitle>Create your organization</CardTitle>
        <CardDescription>
          You&apos;re signed in as {email}. Set up your school to get started.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
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
            <Label htmlFor="create-name">Full name</Label>
            <Input
              id="create-name"
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

          <div className="grid gap-2">
            <Label htmlFor="create-school">School name</Label>
            <div className="relative">
              <RiSchoolLine className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="create-school"
                type="text"
                placeholder="Lincoln High School"
                className="pl-9"
                aria-invalid={!!errors.schoolName}
                {...register('schoolName')}
              />
            </div>
            {errors.schoolName && (
              <p className="text-xs text-destructive">
                {errors.schoolName.message}
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            You&apos;ll be the school&apos;s principal. An organization
            identifier is generated for you — find it later in Settings.
          </p>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Creating school...' : 'Create school'}
          </Button>
        </form>

        <div className="text-center text-sm">
          Wrong account?{' '}
          <button
            type="button"
            onClick={() =>
              startSignOut(async () => {
                await signOut()
              })
            }
            disabled={isSigningOut}
            className="underline underline-offset-4"
          >
            Sign out
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
