'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, addWeeks, format, isToday, startOfWeek } from 'date-fns'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  useBookings,
  type BookingRecord,
} from '@/components/booking/bookings-provider'
import { EditBookingDialog } from '@/components/booking/edit-booking-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMapPinLine,
} from '@remixicon/react'
import {
  DAY_END,
  DAY_START,
  courtColor,
  decimalToTime,
  timeToDecimal,
} from '@/lib/bookings/constants'

const HOUR_HEIGHT = 56 // px per hour

type CalBooking = {
  record: BookingRecord
  title: string
  professor: string
  court: string
  /** 0 = Monday … 6 = Sunday */
  day: number
  /** decimal hours, e.g. 14.5 = 14:30 */
  start: number
  end: number
  color: 1 | 2 | 3 | 4 | 5
}

// Solid left accent bar in the court's color (identity), while the block fill
// encodes ownership (yours vs. another member's).
const barClasses: Record<CalBooking['color'], string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
}

export function WeeklyCalendar() {
  const [anchor, setAnchor] = useState(() => new Date())
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [editing, setEditing] = useState<BookingRecord | null>(null)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setAnchor(new Date())
    setNow(new Date())
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
      setIsPrincipal(data.user?.user_metadata?.role === 'principal')
    })
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const { courts, bookings: records } = useBookings()

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor]
  )
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  )
  // 'yyyy-MM-dd' per column — matched against the booking's stored date string
  // (timezone-proof, unlike parsing the date into a Date first).
  const dayKeys = useMemo(() => days.map((d) => format(d, 'yyyy-MM-dd')), [days])
  const hours = useMemo(
    () => Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i),
    []
  )

  // Stable color per court, by its position in the school's court list.
  const courtColorById = useMemo(() => {
    const map = new Map<string, 1 | 2 | 3 | 4 | 5>()
    courts.forEach((c, i) => map.set(c.id, courtColor(i)))
    return map
  }, [courts])

  // Map this week's bookings onto the grid.
  const bookings = useMemo<CalBooking[]>(() => {
    return records.flatMap((b) => {
      const day = dayKeys.indexOf(b.date)
      if (day < 0) return []
      return [
        {
          record: b,
          title: b.title,
          professor: b.professor,
          court: b.courtName,
          day,
          start: timeToDecimal(b.start_time),
          end: timeToDecimal(b.end_time),
          color: courtColorById.get(b.court_id) ?? 1,
        },
      ]
    })
  }, [records, dayKeys, courtColorById])

  const rangeLabel = `${format(weekStart, 'MMM d')} – ${format(
    addDays(weekStart, 6),
    'MMM d, yyyy'
  )}`

  const totalBookings = bookings.length

  // Current-time line (only drawn on today's column when within view hours).
  const nowDecimal = now.getHours() + now.getMinutes() / 60
  const showNowLine = nowDecimal >= DAY_START && nowDecimal <= DAY_END

  const canManage = (b: BookingRecord) =>
    isPrincipal || (currentUserId !== null && b.booked_by === currentUserId)

  return (
    <Card className="flex flex-1 flex-col overflow-hidden [--card-spacing:0px]">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </Button>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Previous week"
              onClick={() => setAnchor((d) => addWeeks(d, -1))}
            >
              <RiArrowLeftSLine className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Next week"
              onClick={() => setAnchor((d) => addWeeks(d, 1))}
            >
              <RiArrowRightSLine className="size-4" />
            </Button>
          </div>
          <h2 className="text-sm font-medium tabular-nums">{rangeLabel}</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] bg-primary" />
              You
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-[3px] border border-border bg-secondary" />
              Others
            </span>
          </div>
          <Badge variant="secondary">
            {totalBookings} {totalBookings === 1 ? 'booking' : 'bookings'}
          </Badge>
        </div>
      </div>

      {/* Day header row */}
      <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b">
        <div className="border-r" />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className="flex flex-col items-center gap-1 border-r py-2 last:border-r-0"
            >
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                {format(day, 'EEE')}
              </span>
              <span
                className={cn(
                  'flex size-7 items-center justify-center rounded-full text-sm tabular-nums',
                  today
                    ? 'bg-primary font-semibold text-primary-foreground'
                    : 'text-foreground'
                )}
              >
                {format(day, 'd')}
              </span>
            </div>
          )
        })}
      </div>

      {/* Scrollable time grid — fixed height vs. the viewport so every hour is reachable */}
      <div className="h-[calc(100svh-13rem)] overflow-y-auto">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          {/* Time gutter */}
          <div className="border-r">
            {hours.map((h) => (
              <div
                key={h}
                className="relative border-b"
                style={{ height: HOUR_HEIGHT }}
              >
                {/* sits below the hour line so the gridline never crosses the text */}
                <span className="absolute right-2 top-1 text-[0.7rem] tabular-nums text-muted-foreground">
                  {decimalToTime(h)}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayBookings = bookings.filter((b) => b.day === dayIndex)
            return (
              <div
                key={day.toISOString()}
                className="relative border-r last:border-r-0"
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="border-b"
                    style={{ height: HOUR_HEIGHT }}
                  />
                ))}
                {isToday(day) && showNowLine && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20"
                    style={{ top: (nowDecimal - DAY_START) * HOUR_HEIGHT }}
                  >
                    <div className="relative border-t-2 border-primary">
                      <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-primary" />
                    </div>
                  </div>
                )}
                {dayBookings.map((b) => {
                  const top = (b.start - DAY_START) * HOUR_HEIGHT
                  const height = (b.end - b.start) * HOUR_HEIGHT
                  const mine =
                    currentUserId !== null && b.record.booked_by === currentUserId
                  const metaClass = cn(
                    'truncate text-[0.7rem] tabular-nums',
                    mine ? 'text-primary-foreground/75' : 'text-muted-foreground'
                  )
                  return (
                    <button
                      key={b.record.id}
                      type="button"
                      title={`${b.title} · ${decimalToTime(b.start)}–${decimalToTime(b.end)} · ${b.court}${b.professor ? ` · ${b.professor}` : ''}`}
                      onClick={() => setEditing(b.record)}
                      className={cn(
                        'group absolute inset-x-1 flex flex-col overflow-hidden rounded-md border py-1 pl-2.5 pr-1.5 text-left shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        mine
                          ? 'border-primary/60 bg-primary text-primary-foreground'
                          : 'border-border bg-secondary text-secondary-foreground'
                      )}
                      style={{ top: top + 2, height: height - 4 }}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          'absolute inset-y-0 left-0 w-1',
                          barClasses[b.color]
                        )}
                      />
                      <span className="truncate text-xs font-medium leading-tight">
                        {b.title}
                      </span>
                      {height >= 38 && (
                        <span className={metaClass}>
                          {decimalToTime(b.start)}–{decimalToTime(b.end)}
                        </span>
                      )}
                      {height >= 64 && (
                        <span
                          className={cn(
                            'mt-auto flex items-center gap-1 truncate text-[0.7rem]',
                            mine
                              ? 'text-primary-foreground/75'
                              : 'text-muted-foreground'
                          )}
                        >
                          <RiMapPinLine className="size-3 shrink-0" />
                          {b.court}
                          {b.professor ? ` · ${b.professor}` : ''}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      <EditBookingDialog
        booking={editing}
        canManage={editing ? canManage(editing) : false}
        onOpenChange={(open) => {
          if (!open) setEditing(null)
        }}
      />
    </Card>
  )
}
