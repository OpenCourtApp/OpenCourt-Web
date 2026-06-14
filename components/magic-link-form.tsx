'use client'

import { useState, useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { RiMailLine, RiMailCheckLine } from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { magicLinkSchema, type MagicLinkInput } from '@/lib/auth/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Passwordless sign-in. Like Google OAuth, this must run in the browser: the
 * browser Supabase client (PKCE) stores the code verifier, and the emailed link
 * returns to `/auth/callback?code=…&next=/dashboard`, where the server exchanges
 * the code for a session — the same route OAuth uses.
 *
 * Invite-only (business rule #1): `shouldCreateUser: false` means a magic-link
 * request never creates an account. Only emails that already exist receive a
 * link — invitees pre-registered via `inviteUserByEmail`, or self-registered
 * users. Magic link is an authentication method, not a way to join without an
 * invitation. Unknown emails see the same confirmation screen (no account, no
 * email) so the form can't be used to enumerate which addresses have accounts.
 */
export function MagicLinkForm({
  onError,
}: {
  onError: (message: string) => void
}) {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkInput>({
    resolver: zodResolver(magicLinkSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit((values) => {
    onError('')
    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email: values.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          shouldCreateUser: false,
        },
      })

      // Surface only rate limiting; for any other error we still show the
      // confirmation so the response is identical whether or not the email
      // has an account (no enumeration).
      if (error && error.code === 'over_request_rate_limit') {
        onError('Too many attempts. Wait a moment and try again.')
        return
      }

      setSentTo(values.email)
    })
  })

  if (sentTo) {
    return (
      <div className="grid gap-3 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted">
          <RiMailCheckLine className="size-5 text-muted-foreground" />
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-medium">Check your email</p>
          <p className="text-sm text-muted-foreground">
            If an account exists for{' '}
            <span className="font-medium text-foreground">{sentTo}</span>, we sent
            a sign-in link. Open it on this device to continue.
          </p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="magic-email">Email</Label>
        <div className="relative">
          <RiMailLine className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="magic-email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            className="pl-9"
            aria-invalid={!!errors.email}
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-xs text-destructive">{errors.email.message}</p>
        )}
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? 'Sending link…' : 'Send magic link'}
      </Button>
    </form>
  )
}
