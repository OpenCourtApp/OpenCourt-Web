'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/shared/empty-state'
import { RiCalendarCheckLine, RiMapPinLine, RiPlayMiniFill } from '@remixicon/react'
import { useBookings } from '@/components/booking/bookings-provider'
import { courtColor, formatTime, timeToDecimal } from '@/lib/bookings/constants'

const railColor: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function UpcomingList() {
  const { bookings, courts } = useBookings()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const colorByCourt = useMemo(() => {
    const map = new Map<string, 1 | 2 | 3 | 4 | 5>()
    courts.forEach((c, i) => map.set(c.id, courtColor(i)))
    return map
  }, [courts])

  const upcoming = useMemo(() => {
    const today = format(now, 'yyyy-MM-dd')
    const nowDecimal = now.getHours() + now.getMinutes() / 60
    return bookings
      .filter((b) => b.date === today && timeToDecimal(b.end_time) > nowDecimal)
      .sort((a, b) => a.start_time.localeCompare(b.start_time))
      .map((b) => {
        const start = timeToDecimal(b.start_time)
        const end = timeToDecimal(b.end_time)
        const live = start <= nowDecimal
        return {
          ...b,
          live,
          startsIn: Math.max(0, Math.round((start - nowDecimal) * 60)),
          endsIn: Math.max(0, Math.round((end - nowDecimal) * 60)),
        }
      })
  }, [bookings, now])

  return (
    <Card size="sm" className="h-full">
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle>Upcoming Today</CardTitle>
        {upcoming.length > 0 && (
          <Badge variant="secondary" className="tabular-nums">
            {upcoming.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col px-2 pb-2">
        {upcoming.length > 0 ? (
          <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
            {upcoming.map((b) => {
              const color = railColor[colorByCourt.get(b.court_id) ?? 1]
              return (
                <li
                  key={b.id}
                  className={`flex items-stretch gap-3 rounded-lg p-2 transition-colors ${
                    b.live ? 'bg-muted/60' : 'hover:bg-muted/50'
                  }`}
                >
                  <span
                    className={`w-1 shrink-0 rounded-full ${color} ${b.live ? '' : 'opacity-40'}`}
                    aria-hidden
                  />
                  <div className="w-12 shrink-0 py-0.5">
                    <p className="text-sm font-semibold tabular-nums leading-none">
                      {formatTime(b.start_time)}
                    </p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground tabular-nums leading-none">
                      {formatTime(b.end_time)}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {b.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <RiMapPinLine className="size-3 shrink-0" />
                      {b.courtName}
                      {b.professor ? ` · ${b.professor}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center">
                    {b.live ? (
                      <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-primary">
                        <RiPlayMiniFill className="size-3.5" />
                        {durationLabel(b.endsIn)} left
                      </span>
                    ) : (
                      <span className="text-xs font-medium tabular-nums text-muted-foreground">
                        in {durationLabel(b.startsIn)}
                      </span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<RiCalendarCheckLine />}
            title="No bookings left today"
            description="New bookings for today will show up here."
            className="flex-1"
          />
        )}
      </CardContent>
    </Card>
  )
}
