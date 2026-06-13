'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useHeader } from '@/components/shared/header-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ProfileForm } from '@/components/settings/ProfileForm'
import { InstitutionsPanel } from '@/components/settings/InstitutionsPanel'
import { AuthorizationPanel } from '@/components/settings/AuthorizationPanel'
import { NotificationsPanel } from '@/components/settings/NotificationsPanel'
import { AppearancePanel } from '@/components/settings/AppearancePanel'
import {
  RiUserLine,
  RiSchoolLine,
  RiKey2Line,
  RiNotification3Line,
  RiPaletteLine,
} from '@remixicon/react'

const sections = [
  { id: 'profile',       label: 'Profile',       icon: RiUserLine },
  { id: 'institutions',  label: 'Institutions',  icon: RiSchoolLine },
  { id: 'authorization', label: 'Authorization', icon: RiKey2Line },
  { id: 'notifications', label: 'Notifications', icon: RiNotification3Line },
  { id: 'appearance',    label: 'Appearance',    icon: RiPaletteLine },
] as const

type SectionId = (typeof sections)[number]['id']

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SectionId>('profile')
  const { setContent } = useHeader()

  useEffect(() => {
    setContent({
      title: 'Settings',
      description: 'Manage your account preferences',
    })
    return () => setContent({ title: '' })
  }, [setContent])

  // Suppresses the scroll-spy while a click-triggered smooth scroll is
  // animating, so intermediate sections don't steal the highlight.
  const suppressSpy = useRef(false)
  const suppressTimeout = useRef(0)

  useEffect(() => {
    function pickActive() {
      if (suppressSpy.current) return

      const doc = document.documentElement
      const maxScroll = doc.scrollHeight - window.innerHeight

      // At the bottom, highlight the last section — it may be too short to
      // ever reach the top of the viewport on its own.
      if (maxScroll > 0 && window.scrollY >= maxScroll - 4) {
        setActiveSection(sections[sections.length - 1].id)
        return
      }

      // Otherwise the active section is the last one whose top has crossed
      // the reading line near the top of the viewport.
      let current: SectionId = sections[0].id
      for (const { id } of sections) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= 96) {
          current = id
        }
      }
      setActiveSection(current)
    }

    window.addEventListener('scroll', pickActive, { passive: true })
    return () => {
      window.removeEventListener('scroll', pickActive)
      window.clearTimeout(suppressTimeout.current)
    }
  }, [])

  const scrollTo = useCallback((id: SectionId) => {
    setActiveSection(id)
    suppressSpy.current = true
    window.clearTimeout(suppressTimeout.current)
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    suppressTimeout.current = window.setTimeout(() => {
      suppressSpy.current = false
    }, 800)
  }, [])

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-12">
      <aside className="md:sticky md:top-8 md:w-48 md:shrink-0 md:self-start">
        <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
          {sections.map(({ id, label, icon: Icon }) => (
            <Button
              key={id}
              variant="ghost"
              onClick={() => scrollTo(id)}
              className={cn(
                'shrink-0 justify-start',
                activeSection === id && 'bg-accent text-accent-foreground'
              )}
            >
              <Icon
                className={cn(
                  'size-4',
                  activeSection === id
                    ? 'text-accent-foreground'
                    : 'text-muted-foreground'
                )}
              />
              {label}
            </Button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 space-y-8">
        <section id="profile"       className="scroll-mt-4"><ProfileForm /></section>
        <section id="institutions"  className="scroll-mt-4"><InstitutionsPanel /></section>
        <section id="authorization" className="scroll-mt-4"><AuthorizationPanel /></section>
        <section id="notifications" className="scroll-mt-4"><NotificationsPanel /></section>
        <section id="appearance"    className="scroll-mt-4"><AppearancePanel /></section>
      </main>
    </div>
  )
}
