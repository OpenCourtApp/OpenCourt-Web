'use client'

import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { createBooking } from '@/lib/bookings/actions'
import {
  createBookingSchema,
  type CreateBookingInput,
} from '@/lib/bookings/validation'
import { useBookings } from '@/components/booking/bookings-provider'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RiAddLine } from '@remixicon/react'

function todayValue() {
  // yyyy-MM-dd for the native date input, in local time
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export function NewBookingDialog() {
  const [open, setOpen] = useState(false)
  const { courts, refresh } = useBookings()

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateBookingInput>({
    resolver: zodResolver(createBookingSchema),
    defaultValues: {
      title:     '',
      courtId:   '',
      date:      todayValue(),
      startTime: '',
      endTime:   '',
      notes:     '',
    },
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) reset()
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await createBooking(values)

    if (result?.error) {
      toast.error(result.error)
      return
    }

    await refresh()
    setOpen(false)
    reset()
    toast.success('Booking created', {
      description: `${values.title} · ${values.startTime}–${values.endTime}`,
    })
  })

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="group relative overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 before:pointer-events-none before:absolute before:inset-0 before:-translate-x-[150%] before:skew-x-[-20deg] before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent before:transition-transform before:duration-700 before:ease-out hover:before:translate-x-[150%]">
          <RiAddLine className="size-4 transition-transform duration-200 group-hover:rotate-90" />
          New Booking
        </Button>
      </DialogTrigger>
      <DialogContent
        className="duration-75 data-open:slide-in-from-bottom-1 data-open:zoom-in-98"
      >
        <DialogHeader>
          <DialogTitle>New booking</DialogTitle>
          <DialogDescription>
            Reserve a court for a session. Pick the court, day and time slot.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="booking-title">Title</Label>
            <Input
              id="booking-title"
              placeholder="Tennis Basics"
              autoComplete="off"
              aria-invalid={!!errors.title}
              {...register('title')}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="booking-court">Court</Label>
            <Controller
              name="courtId"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="booking-court" aria-invalid={!!errors.courtId}>
                    <SelectValue
                      placeholder={
                        courts.length ? 'Select a court' : 'No courts available'
                      }
                    />
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
            <Label htmlFor="booking-date">Date</Label>
            <Input
              id="booking-date"
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
              <Label htmlFor="booking-start">Start</Label>
              <Input
                id="booking-start"
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
              <Label htmlFor="booking-end">End</Label>
              <Input
                id="booking-end"
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
            <Label htmlFor="booking-notes">
              Notes <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="booking-notes"
              placeholder="Anything the staff should know…"
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
              Create booking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
