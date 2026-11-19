'use client'

import { useActionState, useState } from 'react'
import {
  deleteAccount,
  type DeleteAccountState,
} from '@/lib/auth/actions'
import { t } from '@/lib/strings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

export function DeleteAccountDialog({
  email,
  triggerLabel,
  triggerVariant = 'destructive',
  triggerClassName,
}: {
  email: string
  triggerLabel?: string
  triggerVariant?: React.ComponentProps<typeof Button>['variant']
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [state, formAction, isPending] = useActionState<
    DeleteAccountState,
    FormData
  >(deleteAccount, null)

  const canDelete = confirmText.trim().toLowerCase() === email.toLowerCase()

  function handleOpenChange(next: boolean) {
    if (isPending) return
    setOpen(next)
    if (!next) setConfirmText('')
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant={triggerVariant} className={triggerClassName}>
          {triggerLabel ?? t.settings.account.deleteButton}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form action={formAction} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>{t.settings.account.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {t.settings.account.deleteBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="confirm-account-email">
              {t.settings.account.deleteConfirmLabel(email)}
            </Label>
            <Input
              id="confirm-account-email"
              name="confirmEmail"
              type="email"
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
                ? t.settings.account.deleting
                : t.settings.account.deleteConfirm}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
