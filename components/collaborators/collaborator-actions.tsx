'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  RiDeleteBinLine,
  RiCloseCircleLine,
  RiMailSendLine,
} from '@remixicon/react'
import { removeMember, revokeInvitation, inviteMember } from '@/lib/collaborators/actions'
import type { Role } from '@/types'
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

// ── Remove active member ─────────────────────────────────────────────────────

export function RemoveMemberButton({
  userId,
  memberName,
}: {
  userId: string
  memberName: string
}) {
  const [open, setOpen] = useState(false)
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleOpenChange(next: boolean) {
    if (isPending) return
    setOpen(next)
    if (!next) setServerError('')
  }

  function handleConfirm() {
    setServerError('')
    startTransition(async () => {
      const result = await removeMember(userId)
      if (result?.error) {
        setServerError(result.error)
      } else {
        setOpen(false)
        toast.success(t.collaborators.actions.removed(memberName))
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t.collaborators.actions.removeAria(memberName)}
        >
          <RiDeleteBinLine className="text-muted-foreground" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.collaborators.actions.removeConfirmTitle(memberName)}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.collaborators.actions.removeConfirmDesc}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {serverError && (
          <div
            role="alert"
            className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          >
            {serverError}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>{t.common.cancel}</AlertDialogCancel>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={handleConfirm}
          >
            {isPending ? t.common.removing : t.common.remove}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Revoke pending invitation ────────────────────────────────────────────────

export function RevokeInvitationButton({
  invitationId,
  email,
}: {
  invitationId: string
  email: string
}) {
  const [isPending, startTransition] = useTransition()

  function handleRevoke() {
    startTransition(async () => {
      const result = await revokeInvitation(invitationId)
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(t.collaborators.actions.revoked)
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t.collaborators.actions.cancelInviteAria(email)}
      disabled={isPending}
      onClick={handleRevoke}
    >
      <RiCloseCircleLine className="text-muted-foreground" />
    </Button>
  )
}

// ── Resend pending invitation ────────────────────────────────────────────────

export function ResendInvitationButton({
  email,
  role,
}: {
  email: string
  role: Exclude<Role, 'principal'>
}) {
  const [isPending, startTransition] = useTransition()

  function handleResend() {
    startTransition(async () => {
      const result = await inviteMember({ email, role })
      if (result?.error) {
        toast.error(result.error)
      } else {
        toast.success(t.collaborators.actions.resentTitle, {
          description: t.collaborators.actions.resentDesc(email),
        })
      }
    })
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t.collaborators.actions.resendInviteAria(email)}
      disabled={isPending}
      onClick={handleResend}
    >
      <RiMailSendLine className="text-muted-foreground" />
    </Button>
  )
}
