'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { t } from '@/lib/strings'

export function NotificationsPanel() {
  const [emailNewBooking, setEmailNewBooking] = useState(true)
  const [emailBookingChanges, setEmailBookingChanges] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.notifications.title}</CardTitle>
        <CardDescription>{t.settings.notifications.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="email-new-booking" className="cursor-pointer">
              {t.settings.notifications.newBooking}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t.settings.notifications.newBookingDesc}
            </p>
          </div>
          <Switch
            id="email-new-booking"
            checked={emailNewBooking}
            onCheckedChange={setEmailNewBooking}
          />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="email-booking-changes" className="cursor-pointer">
              {t.settings.notifications.bookingChanges}
            </Label>
            <p className="text-xs text-muted-foreground">
              {t.settings.notifications.bookingChangesDesc}
            </p>
          </div>
          <Switch
            id="email-booking-changes"
            checked={emailBookingChanges}
            onCheckedChange={setEmailBookingChanges}
          />
        </div>
      </CardContent>
    </Card>
  )
}
