'use client'

import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { Area, AreaChart, ResponsiveContainer, YAxis } from 'recharts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCalendarCheckLine,
  RiTimeLine,
  RiDoorOpenLine,
} from '@remixicon/react'
import { useBookings } from '@/components/booking/bookings-provider'
import { OPEN_HOURS, formatTime, timeToDecimal } from '@/lib/bookings/constants'

function fmtLocal(date: Date, offset = 0) {
  const d = new Date(date)
  if (offset) d.setDate(d.getDate() + offset)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Light the border arc nearest the cursor by feeding the pointer angle to CSS.
function handleGlow(e: MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  const angle = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
  el.style.setProperty('--start', String(angle + 60))
}

function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

export function StatsRow() {
  const { bookings, courts } = useBookings()
  const [now, setNow] = useState(() => new Date())

  // Re-initialize on client (SSR date may be wrong) and tick every 30s.
  useEffect(() => {
    setNow(new Date())
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const stats = useMemo(() => {
    const today = fmtLocal(now)
    const yesterday = fmtLocal(now, -1)
    const nowDecimal = now.getHours() + now.getMinutes() / 60

    const todays = bookings.filter((b) => b.date === today)
    const yesterdayCount = bookings.filter((b) => b.date === yesterday).length

    const live = todays.find(
      (b) =>
        timeToDecimal(b.start_time) <= nowDecimal &&
        nowDecimal < timeToDecimal(b.end_time)
    )

    let liveProgress = 0
    let liveRemaining = 0
    if (live) {
      const start = timeToDecimal(live.start_time)
      const end = timeToDecimal(live.end_time)
      liveProgress = Math.min(100, Math.max(0, ((nowDecimal - start) / (end - start)) * 100))
      liveRemaining = Math.max(0, Math.round((end - nowDecimal) * 60))
    }

    const trend =
      yesterdayCount > 0
        ? Math.round(((todays.length - yesterdayCount) / yesterdayCount) * 100)
        : null

    // Booking counts for the last 7 days (oldest → today) for the sparkline.
    const spark = Array.from({ length: 7 }, (_, i) => {
      const day = fmtLocal(now, -(6 - i))
      return { day, count: bookings.filter((b) => b.date === day).length }
    })

    const capacity = courts.length * OPEN_HOURS
    const bookedHours = todays.reduce(
      (sum, b) => sum + (timeToDecimal(b.end_time) - timeToDecimal(b.start_time)),
      0
    )
    const available = Math.max(0, Math.round(capacity - bookedHours))
    const occupancy = capacity > 0 ? Math.min(100, Math.round((bookedHours / capacity) * 100)) : 0

    return {
      live,
      liveProgress,
      liveRemaining,
      todaysCount: todays.length,
      yesterdayCount,
      trend,
      spark,
      capacity,
      available,
      occupancy,
    }
  }, [bookings, courts, now])

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 motion-safe:[&>*]:animate-in motion-safe:[&>*]:fade-in-0 motion-safe:[&>*]:slide-in-from-bottom-2 motion-safe:[&>*]:duration-300 motion-safe:[&>*:nth-child(2)]:delay-75 motion-safe:[&>*:nth-child(3)]:delay-150">
      {/* On Court Now */}
      <Card size="sm" className="glow-card" onMouseMove={handleGlow}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <StatLabel>On Court Now</StatLabel>
            {stats.live ? (
              <Badge className="gap-1.5 bg-success/15 text-success">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-80" />
                  <span className="relative inline-flex size-2 rounded-full bg-success shadow-[0_0_8px_var(--success)]" />
                </span>
                Live
              </Badge>
            ) : (
              <Badge variant="secondary">No session</Badge>
            )}
          </div>
          {stats.live ? (
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="space-y-0.5">
                <p className="truncate text-base font-semibold">
                  {stats.live.title}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {stats.live.professor || stats.live.courtName}
                </p>
              </div>
              <div className="space-y-1.5">
                <Progress value={stats.liveProgress} />
                <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
                  <span>{formatTime(stats.live.start_time)}</span>
                  <span className="font-medium text-foreground">
                    {stats.liveRemaining} min remaining
                  </span>
                  <span>{formatTime(stats.live.end_time)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 text-center text-muted-foreground">
              <RiTimeLine className="size-6 opacity-40" />
              <p className="text-sm">No active session right now</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's Bookings */}
      <Card size="sm" className="glow-card" onMouseMove={handleGlow}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <StatLabel>Today&apos;s Bookings</StatLabel>
            {stats.trend !== null && stats.trend !== 0 && (
              <Badge
                className={
                  stats.trend > 0
                    ? 'bg-success/10 text-success'
                    : 'bg-destructive/10 text-destructive'
                }
              >
                {stats.trend > 0 ? (
                  <RiArrowUpLine className="size-3" />
                ) : (
                  <RiArrowDownLine className="size-3" />
                )}
                {Math.abs(stats.trend)}%
              </Badge>
            )}
          </div>
          {stats.todaysCount > 0 || stats.yesterdayCount > 0 ? (
            <div className="flex flex-1 flex-col justify-between gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tabular-nums leading-none">
                  {stats.todaysCount}
                </span>
                <span className="text-sm text-muted-foreground">
                  {stats.todaysCount === 1 ? 'booking' : 'bookings'} today
                </span>
              </div>
              <div className="space-y-1.5">
                <div className="-mx-1 h-12 w-[calc(100%+0.5rem)]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={stats.spark}
                      margin={{ top: 6, right: 3, left: 3, bottom: 4 }}
                    >
                      <defs>
                        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <YAxis
                        hide
                        domain={[0, (max: number) => Math.max(1, max + 1)]}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="var(--chart-1)"
                        strokeWidth={2}
                        fill="url(#sparkFill)"
                        dot={false}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground">
                  Last 7 days · vs{' '}
                  <span className="font-medium text-foreground tabular-nums">
                    {stats.yesterdayCount}
                  </span>{' '}
                  yesterday
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 text-center text-muted-foreground">
              <RiCalendarCheckLine className="size-6 opacity-40" />
              <p className="text-sm">No bookings today yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Slots */}
      <Card size="sm" className="glow-card" onMouseMove={handleGlow}>
        <CardContent className="flex h-full flex-col gap-3">
          <div className="flex items-center justify-between">
            <StatLabel>Available Slots</StatLabel>
            {courts.length > 0 && (
              <Badge
                className={
                  stats.occupancy >= 50
                    ? 'bg-warning/10 text-warning'
                    : 'bg-success/10 text-success'
                }
              >
                {stats.occupancy >= 50 ? 'Busy' : 'Open'}
              </Badge>
            )}
          </div>
          {courts.length > 0 ? (
            <div className="flex flex-1 flex-col justify-between gap-3">
              <p className="text-3xl font-semibold tabular-nums">
                {stats.available}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  / {stats.capacity} available
                </span>
              </p>
              <div className="space-y-1.5">
                <Progress value={stats.occupancy} />
                <p className="text-xs text-muted-foreground">
                  {stats.occupancy}% occupancy today
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-2 text-center text-muted-foreground">
              <RiDoorOpenLine className="size-6 opacity-40" />
              <p className="text-sm">No court data available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
