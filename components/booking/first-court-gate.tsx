'use client'

import { useEffect, useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { RiBasketballLine, RiArrowRightLine } from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { createCourt } from '@/lib/courts/actions'
import { useBookings } from '@/components/booking/bookings-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { t } from '@/lib/strings'

/**
 * Blocks the app for principals whose school has no courts yet: the first
 * thing a new principal does is register a court. Members are never blocked.
 */
export function FirstCourtGate({ children }: { children: ReactNode }) {
  const { courts, loading, refresh } = useBookings()
  const [isPrincipal, setIsPrincipal] = useState<boolean | null>(null)
  const [name, setName] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsPrincipal(data.user?.user_metadata?.role === 'principal')
    })
  }, [])

  // Render the app while role/courts are still resolving so existing users
  // never see the gate flash.
  const blocked = !loading && isPrincipal === true && courts.length === 0

  if (!blocked) return <>{children}</>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || isPending) return
    startTransition(async () => {
      const result = await createCourt({ name: trimmed })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      await refresh()
      toast.success(t.courts.firstGate.addedTitle, {
        description: t.courts.firstGate.addedDesc,
      })
    })
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-6 px-8 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <RiBasketballLine className="size-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight">
              {t.courts.firstGate.title}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t.courts.firstGate.desc}
            </p>
          </div>
          <form onSubmit={handleSubmit} className="grid w-full gap-3">
            <div className="grid gap-2 text-left">
              <Label htmlFor="first-court-name">{t.courts.firstGate.nameLabel}</Label>
              <Input
                id="first-court-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.courts.firstGate.namePlaceholder}
                maxLength={40}
                autoFocus
              />
            </div>
            <Button
              type="submit"
              size="lg"
              disabled={isPending || !name.trim()}
            >
              {isPending ? t.courts.firstGate.submitting : t.courts.firstGate.submit}
              <RiArrowRightLine className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
