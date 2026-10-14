/**
 * UK formatting for every amount, number, date and time shown in the console.
 * Components should never hand-format these values.
 */

const LOCALE = 'en-GB'
const TIME_ZONE = 'Europe/London'

const gbpWithPence = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'GBP' })
const gbpWhole = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const time24 = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

/** £1,234.50, or £1,235 with `{ pence: false }`. */
export function formatGBP(amount: number, { pence = true }: { pence?: boolean } = {}): string {
  return (pence ? gbpWithPence : gbpWhole).format(amount)
}

/** 12,345 or 12,345.6 with grouping. */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)
}

/** A 0–1 ratio as a percentage: 0.873 → 87%. */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}

/** 24-hour UK time: 18:05. */
export function formatTime(date: Date | number): string {
  return time24.format(date)
}

/** 14 Oct 2026. */
export function formatDate(date: Date | number): string {
  return shortDate.format(date)
}

/** 14 Oct 2026, 18:05. */
export function formatDateTime(date: Date | number): string {
  return `${formatDate(date)}, ${formatTime(date)}`
}

/** Whole minutes as a duration: 45 min, 1 h 15 min, 2 h. */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`formatDuration() needs a non-negative number, got ${minutes}`)
  }
  const total = Math.round(minutes)
  const hours = Math.floor(total / 60)
  const mins = total % 60
  if (hours === 0) return `${mins} min`
  if (mins === 0) return `${hours} h`
  return `${hours} h ${mins} min`
}
