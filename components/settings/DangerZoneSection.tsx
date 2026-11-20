'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getAccountDeletionStatus,
  type AccountDeletionStatus,
} from '@/lib/auth/actions'
import type { Role } from '@/types'
import { t } from '@/lib/strings'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DeleteSchoolDialog } from '@/components/settings/DeleteSchoolDialog'
import { LeaveSchoolDialog } from '@/components/settings/LeaveSchoolDialog'

type ActiveSchool = {
  id: string
  name: string
  role: Role
}

type MembershipRow = {
  school_id: string
  role: Role
  schools: { name: string } | { name: string }[] | null
}

/**
 * Single danger zone at the bottom of Settings. Principals manage both the
 * school and their own account here; members only manage their account (they
 * never need to delete the school first).
 */
export function DangerZoneSection() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<AccountDeletionStatus | null>(null)
  const [school, setSchool] = useState<ActiveSchool | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        if (active) setLoading(false)
        return
      }

      const activeSchoolId =
        (user.user_metadata?.active_school_id as string | undefined) ?? null

      const accountStatus = await getAccountDeletionStatus()

      let membership: MembershipRow | null = null

      if (activeSchoolId) {
        const { data } = await supabase
          .from('memberships')
          .select('school_id, role, schools(name)')
          .eq('user_id', user.id)
          .eq('school_id', activeSchoolId)
          .maybeSingle()

        membership = (data as MembershipRow | null) ?? null
      }

      if (!active) return

      setStatus(accountStatus)

      if (membership) {
        const embedded = (
          Array.isArray(membership.schools)
            ? membership.schools[0]
            : membership.schools
        ) as { name: string } | null

        setSchool({
          id: membership.school_id,
          name: embedded?.name ?? '',
          role: membership.role,
        })
      }

      setLoading(false)
    }

    load()

    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">
            {t.settings.dangerZone.title}
          </CardTitle>
          <CardDescription>{t.settings.dangerZone.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-40" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle className="text-destructive">
          {t.settings.dangerZone.title}
        </CardTitle>
        <CardDescription>{t.settings.dangerZone.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {school &&
          (school.role === 'principal' ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t.settings.dangerZone.deleteDescription}
              </p>
              <DeleteSchoolDialog school={school} />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {t.settings.dangerZone.leaveDescription}
              </p>
              <LeaveSchoolDialog school={school} />
            </div>
          ))}

        {status && (
          <div className="space-y-3 border-t pt-4">
            <h3 className="text-sm font-medium">
              {t.settings.dangerZone.accountTitle}
            </h3>
            {status.isPrincipal ? (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{t.settings.account.principalBlocked}</p>
                {status.principalSchools.length > 0 && (
                  <p>
                    {t.settings.account.principalSchools(
                      status.principalSchools.join(', ')
                    )}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>{t.settings.account.deleteNotAllowed}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
