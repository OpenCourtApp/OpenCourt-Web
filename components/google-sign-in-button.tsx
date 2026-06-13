'use client'

import { useTransition } from 'react'
import { RiGoogleFill } from '@remixicon/react'
import { signInWithGoogle } from '@/lib/auth/actions'
import { Button } from '@/components/ui/button'

export function GoogleSignInButton({
  onError,
}: {
  onError: (message: string) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await signInWithGoogle()
      if (result?.error) {
        onError(result.error)
      }
    })
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
      {isPending ? 'Redirecting...' : 'Continue with Google'}
    </Button>
  )
}
