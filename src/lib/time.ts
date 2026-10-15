/**
 * Time constants and London clock helpers. Overnight and weekend are judged on
 * the London clock, so BST is handled for every timestamp in the console.
 */
import { LOCALE, TIME_ZONE } from './format'

export const MINUTE_MS = 60_000
export const HOUR_MS = 60 * MINUTE_MS
export const DAY_MS = 24 * HOUR_MS

/** Overnight runs from 22:00 to 05:59 London time. */
export const OVERNIGHT_START_HOUR = 22
export const OVERNIGHT_END_HOUR = 6

const clockFormat = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  hourCycle: 'h23',
  weekday: 'short',
})

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export interface LondonClock {
  /** 0–23. */
  hour: number
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
}

/** The hour and day of the week in London at a timestamp. */
export function londonClock(timestamp: number): LondonClock {
  if (!Number.isFinite(timestamp)) {
    throw new RangeError(`timestamp must be a finite number, got ${timestamp}`)
  }
  let hour = -1
  let weekday = -1
  for (const part of clockFormat.formatToParts(timestamp)) {
    if (part.type === 'hour') hour = Number(part.value)
    if (part.type === 'weekday') weekday = WEEKDAYS.indexOf(part.value)
  }
  if (hour < 0 || weekday < 0) throw new Error(`Could not read the London clock at ${timestamp}`)
  return { hour, weekday }
}

/** True for the hours 22 to 5 of the clock. */
export function isOvernightHour(hour: number): boolean {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError(`hour must be an integer from 0 to 23, got ${hour}`)
  }
  return hour >= OVERNIGHT_START_HOUR || hour < OVERNIGHT_END_HOUR
}

/** 22:00–05:59 in London. */
export function isOvernight(timestamp: number): boolean {
  return isOvernightHour(londonClock(timestamp).hour)
}

const isWeekendDay = (weekday: number) => weekday === 0 || weekday === 6

/** Saturday or Sunday in London. */
export function isWeekend(timestamp: number): boolean {
  return isWeekendDay(londonClock(timestamp).weekday)
}

/** Overnight and weekend together, from a single read of the London clock. */
export function hourKind(timestamp: number): { overnight: boolean; weekend: boolean } {
  const { hour, weekday } = londonClock(timestamp)
  return { overnight: isOvernightHour(hour), weekend: isWeekendDay(weekday) }
}

/** Overnight or at the weekend: when contractors charge out-of-hours rates. */
export function isOutOfHours(timestamp: number): boolean {
  return isOvernight(timestamp) || isWeekend(timestamp)
}
