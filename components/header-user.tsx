'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signOut } from '@/lib/auth/actions'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  RiArrowDownSLine,
  RiSettingsLine,
  RiLogoutBoxLine,
} from '@remixicon/react'
import type { Role } from '@/types'

const ROLE_LABELS: Record<Role, string> = {
  principal:   'Principal',
  teacher:     'Teacher',
  student_rep: 'Student Rep',
}

type HeaderUserData = { name: string; email: string; role: Role }

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function HeaderUser() {
  const [user, setUser] = useState<HeaderUserData | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData.user) return

      const activeSchoolId = authData.user.user_metadata?.active_school_id as
        | string
        | undefined

      const [{ data: profile }, { data: memberships }] = await Promise.all([
        supabase
          .from('users')
          .select('full_name, email')
          .eq('id', authData.user.id)
          .single(),
        supabase
          .from('memberships')
          .select('school_id, role')
          .eq('user_id', authData.user.id),
      ])

      if (!profile) return

      const role = (memberships ?? []).find(
        (m) => m.school_id === activeSchoolId
      )?.role as Role | undefined

      setUser({
        name:  profile.full_name,
        email: profile.email,
        role:  role ?? 'teacher',
      })
    }

    load()
  }, [])

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-2.5 w-14" />
        </div>
        <Skeleton className="size-9 rounded-full" />
      </div>
    )
  }

  const initials = getInitials(user.name)

  async function handleLogout() {
    await signOut()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
        >
          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="max-w-[10rem] truncate text-sm font-medium">
              {user.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {ROLE_LABELS[user.role]}
            </span>
          </div>
          <Avatar className="size-9 rounded-full">
            <AvatarFallback className="rounded-full bg-muted text-muted-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <RiArrowDownSLine className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-60 rounded-xl" align="end" sideOffset={8}>
        <DropdownMenuLabel className="p-0 font-normal">
          <div className="flex items-center gap-3 px-2 py-2 text-left text-sm">
            <Avatar className="size-9 rounded-full">
              <AvatarFallback className="rounded-full bg-muted text-muted-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="grid flex-1 leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">
                {user.email}
              </span>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {ROLE_LABELS[user.role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="gap-2">
            <Link href="/settings">
              <RiSettingsLine className="text-muted-foreground" />
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          variant="destructive"
          className="gap-2"
        >
          <RiLogoutBoxLine />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
