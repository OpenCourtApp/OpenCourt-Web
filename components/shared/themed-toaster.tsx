'use client'

import { Toaster } from 'sonner'
import {
  RiCheckboxCircleFill,
  RiErrorWarningFill,
  RiAlertFill,
  RiInformationFill,
} from '@remixicon/react'
import { useTheme } from '@/components/shared/theme-provider'

/**
 * App-themed Sonner toaster. Instead of `richColors` (loud full-color fills that
 * clash with the monochrome system), toasts render as a neutral elevated surface
 * — `bg-popover`, hairline border, `rounded-xl`, soft shadow — matching cards.
 * The only accent is a small status icon. `theme` follows the app theme so the
 * surface flips correctly in dark/light/system.
 */
export function ThemedToaster() {
  const { theme } = useTheme()

  return (
    <Toaster
      theme={theme}
      closeButton
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:rounded-xl group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:shadow-lg group-[.toaster]:gap-2.5 group-[.toaster]:px-4 group-[.toaster]:py-3.5',
          title: 'group-[.toast]:text-sm group-[.toast]:font-medium group-[.toast]:text-foreground',
          description: 'group-[.toast]:text-xs group-[.toast]:text-muted-foreground',
          icon: 'group-[.toast]:m-0 group-[.toast]:items-start',
          actionButton:
            'group-[.toast]:rounded-lg group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton:
            'group-[.toast]:rounded-lg group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          closeButton:
            'group-[.toast]:border-border group-[.toast]:bg-popover group-[.toast]:text-muted-foreground group-[.toast]:hover:text-foreground',
        },
      }}
      icons={{
        success: <RiCheckboxCircleFill className="size-5 text-success" />,
        error: <RiErrorWarningFill className="size-5 text-destructive" />,
        warning: <RiAlertFill className="size-5 text-warning" />,
        info: <RiInformationFill className="size-5 text-foreground" />,
      }}
    />
  )
}
