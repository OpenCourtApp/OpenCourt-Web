'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'

export type HeaderContent = {
  title: string
  description?: string
  cta?: ReactNode
}

type HeaderContextType = {
  content: HeaderContent
  setContent: (content: HeaderContent) => void
}

const HeaderContext = createContext<HeaderContextType>({
  content: { title: '' },
  setContent: () => {},
})

export function HeaderProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<HeaderContent>({ title: '' })
  return (
    <HeaderContext.Provider value={{ content, setContent }}>
      {children}
    </HeaderContext.Provider>
  )
}

export function useHeader() {
  return useContext(HeaderContext)
}
