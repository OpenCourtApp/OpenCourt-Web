'use client'

import { useActionState, useEffect, useState } from 'react'
import {
  deleteAccount,
  getAccountDeletionStatus,
  type DeleteAccountState,
} from '@/lib/auth/actions'
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

export function AccountDangerZone() {
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [principalSchools, setPrincipalSchools] = useState<string[]>([])

  useEffect(() => {
    let active = true

    getAccountDeletionStatus().then((status) => {
      if (!active) return

      if (status) {
        setEmail(status.email)
        setIsPrincipal(status.isPrincipal)
        setPrincipalSchools(status.principalSchools)
      }
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t.settings.account.title}
          </CardTitle>
          <CardDescription>{t.settings.account.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">
          {t.settings.account.title}
        </CardTitle>
        <CardDescription>{t.settings.account.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isPrincipal ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{t.settings.account.principalBlocked}</p>
            {principalSchools.length > 0 && (
              <p>{t.settings.account.principalSchools(principalSchools.join(', '))}</p>
            )}
          </div>
        ) : (
          <DeleteAccountDialog email={email} />
        )}
      </CardContent>
    </Card>
  )
}

function DeleteAccountDialog({ email }: { email: string }) {
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
        <Button variant="destructive">
          {t.settings.account.deleteButton}
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
