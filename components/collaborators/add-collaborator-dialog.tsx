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
      const result = await inviteMember(values)
      if (result?.error) {
        setServerError(result.error)
      } else {
        reset()
        onOpenChange(false)
        toast.success('Invitation sent', {
          description: `An invite link was sent to ${values.email}.`,
        })
      }
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite collaborator</DialogTitle>
          <DialogDescription>
            An invite link will be sent to their email. You set their role —
            they cannot change it.
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
            <Label htmlFor="invite-email">Email</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder="teacher@school.edu"
              autoComplete="off"
              aria-invalid={!!errors.email}
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invite-role">Role</Label>
            <Controller
              name="role"
              control={control}
              render={({ field }) => (
                <Select value={field.value ?? ''} onValueChange={field.onChange}>
                  <SelectTrigger id="invite-role" aria-invalid={!!errors.role}>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="student_rep">Student Rep</SelectItem>
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
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Sending...' : 'Send invite'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
