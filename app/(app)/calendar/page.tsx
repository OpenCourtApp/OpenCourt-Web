'use client'

import { useEffect } from 'react'
import { useHeader } from '@/components/shared/header-context'
import { NewBookingDialog } from '@/components/booking/new-booking-dialog'
import { BigCalendarView } from '@/components/calendar/big-calendar-view'

export default function CalendarPage() {
  const { setContent } = useHeader()

  useEffect(() => {
    setContent({
      title: 'Calendar',
      description: 'Weekly view of court bookings',
      cta: <NewBookingDialog />,
    })
    return () => setContent({ title: '' })
  }, [setContent])

  return <BigCalendarView />
}
