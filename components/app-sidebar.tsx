'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { NavMain } from '@/components/nav-main'
import type { NavItem } from '@/components/nav-main'
import { NavSchoolSwitcher } from '@/components/nav-school-switcher'
import { OpenCourtLogo, OpenCourtMark } from '@/components/shared/oc-logo'
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

function NavSwitcherSkeleton() {
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

      const { data: memberships } = await supabase
        .from('memberships')
        .select('school_id, role, schools(name)')
        .eq('user_id', authData.user.id)

      const schools: UserSchool[] = (memberships ?? []).map((m) => ({
        school_id:   m.school_id,
        school_name: (m.schools as { name: string } | null)?.name ?? '',
        role:        m.role as Role,
      }))

      setData({ schools, activeSchoolId })
    }

    load()
  }, [])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          href="/dashboard"
          aria-label="Go to dashboard"
          className="relative flex h-12 items-center rounded-lg px-4 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2"
        >
          <div className="transition-all duration-200 ease-out delay-200 group-data-[collapsible=icon]:duration-0 group-data-[collapsible=icon]:delay-0 opacity-100 group-data-[collapsible=icon]:opacity-0 group-data-[collapsible=icon]:pointer-events-none">
            <OpenCourtLogo className="h-5 w-auto text-sidebar-foreground" />
          </div>
          <div className="transition-all duration-200 ease-out delay-0 group-data-[collapsible=icon]:delay-200 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center opacity-0 group-data-[collapsible=icon]:opacity-100 pointer-events-none group-data-[collapsible=icon]:pointer-events-auto">
            <OpenCourtMark className="size-7 text-sidebar-foreground" />
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        {data ? (
          <NavSchoolSwitcher
            schools={data.schools}
            activeSchoolId={data.activeSchoolId}
          />
        ) : (
          <NavSwitcherSkeleton />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
