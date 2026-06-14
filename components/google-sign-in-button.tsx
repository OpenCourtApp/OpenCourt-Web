'use client'

import { useState } from 'react'
import { RiGoogleFill } from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

/**
 * Google OAuth must be initiated in the browser: the browser Supabase client
 * stores the PKCE code verifier (cookie) and navigates the page to Google. The
 * provider then returns to `/auth/callback`, where the server exchanges the code
 * for a session. (A server action can't reliably perform the cross-origin
 * redirect, which is why this is client-side.)
 */
export function GoogleSignInButton({
  onError,
}: {
  onError: (message: string) => void
}) {
  const [isPending, setIsPending] = useState(false)

  async function handleClick() {
    setIsPending(true)
    onError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })

    // On success the browser is redirected to Google automatically; we only get
    // here synchronously if starting the flow failed.
    if (error) {
      onError('Could not start Google sign-in. Please try again.')
      setIsPending(false)
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={handleClick}
      disabled={isPending}
    >
      <RiGoogleFill className="size-4" />
      {isPending ? 'Redirecting…' : 'Continue with Google'}
    </Button>
  )
}
