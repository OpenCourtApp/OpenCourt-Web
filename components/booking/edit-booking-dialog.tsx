'use client'

import { useEffect, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { RiDeleteBinLine } from '@remixicon/react'
import { deleteBooking, updateBooking } from '@/lib/bookings/actions'
import {
  updateBookingSchema,
  type UpdateBookingInput,
} from '@/lib/bookings/validation'
import { useBookings, type BookingRecord } from '@/components/booking/bookings-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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

export function EditBookingDialog({
  booking,
  canManage,
  onOpenChange,
}: {
  booking: BookingRecord | null
  canManage: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { courts, refresh } = useBookings()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<UpdateBookingInput>({
    resolver: zodResolver(updateBookingSchema),
    defaultValues: {
      id: '',
      title: '',
      courtId: '',
      date: '',
      startTime: '',
      endTime: '',
      notes: '',
    },
  })

  // Re-seed the form whenever a different booking is opened.
  useEffect(() => {
    setConfirmingDelete(false)
    if (!booking) return
    reset({
      id: booking.id,
      title: booking.title,
      courtId: booking.court_id,
      date: booking.date,
      startTime: booking.start_time.slice(0, 5),
      endTime: booking.end_time.slice(0, 5),
      notes: booking.notes ?? '',
    })
  }, [booking, reset])

  const onSubmit = handleSubmit(async (values) => {
    if (!canManage) return
    const result = await updateBooking(values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    await refresh()
    onOpenChange(false)
    toast.success(t.booking.updated)
  })

  async function handleDelete() {
    if (!booking) return
    setDeleting(true)
    const result = await deleteBooking(booking.id)
    setDeleting(false)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    await refresh()
    onOpenChange(false)
    toast.success(t.booking.deleted)
  }

  const busy = isSubmitting || deleting

  return (
    <Dialog open={booking !== null} onOpenChange={onOpenChange}>
      <DialogContent className="duration-75 data-open:slide-in-from-bottom-1 data-open:zoom-in-98">
        <DialogHeader>
          <DialogTitle>{canManage ? t.booking.editTitle : t.booking.detailsTitle}</DialogTitle>
          <DialogDescription>
            {canManage
              ? t.booking.editDescription
              : t.booking.detailsDescription(booking?.professor || t.booking.anotherMember)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-booking-title">{t.booking.titleLabel}</Label>
            <Input
              id="edit-booking-title"
              autoComplete="off"
              disabled={!canManage}
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-booking-court">{t.booking.courtLabel}</Label>
            <Controller
              name="courtId"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!canManage}
                >
                  <SelectTrigger id="edit-booking-court" aria-invalid={!!errors.courtId}>
                    <SelectValue placeholder={t.booking.selectCourt} />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.courtId && (
              <p className="text-xs text-destructive">{errors.courtId.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-booking-date">{t.booking.dateLabel}</Label>
            <Input
              id="edit-booking-date"
              type="date"
              disabled={!canManage}
              aria-invalid={!!errors.date}
              {...register('date')}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-booking-start">{t.booking.startLabel}</Label>
              <Input
                id="edit-booking-start"
                type="time"
                disabled={!canManage}
                aria-invalid={!!errors.startTime}
                {...register('startTime')}
              />
              {errors.startTime && (
                <p className="text-xs text-destructive">
                  {errors.startTime.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-booking-end">{t.booking.endLabel}</Label>
              <Input
                id="edit-booking-end"
                type="time"
                disabled={!canManage}
                aria-invalid={!!errors.endTime}
                {...register('endTime')}
              />
              {errors.endTime && (
                <p className="text-xs text-destructive">
                  {errors.endTime.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-booking-notes">
              {t.booking.notesLabel} <span className="text-muted-foreground">{t.common.optional}</span>
            </Label>
            <Textarea
              id="edit-booking-notes"
              rows={3}
              disabled={!canManage}
              {...register('notes')}
            />
          </div>

          {canManage ? (
            confirmingDelete ? (
              <DialogFooter className="sm:justify-between">
                <span className="text-sm text-muted-foreground">
                  {t.booking.deletePrompt}
                </span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    {t.booking.keep}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={busy}
                    onClick={handleDelete}
                  >
                    {t.booking.delete}
                  </Button>
                </div>
              </DialogFooter>
            ) : (
              <DialogFooter className="sm:justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  <RiDeleteBinLine className="size-4" />
                  {t.booking.delete}
                </Button>
                <div className="flex gap-2">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" disabled={busy}>
                      {t.booking.cancel}
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={busy}>
                    {t.booking.save}
                  </Button>
                </div>
              </DialogFooter>
            )
          ) : (
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  {t.booking.close}
                </Button>
              </DialogClose>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
