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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { RiUploadLine } from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { passwordSchema, PASSWORD_HINT } from '@/lib/auth/validation'
import { friendlyAuthError } from '@/lib/auth/errors'
import { t } from '@/lib/strings'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB

const profileSchema = z.object({
  fullName: z.string().min(1, t.settings.profile.fullNameRequired),
  email: z.string().email(t.settings.profile.emailInvalid),
  // Empty = keep current password; when provided, enforce the same policy as
  // signup (min 6 chars + one special character).
  password: z.union([z.literal(''), passwordSchema]),
})

type ProfileFormValues = z.infer<typeof profileSchema>

export function ProfileForm() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const initialValues = useRef<ProfileFormValues | null>(null)
  const userIdRef = useRef<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [isGoogleUser, setIsGoogleUser] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

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

      userIdRef.current = session.user.id
      setDisplayName(fullName)
      setIsGoogleUser(session.user.app_metadata?.provider === 'google')

      // Avatar lives in auth metadata (Google photo, or the uploaded URL we set
      // below) — no dependency on a profile column.
      const meta = session.user.user_metadata ?? {}
      setAvatarUrl(
        (meta.avatar_url as string | undefined) ??
          (meta.picture as string | undefined) ??
          null
      )

      const values: ProfileFormValues = { fullName, email, password: '' }
      initialValues.current = values
      reset(values)
      setLoading(false)
    }

    loadProfile()
  }, [supabase, reset])

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file later
    const userId = userIdRef.current
    if (!file || !userId) return

    if (!file.type.startsWith('image/')) {
      toast.error(t.settings.profile.chooseImage)
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error(t.settings.profile.imageTooLarge)
      return
    }

    setUploadingAvatar(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const path = `${userId}/avatar-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(path)

      const { error: metaError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })
      if (metaError) throw metaError

      setAvatarUrl(publicUrl)
      toast.success(t.settings.profile.photoUpdated)
    } catch (err) {
      console.error('Avatar upload failed:', err)
      toast.error(t.settings.profile.photoUploadError, {
        description:
          err instanceof Error ? err.message : t.settings.profile.unexpectedError,
      })
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function handleAvatarRemove() {
    const userId = userIdRef.current
    if (!userId) return

    setUploadingAvatar(true)
    try {
      const { error } = await supabase.auth.updateUser({
        data: { avatar_url: null },
      })
      if (error) throw error

      setAvatarUrl(null)
      toast.success(t.settings.profile.photoRemoved)
    } catch (err) {
      console.error('Avatar remove failed:', err)
      toast.error(t.settings.profile.photoRemoveError)
    } finally {
      setUploadingAvatar(false)
    }
  }

  async function saveProfile(data: ProfileFormValues) {
    const init = initialValues.current
    if (!init) return

    const userId = (await supabase.auth.getSession()).data.session?.user?.id
    if (!userId) {
      toast.error(t.settings.profile.noSession)
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
      setDisplayName(data.fullName)
      toast.success(t.settings.profile.profileUpdated)
    } catch (err) {
      console.error('Profile update failed:', err)
      toast.error(t.settings.profile.saveError, {
        description:
          err instanceof Error ? err.message : t.settings.profile.unexpectedError,
      })
    }
  }

  const avatarInitials =
    displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t.settings.profile.title}</CardTitle>
          <CardDescription>{t.settings.profile.description}</CardDescription>
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
        <CardTitle>{t.settings.profile.title}</CardTitle>
        <CardDescription>{t.settings.profile.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 rounded-full">
            {avatarUrl && (
              <AvatarImage src={avatarUrl} alt={displayName} className="rounded-full" />
            )}
            <AvatarFallback className="rounded-full text-lg">
              {avatarInitials}
            </AvatarFallback>
          </Avatar>

          <div className="space-y-1">
            {isGoogleUser ? (
              <>
                <p className="text-sm font-medium">{t.settings.profile.photo}</p>
                <p className="text-xs text-muted-foreground">
                  {t.settings.profile.photoGoogle}
                </p>
              </>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={uploadingAvatar}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <RiUploadLine className="size-4" />
                    {uploadingAvatar
                      ? t.settings.profile.uploading
                      : avatarUrl
                        ? t.settings.profile.changePhoto
                        : t.settings.profile.uploadPhoto}
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={uploadingAvatar}
                      onClick={handleAvatarRemove}
                    >
                      {t.settings.profile.removePhoto}
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.settings.profile.photoHint}
                </p>
              </>
            )}
          </div>
        </div>

        <form onSubmit={(e) => handleSubmit(saveProfile)(e)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="fullName">{t.settings.profile.fullName}</FieldLabel>
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
            <FieldLabel htmlFor="email">{t.settings.profile.email}</FieldLabel>
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
            <FieldLabel htmlFor="password">{t.settings.profile.newPassword}</FieldLabel>
            <FieldContent>
              <Input
                id="password"
                type="password"
                placeholder={t.settings.profile.passwordKeep}
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
              {isSubmitting ? t.settings.profile.saving : t.settings.profile.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
