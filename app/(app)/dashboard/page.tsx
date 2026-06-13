'use client'

import { useEffect } from 'react'
import { format } from 'date-fns'
import { useHeader } from '@/components/shared/header-context'
import { NewBookingDialog } from '@/components/booking/new-booking-dialog'
import { StatsRow } from '@/components/dashboard/stats-row'
import { WeeklyChart } from '@/components/dashboard/weekly-chart'
import { UpcomingList } from '@/components/dashboard/upcoming-list'

export default function DashboardPage() {
  const { setContent } = useHeader()

  useEffect(() => {
    setContent({
      title: 'Dashboard',
      description: format(new Date(), 'EEEE, MMMM d, yyyy'),
      cta: <NewBookingDialog />,
    })
    return () => setContent({ title: '' })
  }, [setContent])

  return (
    <div className="flex flex-1 flex-col gap-4">
      <StatsRow />
      <div className="grid flex-1 grid-cols-1 gap-4 lg:auto-rows-fr lg:grid-cols-3">
        <div className="flex flex-col lg:col-span-2">
          <WeeklyChart />
        </div>
        <UpcomingList />
      </div>
    </div>
  )
}
