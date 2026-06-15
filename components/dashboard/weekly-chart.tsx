'use client'

import { useEffect, useMemo, useState } from 'react'
import { differenceInCalendarDays, startOfWeek } from 'date-fns'
import { Area, AreaChart, XAxis, YAxis } from 'recharts'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { EmptyState } from '@/components/shared/empty-state'
import { RiBarChartLine } from '@remixicon/react'
import { useBookings } from '@/components/booking/bookings-provider'
import { t } from '@/lib/strings'

const WEEKDAYS = t.dashboard.weekly.weekdays

const chartConfig = {
  count: { label: t.dashboard.weekly.seriesLabel, color: 'var(--chart-1)' },
} satisfies ChartConfig

export function WeeklyChart() {
  const { bookings } = useBookings()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    setNow(new Date())
  }, [])

  const data = useMemo(() => {
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const counts = WEEKDAYS.map((day) => ({ day, count: 0 }))
    for (const b of bookings) {
      // Parse the booking date in LOCAL time (no 'Z'). `weekStart` and
      // differenceInCalendarDays are local, so a UTC parse shifts every date a
      // day earlier in negative-UTC zones (e.g. BRT-3) — dropping Mondays.
      const index = differenceInCalendarDays(new Date(b.date + 'T00:00:00'), weekStart)
      if (index >= 0 && index <= 6) counts[index].count += 1
    }
    return counts
  }, [bookings, now])

  const hasData = data.some((d) => d.count > 0)

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle>{t.dashboard.weekly.title}</CardTitle>
            <CardDescription>{t.dashboard.weekly.range}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        {hasData ? (
          <div className="relative flex min-h-0 flex-1 flex-col">
            {/* Modern dot-matrix grid behind the plot area */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-y-2 left-8 right-2 bottom-7 [background-image:radial-gradient(var(--muted-foreground)_1px,transparent_1px)] [background-size:24px_24px] opacity-20"
            />
            <ChartContainer
              config={chartConfig}
              className="relative aspect-auto h-full min-h-[240px] w-full flex-1"
            >
              <AreaChart
                accessibilityLayer
                data={data}
                margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillCount" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="var(--color-count)"
                      stopOpacity={0.4}
                    />
                    <stop
                      offset="100%"
                      stopColor="var(--color-count)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={10}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  domain={[0, (max: number) => Math.max(1, max + 1)]}
                />
                <ChartTooltip
                  cursor={{
                    stroke: 'var(--color-count)',
                    strokeWidth: 1.5,
                    strokeOpacity: 0.4,
                    strokeDasharray: '4 4',
                  }}
                  content={<ChartTooltipContent indicator="dot" />}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-count)"
                  strokeWidth={2.5}
                  fill="url(#fillCount)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: 'var(--color-count)',
                    stroke: 'var(--background)',
                    strokeWidth: 2,
                    className: 'drop-shadow-[0_0_6px_var(--color-count)]',
                  }}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        ) : (
          <EmptyState
            icon={<RiBarChartLine />}
            title={t.dashboard.weekly.empty}
            description={t.dashboard.weekly.emptyHint}
            className="flex-1"
          />
        )}
      </CardContent>
    </Card>
  )
}
