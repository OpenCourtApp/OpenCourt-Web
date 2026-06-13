'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { NavMain } from '@/components/nav-main'
import type { NavItem } from '@/components/nav-main'
import { NavSchoolSwitcher } from '@/components/nav-school-switcher'
import { NavUser } from '@/components/nav-user'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import {
  RiDashboardLine,
  RiCalendarCheckLine,
  RiBasketballLine,
  RiTeamLine,
} from '@remixicon/react'
import type { Role, UserSchool } from '@/types'

const navItems: NavItem[] = [
  { title: 'Dashboard',      url: '/dashboard',     icon: <RiDashboardLine /> },
  { title: 'Calendar',       url: '/calendar',      icon: <RiCalendarCheckLine /> },
  { title: 'Courts',         url: '/courts',        icon: <RiBasketballLine /> },
  { title: 'Collaborators',  url: '/collaborators', icon: <RiTeamLine /> },
]

/** Avatar + two lines, collapses to the avatar-sized square in icon mode. */
function NavRowSkeleton() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="grid flex-1 gap-1.5 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-2.5 w-16" />
          </div>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

type SidebarData = {
  schools: UserSchool[]
  activeSchoolId: string | null
  user: { name: string; email: string; role: Role }
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [data, setData] = useState<SidebarData | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const activeSchoolId =
        (authData.user.user_metadata?.active_school_id as string | undefined) ??
        null

      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase
          .from('users')
          .select('full_name, email')
          .eq('id', authData.user.id)
          .single(),
        supabase
          .from('memberships')
          .select('school_id, role, schools(name)')
          .eq('user_id', authData.user.id),
      ])

      const schools: UserSchool[] = (memberships ?? []).map((m) => ({
        school_id:   m.school_id,
        school_name: (m.schools as { name: string } | null)?.name ?? '',
        role:        m.role as Role,
      }))

      const role =
        ((memberships ?? []).find((m) => m.school_id === activeSchoolId)
          ?.role as Role | undefined) ?? 'teacher'

      setData({
        schools,
        activeSchoolId,
        user: {
          name:  profile?.full_name ?? authData.user.email ?? '',
          email: profile?.email ?? authData.user.email ?? '',
          role,
        },
      })
    }

    load()
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Workspace context at the top — the school switcher doubles as branding */}
      <SidebarHeader>
        {data ? (
          <NavSchoolSwitcher
            schools={data.schools}
            activeSchoolId={data.activeSchoolId}
          />
        ) : (
          <NavRowSkeleton />
        )}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      {/* Personal account at the bottom */}
      <SidebarFooter>
        {data ? <NavUser user={data.user} /> : <NavRowSkeleton />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
