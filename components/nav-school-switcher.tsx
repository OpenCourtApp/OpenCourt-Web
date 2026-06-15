'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import {
  RiAddLine,
  RiCheckLine,
  RiExpandUpDownLine,
} from '@remixicon/react'
import { switchSchool } from '@/lib/auth/actions'
import type { UserSchool } from '@/types'
import { ROLE_LABELS, t } from '@/lib/strings'
import { OpenCourtMark } from '@/components/shared/oc-logo'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

type NavSchoolSwitcherProps = {
  schools: UserSchool[]
  activeSchoolId: string | null
}

export function NavSchoolSwitcher({
  schools,
  activeSchoolId,
}: NavSchoolSwitcherProps) {
  const [isPending, startTransition] = useTransition()

  const activeSchool =
    schools.find((s) => s.school_id === activeSchoolId) ?? schools[0]

  function handleSwitch(schoolId: string) {
    if (schoolId === activeSchoolId || isPending) return
    startTransition(async () => {
      await switchSchool(schoolId)
      // Reload to pick up new session cookies + re-render server components
      window.location.reload()
    })
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <OpenCourtMark className="size-[30px]" />
              </div>
              <div className="grid flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">
                  {activeSchool?.school_name ?? 'OpenCourt'}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {activeSchool ? ROLE_LABELS[activeSchool.role] : ''}
                </span>
              </div>
              <RiExpandUpDownLine className="ml-auto size-4 shrink-0 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              {t.schoolSwitcher.organizations}
            </DropdownMenuLabel>
            {schools.map((school) => {
              const isActive = school.school_id === activeSchoolId
              return (
                <DropdownMenuItem
                  key={school.school_id}
                  onClick={() => handleSwitch(school.school_id)}
                  disabled={isPending}
                  className="gap-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <OpenCourtMark className="size-3.5 shrink-0" />
                  </div>
                  <span className="flex-1 truncate">{school.school_name}</span>
                  {isActive && (
                    <RiCheckLine className="ml-auto size-4 shrink-0 text-muted-foreground" />
                  )}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/onboarding" className="gap-2">
                <div className="flex size-6 items-center justify-center rounded-sm border bg-transparent">
                  <RiAddLine className="size-4" />
                </div>
                {t.schoolSwitcher.createOrganization}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
