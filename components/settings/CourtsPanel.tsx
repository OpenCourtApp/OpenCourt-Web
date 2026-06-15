'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  RiAddLine,
  RiBasketballLine,
  RiCheckLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiPencilLine,
} from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { createCourt, deleteCourt, renameCourt } from '@/lib/courts/actions'
import { useBookings } from '@/components/booking/bookings-provider'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/shared/empty-state'
import { t } from '@/lib/strings'

/**
 * Court management lives here — a principal-only Settings section alongside
 * Authorization, not a standalone page. Members never manage courts (they pick
 * them in the booking form / calendar filters), so this returns null for them.
 * Mutations are still guarded by RLS (principal-only INSERT/UPDATE/DELETE).
 */
export function CourtsPanel() {
  const { courts, bookings, refresh } = useBookings()
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsPrincipal(data.user?.user_metadata?.role === 'principal')
    })
  }, [])

  const bookingCountByCourt = useMemo(() => {
    const counts = new Map<string, number>()
    for (const b of bookings) {
      counts.set(b.court_id, (counts.get(b.court_id) ?? 0) + 1)
    }
    return counts
  }, [bookings])

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name || isPending) return
    startTransition(async () => {
      const result = await createCourt({ name })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setNewName('')
      await refresh()
      toast.success(t.courts.added)
    })
  }

  function handleRename(courtId: string) {
    const name = editingName.trim()
    if (!name || isPending) return
    startTransition(async () => {
      const result = await renameCourt({ courtId, name })
      if (result?.error) {
        toast.error(result.error)
        return
      }
      setEditingId(null)
      await refresh()
      toast.success(t.courts.renamed)
    })
  }

  function handleDelete(courtId: string) {
    if (isPending) return
    startTransition(async () => {
      const result = await deleteCourt(courtId)
      if (result?.error) {
        toast.error(result.error)
        return
      }
      await refresh()
      toast.success(t.courts.removed)
    })
  }

  // Principal-only surface (matches AuthorizationPanel).
  if (!isPrincipal) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.courts.title}</CardTitle>
        <CardDescription>
          {t.courts.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t.courts.newNamePlaceholder}
            maxLength={40}
            aria-label={t.courts.newNamePlaceholder}
          />
          <Button type="submit" disabled={isPending || !newName.trim()}>
            <RiAddLine className="size-4" />
            {t.courts.add}
          </Button>
        </form>

        {courts.length === 0 ? (
          <EmptyState
            icon={<RiBasketballLine />}
            title={t.courts.emptyTitle}
            description={t.courts.emptyDesc}
            className="py-8"
          />
        ) : (
          <ul className="grid gap-2">
            {courts.map((court) => {
              const isEditing = editingId === court.id
              const count = bookingCountByCourt.get(court.id) ?? 0
              return (
                <li
                  key={court.id}
                  className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 transition-colors hover:bg-muted/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <RiBasketballLine className="size-4.5" />
                  </div>

                  {isEditing ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault()
                        handleRename(court.id)
                      }}
                    >
                      <Input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        autoFocus
                        maxLength={40}
                        className="h-8 flex-1"
                        aria-label={t.courts.renameAria(court.name)}
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={isPending || !editingName.trim()}
                      >
                        <RiCheckLine className="size-4" />
                        {t.courts.save}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t.courts.cancelRename}
                        onClick={() => setEditingId(null)}
                      >
                        <RiCloseLine className="size-4" />
                      </Button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {court.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {count === 0
                            ? t.courts.noBookings
                            : t.courts.bookingCount(count)}
                        </p>
                      </div>
                      {count > 0 && (
                        <Badge variant="secondary" className="hidden sm:inline-flex">
                          {t.courts.inUse}
                        </Badge>
                      )}
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            setEditingId(court.id)
                            setEditingName(court.name)
                          }}
                        >
                          <RiPencilLine className="size-4" />
                          {t.courts.rename}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon-sm"
                              className="text-destructive hover:text-destructive"
                              aria-label={t.courts.deleteAria(court.name)}
                              disabled={isPending}
                            >
                              <RiDeleteBinLine className="size-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="duration-75 data-open:slide-in-from-bottom-1 data-open:zoom-in-98">
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t.courts.deleteTitle(court.name)}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {count > 0
                                  ? t.courts.deleteBlocked(count)
                                  : t.courts.deleteConfirm}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                              <AlertDialogAction
                                variant="destructive"
                                disabled={count > 0}
                                onClick={() => handleDelete(court.id)}
                              >
                                {t.courts.deleteAction}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
