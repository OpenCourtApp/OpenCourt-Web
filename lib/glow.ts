import type { MouseEvent } from 'react'

// Shared handler for the `.glow-card` mouse-tracking border glow (globals.css).
// Lights the border arc nearest the cursor by feeding the pointer angle to CSS.
export function handleGlow(e: MouseEvent<HTMLDivElement>) {
  const el = e.currentTarget
  const rect = el.getBoundingClientRect()
  const x = e.clientX - rect.left - rect.width / 2
  const y = e.clientY - rect.top - rect.height / 2
  const angle = (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360
  el.style.setProperty('--start', String(angle + 60))
}
