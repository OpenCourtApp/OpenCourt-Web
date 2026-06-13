// Shared booking/calendar constants and helpers, so the calendar grid and the
// dashboard stats agree on operating hours and formatting.

/** First hour shown on the calendar / counted as bookable (07:00). */
export const DAY_START = 7
/** Last hour shown on the calendar / counted as bookable (21:00). */
export const DAY_END = 21

/** Hours in the bookable window, used for capacity math. */
export const OPEN_HOURS = DAY_END - DAY_START

/** '14:30' or '14:30:00' → 14.5 decimal hours. */
export function timeToDecimal(value: string): number {
  const [h, m] = value.split(':')
  return Number(h) + Number(m ?? 0) / 60
}

/** 14.5 → '14:30'. */
export function decimalToTime(value: number): string {
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** 'HH:MM' or 'HH:MM:SS' → 'HH:MM' for display. */
export function formatTime(value: string): string {
  return value.slice(0, 5)
}

/** Stable color (1-5) for a court based on its index in the school's court list. */
export function courtColor(index: number): 1 | 2 | 3 | 4 | 5 {
  return ((index % 5) + 1) as 1 | 2 | 3 | 4 | 5
}
