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

const ROLE_LABELS: Record<Role, string> = {
  principal:   'Principal',
  teacher:     'Teacher',
  student_rep: 'Student Rep',
}

function RoleBadge({ role }: { role: Role }) {
  if (role === 'principal') {
    return <Badge className="bg-success/10 text-success">Principal</Badge>
  }
  if (role === 'teacher') {
    return <Badge className="bg-muted text-muted-foreground">Teacher</Badge>
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
        <CardTitle>Institutions</CardTitle>
        <CardDescription>
          Schools you belong to. Click a school to make it active.
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
            You are not a member of any school yet.
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
                      Switch
                    </Button>
                  )}
                  {isActive && (
                    <span className="text-xs text-muted-foreground">Active</span>
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
