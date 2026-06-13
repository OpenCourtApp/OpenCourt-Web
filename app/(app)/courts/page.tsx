'use client'

import { useEffect } from 'react'
import { useHeader } from '@/components/shared/header-context'
import { CourtsView } from '@/components/courts/courts-view'

export default function CourtsPage() {
  const { setContent } = useHeader()

  useEffect(() => {
    setContent({
      title: 'Courts',
      description: 'Manage the courts available for booking',
    })
    return () => setContent({ title: '' })
  }, [setContent])

  return <CourtsView />
}
