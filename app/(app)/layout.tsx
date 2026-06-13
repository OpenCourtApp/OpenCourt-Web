'use client'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { HeaderUser } from '@/components/header-user'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import { HeaderProvider, useHeader } from '@/components/shared/header-context'
import { BookingsProvider } from '@/components/booking/bookings-provider'
import { FirstCourtGate } from '@/components/booking/first-court-gate'

function HeaderBar() {
  const { content } = useHeader()

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex flex-1 items-center justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <h1 className="truncate text-lg font-semibold tracking-tight">{content.title}</h1>
          {content.description && (
            <p className="truncate text-xs text-muted-foreground">{content.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {content.cta && <div>{content.cta}</div>}
          <Separator orientation="vertical" />
          <HeaderUser />
        </div>
      </div>
    </header>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="bg-sidebar">
          <HeaderProvider>
            <BookingsProvider>
              <HeaderBar />
              <div className="flex flex-1 flex-col p-4">
                <div className="flex flex-1 flex-col gap-4">
                  <FirstCourtGate>{children}</FirstCourtGate>
                </div>
              </div>
            </BookingsProvider>
          </HeaderProvider>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}
