'use client'

import { useEffect } from 'react'
import { useHeader } from '@/components/shared/header-context'
import { NewBookingDialog } from '@/components/booking/new-booking-dialog'
import { BigCalendarView } from '@/components/calendar/big-calendar-view'
import { t } from '@/lib/strings'

export default function CalendarPage() {
  const { setContent } = useHeader()

  useEffect(() => {
    setContent({
      title: t.header.calendar.title,
      description: t.header.calendar.description,
      cta: <NewBookingDialog />,
    })
    return () => setContent({ title: '' })
  }, [setContent])

  return <BigCalendarView />
}
