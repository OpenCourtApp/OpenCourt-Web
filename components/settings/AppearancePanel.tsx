'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useTheme } from '@/components/shared/theme-provider'
import { cn } from '@/lib/utils'

const themes = [
  {
    value: 'light' as const,
    label: 'Light',
    preview: (
      <div className="h-20 w-36 overflow-hidden rounded-md border bg-white">
        <div className="h-4 bg-neutral-900" />
        <div className="space-y-1.5 p-2">
          <div className="h-1.5 w-3/4 rounded bg-neutral-300" />
          <div className="h-1.5 w-1/2 rounded bg-neutral-200" />
          <div className="flex gap-1 pt-1">
            <div className="size-1.5 rounded-full bg-neutral-400" />
            <div className="size-1.5 rounded-full bg-neutral-400" />
            <div className="size-1.5 rounded-full bg-neutral-400" />
          </div>
        </div>
      </div>
    ),
  },
  {
    value: 'dark' as const,
    label: 'Dark',
    preview: (
      <div className="h-20 w-36 overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
        <div className="h-4 bg-neutral-100" />
        <div className="space-y-1.5 p-2">
          <div className="h-1.5 w-3/4 rounded bg-neutral-600" />
          <div className="h-1.5 w-1/2 rounded bg-neutral-700" />
          <div className="flex gap-1 pt-1">
            <div className="size-1.5 rounded-full bg-neutral-500" />
            <div className="size-1.5 rounded-full bg-neutral-500" />
            <div className="size-1.5 rounded-full bg-neutral-500" />
          </div>
        </div>
      </div>
    ),
  },
  {
    value: 'system' as const,
    label: 'System',
    preview: (
      <div className="h-20 w-36 overflow-hidden rounded-md border">
        <div className="flex h-full">
          <div className="flex w-1/2 flex-col bg-neutral-900">
            <div className="h-4 bg-neutral-100" />
            <div className="space-y-1 p-1.5">
              <div className="h-1 rounded bg-neutral-600" />
              <div className="h-1 w-2/3 rounded bg-neutral-700" />
            </div>
          </div>
          <div className="flex w-1/2 flex-col bg-white">
            <div className="h-4 bg-neutral-900" />
            <div className="space-y-1 p-1.5">
              <div className="h-1 rounded bg-neutral-300" />
              <div className="h-1 w-2/3 rounded bg-neutral-200" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
]

export function AppearancePanel() {
  const { theme, setTheme } = useTheme()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Choose how OpenCourt looks on your device</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-6">
          {themes.map(({ value, label, preview }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={theme === value}
              onClick={() => setTheme(value)}
              className="flex flex-col items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              <div
                className={cn(
                  'rounded-lg border-2 p-2 transition-colors',
                  theme === value
                    ? 'border-primary'
                    : 'border-border hover:border-muted-foreground/40'
                )}
              >
                {preview}
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'flex size-4 items-center justify-center rounded-full border transition-colors',
                    theme === value ? 'border-primary' : 'border-muted-foreground'
                  )}
                >
                  {theme === value && (
                    <div className="size-2 rounded-full bg-primary" />
                  )}
                </div>
                <span className="text-sm font-medium">{label}</span>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
