'use client'

import { useActionState, useState } from 'react'
import { leaveSchool, type SchoolActionResult } from '@/lib/schools/actions'
import { t } from '@/lib/strings'
import { Button } from '@/components/ui/button'
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
import type { SchoolDialogTarget } from '@/components/settings/DeleteSchoolDialog'

export function LeaveSchoolDialog({ school }: { school: SchoolDialogTarget }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState<
    SchoolActionResult,
    FormData
  >(leaveSchool, null)

  function handleOpenChange(next: boolean) {
    if (isPending) return
    setOpen(next)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="outline">
          {t.settings.dangerZone.leaveButton}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.settings.dangerZone.leaveTitle(school.name)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.dangerZone.leaveBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={isPending}>
              {t.common.cancel}
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending
                ? t.settings.dangerZone.leaving
                : t.settings.dangerZone.leaveConfirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
