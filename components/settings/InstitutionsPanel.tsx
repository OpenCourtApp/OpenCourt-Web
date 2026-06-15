'use client'

import { useEffect, useTransition, useState } from 'react'
import { RiCheckLine } from '@remixicon/react'
import { createClient } from '@/lib/supabase/client'
import { switchSchool } from '@/lib/auth/actions'
import type { Role, UserSchool } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ROLE_LABELS, t } from '@/lib/strings'

function RoleBadge({ role }: { role: Role }) {
  if (role === 'principal') {
    return <Badge className="bg-success/10 text-success">{ROLE_LABELS.principal}</Badge>
  }
  if (role === 'teacher') {
    return <Badge className="bg-muted text-muted-foreground">{ROLE_LABELS.teacher}</Badge>
  }
  return (
    <Badge variant="outline" className="border-primary/40 bg-transparent text-primary">
      {ROLE_LABELS[role]}
    </Badge>
  )
}

export function InstitutionsPanel() {
  const [schools, setSchools] = useState<UserSchool[] | null>(null)
  const [activeSchoolId, setActiveSchoolId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      setActiveSchoolId(
        (authData.user.user_metadata?.active_school_id as string | undefined) ?? null
      )

      const { data: memberships } = await supabase
        .from('memberships')
        .select('school_id, role, schools(name)')
        .eq('user_id', authData.user.id)

      const list: UserSchool[] = (memberships ?? []).map((m) => ({
        school_id:   m.school_id,
        school_name: (m.schools as unknown as { name: string } | null)?.name ?? '',
        role:        m.role as Role,
      }))
      setSchools(list)
    }

    load()
  }, [])

  function handleSwitch(schoolId: string) {
    if (schoolId === activeSchoolId || isPending) return
    startTransition(async () => {
      const result = await switchSchool(schoolId)
      if (!result?.error) {
        window.location.reload()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.settings.institutions.title}</CardTitle>
        <CardDescription>
          {t.settings.institutions.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {schools === null ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : schools.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t.settings.institutions.none}
          </p>
        ) : (
          <ul className="divide-y">
            {schools.map((school) => {
              const isActive = school.school_id === activeSchoolId
              return (
                <li key={school.school_id} className="flex items-center gap-3 py-3">
                  <div className="flex flex-1 items-center gap-3 truncate">
                    <RiCheckLine
                      className={`size-4 shrink-0 transition-opacity ${
                        isActive ? 'text-success opacity-100' : 'opacity-0'
                      }`}
                    />
                    <span className="truncate font-medium">
                      {school.school_name}
                    </span>
                    <RoleBadge role={school.role} />
                  </div>
                  {!isActive && schools.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleSwitch(school.school_id)}
                    >
                      {t.settings.institutions.switch}
                    </Button>
                  )}
                  {isActive && (
                    <span className="text-xs text-muted-foreground">{t.settings.institutions.active}</span>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
