import { describe, expect, it } from 'vitest'
import {
  DAY_MS,
  hourKind,
  isOutOfHours,
  isOvernight,
  isOvernightHour,
  isWeekend,
  londonClock,
} from './time'

// Wednesday 14 Oct 2026, 17:05 UTC = 18:05 BST
const wednesdayEvening = Date.UTC(2026, 9, 14, 17, 5)
// Monday 5 Jan 2026, 00:07 UTC = 00:07 GMT
const mondayMidnight = Date.UTC(2026, 0, 5, 0, 7)

describe('londonClock', () => {
  it('reads the London hour and weekday in BST and GMT', () => {
    expect(londonClock(wednesdayEvening)).toEqual({ hour: 18, weekday: 3 })
    expect(londonClock(mondayMidnight)).toEqual({ hour: 0, weekday: 1 })
  })

  it('rejects non-finite timestamps', () => {
    expect(() => londonClock(Number.NaN)).toThrow(RangeError)
  })

  it('has a 24-hour day', () => {
    expect(DAY_MS).toBe(86_400_000)
  })
})

describe('isOvernightHour', () => {
  it('covers 22:00 to 05:59', () => {
    const overnight = Array.from({ length: 24 }, (_, h) => h).filter(isOvernightHour)
    expect(overnight).toEqual([0, 1, 2, 3, 4, 5, 22, 23])
  })

  it('rejects hours that do not exist', () => {
    expect(() => isOvernightHour(24)).toThrow(RangeError)
    expect(() => isOvernightHour(-1)).toThrow(RangeError)
    expect(() => isOvernightHour(1.5)).toThrow(RangeError)
  })
})

describe('isOvernight', () => {
  it('runs from 22:00 to 05:59 London time', () => {
    expect(isOvernight(Date.UTC(2026, 0, 14, 22, 0))).toBe(true)
    expect(isOvernight(Date.UTC(2026, 0, 14, 5, 59))).toBe(true)
    expect(isOvernight(Date.UTC(2026, 0, 14, 6, 0))).toBe(false)
    expect(isOvernight(Date.UTC(2026, 0, 14, 21, 59))).toBe(false)
  })

  it('follows BST: 21:30 UTC in July is 22:30 in London', () => {
    expect(isOvernight(Date.UTC(2026, 6, 1, 21, 30))).toBe(true)
    expect(isOvernight(Date.UTC(2026, 0, 7, 21, 30))).toBe(false)
  })
})

describe('isWeekend and isOutOfHours', () => {
  it('spots Saturdays and Sundays', () => {
    expect(isWeekend(Date.UTC(2026, 9, 10, 12, 0))).toBe(true)
    expect(isWeekend(Date.UTC(2026, 9, 11, 12, 0))).toBe(true)
    expect(isWeekend(wednesdayEvening)).toBe(false)
  })

  it('uses the London date: Sunday 23:30 UTC in October is already Monday', () => {
    const lateSunday = Date.UTC(2026, 9, 11, 23, 30)
    expect(isWeekend(lateSunday)).toBe(false)
    expect(isOvernight(lateSunday)).toBe(true)
  })

  it('reads both at once with hourKind', () => {
    const lateSunday = Date.UTC(2026, 9, 11, 23, 30)
    expect(hourKind(lateSunday)).toEqual({ overnight: true, weekend: false })
    expect(hourKind(Date.UTC(2026, 9, 10, 12, 0))).toEqual({ overnight: false, weekend: true })
  })

  it('counts overnight or weekend as out of hours', () => {
    expect(isOutOfHours(Date.UTC(2026, 9, 10, 12, 0))).toBe(true)
    expect(isOutOfHours(mondayMidnight)).toBe(true)
    expect(isOutOfHours(wednesdayEvening)).toBe(false)
  })
})
