'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

export function NotificationsPanel() {
  const [emailNewBooking, setEmailNewBooking] = useState(true)
  const [emailBookingChanges, setEmailBookingChanges] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Choose what updates you receive via email</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="email-new-booking" className="cursor-pointer">
              Email on new booking
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive an email when a new booking is created
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
              Email on booking changes
            </Label>
            <p className="text-xs text-muted-foreground">
              Receive an email when a booking is updated or cancelled
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
