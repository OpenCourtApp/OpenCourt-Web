'use client'

import { useEffect, useMemo, useState } from 'react'
import moment from 'moment'
import 'moment/locale/pt-br'
import {
  momentLocalizer,
  Views,
  type View,
  type Event,
  type Formats,
  type ToolbarProps,
  type CalendarProps,
  type Components,
  type EventProps,
} from 'react-big-calendar'
import ShadcnBigCalendar from '@/components/shadcn-big-calendar/shadcn-big-calendar'

// Pin the generic to our event type. Re-inferring it on every prop made the
// TypeScript checker blow its memory budget during `next build`.
const Calendar = ShadcnBigCalendar as unknown as (
  props: CalendarProps<CalEvent, object>
) => React.JSX.Element
import { createClient } from '@/lib/supabase/client'
import {
  useBookings,
  type BookingRecord,
} from '@/components/booking/bookings-provider'
import { EditBookingDialog } from '@/components/booking/edit-booking-dialog'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiMapPinLine,
} from '@remixicon/react'
import { DAY_START, DAY_END } from '@/lib/bookings/constants'
import { t } from '@/lib/strings'

moment.locale('pt-br')
const localizer = momentLocalizer(moment)

type CalEvent = Event & {
  id: string
  start: Date
  end: Date
  resource: BookingRecord
}

/** 'yyyy-MM-dd' + 'HH:mm[:ss]' → a local Date (timezone-proof, no parsing). */
function toDate(date: string, time: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return new Date(y, m - 1, d, hh, mm)
}

// Limit the visible window to operating hours (07:00–21:00).
const minTime = new Date(1970, 0, 1, DAY_START, 0, 0)
const maxTime = new Date(1970, 0, 1, DAY_END, 0, 0)
const scrollToTime = new Date(1970, 0, 1, DAY_START, 0, 0)

// 24-hour clock to match the app's HH:mm convention everywhere.
const formats: Formats = {
  timeGutterFormat: 'HH:mm',
  eventTimeRangeFormat: ({ start, end }, culture, loc) =>
    `${loc!.format(start, 'HH:mm', culture)} – ${loc!.format(end, 'HH:mm', culture)}`,
  dayRangeHeaderFormat: ({ start, end }, culture, loc) =>
    `${loc!.format(start, 'MMM D', culture)} – ${loc!.format(end, 'MMM D, YYYY', culture)}`,
}

const VIEWS: View[] = [Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]

/** Booking block content — mirrors the old card (title + court + professor). */
function EventCell({ event }: EventProps<CalEvent>) {
  const b = event.resource
  return (
    <div className="flex h-full flex-col gap-0.5 overflow-hidden leading-tight">
      <span className="truncate text-xs font-medium">{b.title}</span>
      {b.courtName && (
        <span className="flex items-center gap-1 truncate text-[0.7rem] opacity-80">
          <RiMapPinLine className="size-3 shrink-0" />
          <span className="truncate">
            {b.courtName}
            {b.professor ? ` · ${b.professor}` : ''}
          </span>
        </span>
      )}
    </div>
  )
}

/** App-native toolbar: matches button styles + a segmented view switcher. */
function CalendarToolbar({
  label,
  view,
  onNavigate,
  onView,
}: ToolbarProps<CalEvent, object>) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2.5">
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => onNavigate('TODAY')}>
          {t.calendar.today}
        </Button>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t.calendar.previous}
            onClick={() => onNavigate('PREV')}
          >
            <RiArrowLeftSLine className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={t.calendar.next}
            onClick={() => onNavigate('NEXT')}
          >
            <RiArrowRightSLine className="size-4" />
          </Button>
        </div>
        <h2 className="text-sm font-medium tabular-nums">{label}</h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-primary" />
            {t.calendar.legendYou}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] border border-border bg-secondary" />
            {t.calendar.legendOthers}
          </span>
        </div>
        <div className="flex items-center rounded-lg bg-muted p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onView(v)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors',
                view === v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.calendar.views[v as keyof typeof t.calendar.views]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const calendarComponents: Components<CalEvent, object> = {
  toolbar: CalendarToolbar,
  event: EventCell,
}

export function BigCalendarView() {
  const { bookings } = useBookings()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isPrincipal, setIsPrincipal] = useState(false)
  const [editing, setEditing] = useState<BookingRecord | null>(null)
  const [view, setView] = useState<View>(Views.WEEK)
  const [date, setDate] = useState<Date>(() => new Date())

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
      setIsPrincipal(data.user?.user_metadata?.role === 'principal')
    })
  }, [])

  const events = useMemo<CalEvent[]>(
    () =>
      bookings.map((b) => ({
        id: b.id,
        title: b.title,
        start: toDate(b.date, b.start_time),
        end: toDate(b.date, b.end_time),
        resource: b,
      })),
    [bookings]
  )

  const canManage = (b: BookingRecord) =>
    isPrincipal || (currentUserId !== null && b.booked_by === currentUserId)

  return (
    <Card className="flex flex-1 flex-col overflow-hidden p-0">
      {/* Fills the remaining Card height responsively (no magic px). RBC needs
          an explicit height, which `style={{ height: '100%' }}` resolves from
          this flex-1 box; `min-h-0` lets it shrink so the calendar's own
          internal scroll (Day/Week) handles overflow — no nested scroller. */}
      <div className="min-h-0 flex-1">
        <Calendar
          localizer={localizer}
          events={events}
          components={calendarComponents}
          formats={formats}
          messages={t.calendar.messages}
          style={{ height: '100%' }}
          view={view}
          onView={setView}
          date={date}
          onNavigate={setDate}
          views={VIEWS}
          step={30}
          timeslots={2}
          min={minTime}
          max={maxTime}
          scrollToTime={scrollToTime}
          popup
          onSelectEvent={(event) => setEditing((event as CalEvent).resource)}
          tooltipAccessor={(event) => {
            const b = (event as CalEvent).resource
            return `${b.title} · ${b.courtName}${b.professor ? ` · ${b.professor}` : ''}`
          }}
          eventPropGetter={(event) => ({
            // Ownership encodes the event color: yours (primary) vs. another
            // member's (secondary) — matches the registry CSS variants.
            className:
              currentUserId !== null &&
              (event as CalEvent).resource.booked_by === currentUserId
                ? 'event-variant-primary'
                : 'event-variant-secondary',
          })}
        />
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
