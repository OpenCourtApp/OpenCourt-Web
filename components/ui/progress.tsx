"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    const timer = requestAnimationFrame(() => setCurrent(value ?? 0))
    return () => cancelAnimationFrame(timer)
  }, [value])

  const pct = 100 - current
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 rounded-full bg-primary transition-all duration-700 ease-out"
        style={{ transform: `translateX(-${pct}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
