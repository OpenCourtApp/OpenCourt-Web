'use client'

import * as React from 'react'
import { RiEyeLine, RiEyeOffLine } from '@remixicon/react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Password field with a show/hide toggle. Spreads props onto the underlying
 * `Input` (so `react-hook-form`'s `register` ref/handlers flow through); the
 * `type` is owned here and toggled by the eye button.
 */
function PasswordInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        className={cn('pr-9', className)}
        {...props}
        type={visible ? 'text' : 'password'}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        {visible ? (
          <RiEyeOffLine className="size-4" />
        ) : (
          <RiEyeLine className="size-4" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
