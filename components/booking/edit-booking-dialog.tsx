'use client'

import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { updateBooking } from '@/lib/bookings/actions'
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

export function EditBookingDialog({
  booking,
  onOpenChange,
}: {
  booking: BookingRecord | null
  onOpenChange: (open: boolean) => void
}) {
  const { courts, refresh } = useBookings()

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
    const result = await updateBooking(values)
    if (result?.error) {
      toast.error(result.error)
      return
    }
    await refresh()
    onOpenChange(false)
    toast.success('Booking updated')
  })

  return (
    <Dialog open={booking !== null} onOpenChange={onOpenChange}>
      <DialogContent className="duration-75 data-open:slide-in-from-bottom-1 data-open:zoom-in-98">
        <DialogHeader>
          <DialogTitle>Edit booking</DialogTitle>
          <DialogDescription>
            Update the title, court, day or time slot for this session.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="edit-booking-title">Title</Label>
            <Input
              id="edit-booking-title"
              autoComplete="off"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="edit-booking-court">Court</Label>
            <Controller
              name="courtId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="edit-booking-court" aria-invalid={!!errors.courtId}>
                    <SelectValue placeholder="Select a court" />
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
            <Label htmlFor="edit-booking-date">Date</Label>
            <Input
              id="edit-booking-date"
              type="date"
              aria-invalid={!!errors.date}
              {...register('date')}
            />
            {errors.date && (
              <p className="text-xs text-destructive">{errors.date.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-booking-start">Start</Label>
              <Input
                id="edit-booking-start"
                type="time"
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
              <Label htmlFor="edit-booking-end">End</Label>
              <Input
                id="edit-booking-end"
                type="time"
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
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="edit-booking-notes"
              rows={3}
              {...register('notes')}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isSubmitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
