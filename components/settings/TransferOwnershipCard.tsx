'use client'

import { useActionState, useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  transferSchoolOwnership,
  type TransferOwnershipResult,
} from '@/lib/schools/actions'
import type { Role } from '@/types'
import { ROLE_LABELS, t } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export type TransferOwnershipSchool = {
  id: string
  name: string
}

type Candidate = {
  user_id: string
  full_name: string
  email: string
  role: Role
}

/**
 * Handover of school management. Only rendered for the principal of the active
 * school — the RPC enforces the same rules server-side.
 */
export function TransferOwnershipCard({
  school,
}: {
  school: TransferOwnershipSchool
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.transferOwnership.title}</CardTitle>
        <CardDescription>
          {t.settings.transferOwnership.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <TransferOwnershipDialog school={school} />
      </CardContent>
    </Card>
  )
}

function TransferOwnershipDialog({ school }: { school: TransferOwnershipSchool }) {
  const [open, setOpen] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [selected, setSelected] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [state, formAction, isPending] = useActionState<
    TransferOwnershipResult,
    FormData
  >(transferSchoolOwnership, null)

  useEffect(() => {
    if (!open) return

    let active = true
    const supabase = createClient()

    supabase
      .from('memberships')
      .select('user_id, role, users(full_name, email)')
      .eq('school_id', school.id)
      .neq('role', 'principal')
      .order('created_at')
      .then(({ data, error }) => {
        if (!active) return

        if (error) {
          setLoadError(t.settings.transferOwnership.loadError)
          setCandidates([])
          return
        }

        setCandidates(
          (data ?? []).map((membership) => {
            const user = (
              Array.isArray(membership.users)
                ? membership.users[0]
                : membership.users
            ) as { full_name: string; email: string } | null

            return {
              user_id: membership.user_id,
              full_name: user?.full_name ?? '',
              email: user?.email ?? '',
              role: membership.role as Role,
            }
          })
        )
      })

    return () => {
      active = false
    }
  }, [open, school.id])

  // On success the session role changed server-side; reload so the sidebar and
  // the rest of the settings page reflect the new role.
  useEffect(() => {
    if (state && 'success' in state) {
      window.location.reload()
    }
  }, [state])

  function handleOpenChange(next: boolean) {
    if (isPending) return

    if (next) {
      // Reset before opening so a previous selection/error never leaks in. Doing
      // it here (event handler) instead of in the effect avoids a cascading
      // render right after mount of the dialog content.
      setCandidates(null)
      setSelected('')
      setLoadError('')
      setSubmitted(false)
    }

    setOpen(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">{t.settings.transferOwnership.button}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form
          action={formAction}
          onSubmit={() => setSubmitted(true)}
          className="grid gap-4"
        >
          <input type="hidden" name="schoolId" value={school.id} />
          <input type="hidden" name="newPrincipalId" value={selected} />
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.settings.transferOwnership.dialogTitle(school.name)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.transferOwnership.dialogBody}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="grid gap-2">
            <p className="text-sm font-medium">
              {t.settings.transferOwnership.membersLabel}
            </p>

            {candidates === null ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : loadError ? (
              <p role="alert" className="text-sm text-destructive">
                {loadError}
              </p>
            ) : candidates.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>{t.settings.transferOwnership.noMembers}</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/collaborators">
                    {t.settings.transferOwnership.goToMembers}
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="grid max-h-64 gap-2 overflow-y-auto">
                {candidates.map((candidate) => {
                  const isSelected = candidate.user_id === selected
                  return (
                    <li key={candidate.user_id}>
                      <button
                        type="button"
                        aria-pressed={isSelected}
                        disabled={isPending}
                        onClick={() => setSelected(candidate.user_id)}
                        className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/60'
                        }`}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {candidate.full_name || candidate.email}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {candidate.email}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {ROLE_LABELS[candidate.role]}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {submitted && state && 'error' in state && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isPending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <Button
              type="submit"
              disabled={!selected || isPending || Boolean(loadError)}
            >
              {isPending
                ? t.settings.transferOwnership.transferring
                : t.settings.transferOwnership.confirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
