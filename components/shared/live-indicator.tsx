export function LiveIndicator() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-[ping-wide_1s_cubic-bezier(0,0,0.2,1)_infinite] absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
    </span>
  )
}
