'use client'

import { useState, useTransition } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { inviteMember } from '@/lib/collaborators/actions'
import {
  inviteMemberSchema,
  type InviteMemberInput,
} from '@/lib/collaborators/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { t } from '@/lib/strings'

type AddCollaboratorDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddCollaboratorDialog({
  open,
  onOpenChange,
}: AddCollaboratorDialogProps) {
  const [serverError, setServerError] = useState('')
  const [isPending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '' },
  })

  function handleOpenChange(nextOpen: boolean) {
    if (isPending) return
    onOpenChange(nextOpen)
    if (!nextOpen) {
      reset()
      setServerError('')
    }
  }

  const onSubmit = handleSubmit((values) => {
    setServerError('')
    startTransition(async () => {
      try {
        const result = await inviteMember(values)
        if (result?.error) {
          setServerError(result.error)
          return
        }
        reset()
        onOpenChange(false)
        toast.success(t.collaborators.dialog.sentTitle, {
          description: t.collaborators.dialog.sentDesc(values.email),
        })
      } catch {
        // The action threw instead of returning a result (network drop,
        // unexpected server error). Surface it instead of failing silently.
        const message = t.collaborators.dialog.sendError
        setServerError(message)
        toast.error(message)
      }
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.collaborators.dialog.title}</DialogTitle>
          <DialogDescription>
            {t.collaborators.dialog.description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {serverError && (
            <div
              role="alert"
              className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {serverError}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="invite-email">{t.collaborators.dialog.emailLabel}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t.collaborators.dialog.emailPlaceholder}
              autoComplete="off"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-role">{t.collaborators.dialog.roleLabel}</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="invite-role" aria-invalid={!!errors.role}>
                    <SelectValue placeholder={t.collaborators.dialog.rolePlaceholder} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">{t.collaborators.dialog.roleTeacher}</SelectItem>
                    <SelectItem value="student_rep">{t.collaborators.dialog.roleStudentRep}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            {errors.role && (
              <p className="text-xs text-destructive">{errors.role.message}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isPending}>
                {t.collaborators.dialog.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? t.collaborators.dialog.sending : t.collaborators.dialog.send}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
