'use client'

import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Field, FieldLabel, FieldContent, FieldError } from '@/components/ui/field'
import { createClient } from '@/lib/supabase/client'
import { passwordSchema, PASSWORD_HINT } from '@/lib/auth/validation'
import { friendlyAuthError } from '@/lib/auth/errors'

const profileSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  email: z.string().email('Invalid email address'),
  // Empty = keep current password; when provided, enforce the same policy as
  // signup (min 6 chars + one special character).
  password: z.union([z.literal(''), passwordSchema]),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfileForm() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const initialValues = useRef<ProfileFormValues | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { fullName: '', email: '', password: '' },
  })

  useEffect(() => {
    async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) {
        setLoading(false)
        return
      }

      const { data: user, error: userError } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', session.user.id)
        .maybeSingle()

      if (userError) {
        console.error('Failed to load profile:', userError)
      }

      const fullName = user?.full_name ?? ''
      const email = user?.email ?? session.user.email ?? ''

      const values: ProfileFormValues = { fullName, email, password: '' }
      initialValues.current = values
      reset(values)
      setLoading(false)
    }

    loadProfile()
  }, [supabase, reset])

  async function saveProfile(data: ProfileFormValues) {
    const init = initialValues.current
    if (!init) return

    const userId = (await supabase.auth.getSession()).data.session?.user?.id
    if (!userId) {
      toast.error('No authenticated session found')
      return
    }

    try {
      if (data.fullName !== init.fullName) {
        const { data: updated, error: dbError } = await supabase
          .from('users')
          .update({ full_name: data.fullName })
          .eq('id', userId)
          .select('id')
          .single()

        if (dbError) throw dbError
        if (!updated) throw new Error('No user record found to update')

        const { error: metaError } = await supabase.auth.updateUser({
          data: { full_name: data.fullName },
        })

        if (metaError) throw metaError
      }

      if (data.email !== init.email) {
        const trimmedEmail = data.email.trim()

        const { error: dbError } = await supabase
          .from('users')
          .update({ email: trimmedEmail })
          .eq('id', userId)

        if (dbError) throw dbError

        const { error: authError } = await supabase.auth.updateUser({
          email: trimmedEmail,
        })

        if (authError) {
          console.warn('auth.updateUser failed (public.users already updated):', authError)
        }
      }

      if (data.password) {
        const { error } = await supabase.auth.updateUser({ password: data.password })
        if (error) {
          // Surface Supabase password-policy errors in plain language.
          toast.error(friendlyAuthError(error))
          return
        }
      }

      initialValues.current = { ...data, password: '' }
      reset({ ...data, password: '' })
      toast.success('Profile updated successfully!')
    } catch (err) {
      console.error('Profile update failed:', err)
      toast.error('Could not save your changes', {
        description:
          err instanceof Error ? err.message : 'An unexpected error occurred.',
      })
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Manage your personal information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>Manage your personal information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => handleSubmit(saveProfile)(e)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="fullName">Full Name</FieldLabel>
            <FieldContent>
              <Input
                id="fullName"
                {...register('fullName')}
                disabled={isSubmitting}
              />
              {errors.fullName && (
                <FieldError>{errors.fullName.message}</FieldError>
              )}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <FieldContent>
              <Input
                id="email"
                type="email"
                {...register('email')}
                disabled={isSubmitting}
              />
              {errors.email && (
                <FieldError>{errors.email.message}</FieldError>
              )}
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="password">New Password</FieldLabel>
            <FieldContent>
              <Input
                id="password"
                type="password"
                placeholder="Leave blank to keep current"
                aria-describedby="profile-password-hint"
                {...register('password')}
                disabled={isSubmitting}
              />
              {errors.password ? (
                <FieldError>{errors.password.message}</FieldError>
              ) : (
                <p
                  id="profile-password-hint"
                  className="text-xs text-muted-foreground"
                >
                  {PASSWORD_HINT}
                </p>
              )}
            </FieldContent>
          </Field>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
