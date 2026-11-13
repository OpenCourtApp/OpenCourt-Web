'use client'

import { useActionState, useState } from 'react'
import {
  deleteSchool,
  leaveSchool,
  type SchoolActionResult,
} from '@/lib/schools/actions'
import { t } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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

export type DangerZoneSchool = {
  id: string
  name: string
  isPrincipal: boolean
}

export function DangerZone({ school }: { school: DangerZoneSchool }) {
  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">
          {t.settings.dangerZone.title}
        </CardTitle>
        <CardDescription>
          {school.isPrincipal
            ? t.settings.dangerZone.deleteDescription
            : t.settings.dangerZone.leaveDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {school.isPrincipal ? (
          <DeleteSchoolDialog school={school} />
        ) : (
          <LeaveSchoolDialog school={school} />
        )}
      </CardContent>
    </Card>
  )
}

function DeleteSchoolDialog({ school }: { school: DangerZoneSchool }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [state, formAction, isPending] = useActionState<
    SchoolActionResult,
    FormData
  >(deleteSchool, null)

  const canDelete = confirmText.trim() === school.name

  function handleOpenChange(next: boolean) {
    if (isPending) return
    setOpen(next)
    if (!next) setConfirmText('')
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">
          {t.settings.dangerZone.deleteButton}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="schoolId" value={school.id} />
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t.settings.dangerZone.deleteTitle(school.name)}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.dangerZone.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="confirm-school-name">
              {t.settings.dangerZone.deleteConfirmLabel(school.name)}
            </Label>
            <Input
              id="confirm-school-name"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              autoComplete="off"
              disabled={isPending}
            />
          </div>
          {state?.error && (
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
              variant="destructive"
              disabled={!canDelete || isPending}
            >
              {isPending
                ? t.settings.dangerZone.deleting
                : t.settings.dangerZone.deleteConfirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function LeaveSchoolDialog({ school }: { school: DangerZoneSchool }) {
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
