/**
 * UK formatting for every amount, number, date and time shown in the console.
 * Components should never hand-format these values.
 */

export const LOCALE = 'en-GB'
export const TIME_ZONE = 'Europe/London'

const gbpWithPence = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'GBP' })
const gbpWhole = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})
const gbpCompact = new Intl.NumberFormat(LOCALE, {
  style: 'currency',
  currency: 'GBP',
  notation: 'compact',
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})
const time24 = new Intl.DateTimeFormat(LOCALE, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: TIME_ZONE,
})
const monthYear = new Intl.DateTimeFormat(LOCALE, {
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})
const shortDate = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

const andList = new Intl.ListFormat(LOCALE, { type: 'conjunction' })

const isoDateParts = new Intl.DateTimeFormat(LOCALE, {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: TIME_ZONE,
})

/** £1,234.50, or £1,235 with `{ pence: false }`. */
export function formatGBP(amount: number, { pence = true }: { pence?: boolean } = {}): string {
  return (pence ? gbpWithPence : gbpWhole).format(amount)
}

/** Short pounds for chart axes: £950, £1.5k, £20k, £1.3m. */
export function formatGBPCompact(amount: number): string {
  return gbpCompact.format(amount)
}

/** 12,345 or 12,345.6 with grouping. */
export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits }).format(value)
}

/** A fixed number of decimal places, for figures read down a column: 4 → 4.0. */
export function formatDecimal(value: number, digits = 1): string {
  return new Intl.NumberFormat(LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

/** A 0–1 ratio as a percentage: 0.873 → 87%. */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  return new Intl.NumberFormat(LOCALE, {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio)
}

/** Items in a sentence, UK style with no serial comma: "a, b and c". */
export function formatList(items: readonly string[]): string {
  return andList.format(items)
}

/** 24-hour UK time: 18:05. */
export function formatTime(date: Date | number): string {
  return time24.format(date)
}

/** 14 Oct 2026. */
export function formatDate(date: Date | number): string {
  return shortDate.format(date)
}

/** The London calendar date in ISO 8601, for exports: 2026-10-14. */
export function formatIsoDate(date: Date | number): string {
  const parts = isoDateParts.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

/** Oct 2026. */
export function formatMonth(date: Date | number): string {
  return monthYear.format(date)
}

/** An hour of the 24-hour clock: 2 → 02:00. */
export function formatHour(hour: number): string {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`formatHour() needs an integer from 0 to 23, got ${hour}`)
  }
  return `${String(hour).padStart(2, '0')}:00`
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
