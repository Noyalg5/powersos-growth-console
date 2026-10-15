import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatDecimal,
  formatDuration,
  formatGBP,
  formatGBPCompact,
  formatHour,
  formatIsoDate,
  formatList,
  formatMonth,
  formatNumber,
  formatPercent,
  formatTime,
} from './format'

// 14 Oct 2026, 17:05 UTC, which is 18:05 in London (BST)
const summerEvening = Date.UTC(2026, 9, 14, 17, 5)
// 5 Jan 2026, 00:07 UTC, which is 00:07 in London (GMT)
const winterMidnight = Date.UTC(2026, 0, 5, 0, 7)

describe('formatMonth and formatHour', () => {
  it('names the London month', () => {
    expect(formatMonth(summerEvening)).toBe('Oct 2026')
    // 23:30 UTC on 31 Mar is already 1 Apr in London (BST)
    expect(formatMonth(Date.UTC(2026, 2, 31, 23, 30))).toBe('Apr 2026')
  })

  it('writes an hour of the clock', () => {
    expect(formatHour(2)).toBe('02:00')
    expect(formatHour(23)).toBe('23:00')
    expect(() => formatHour(24)).toThrow(RangeError)
  })
})

describe('formatGBP', () => {
  it('uses pounds with grouping and pence', () => {
    expect(formatGBP(1234.5)).toBe('£1,234.50')
  })

  it('drops pence on request', () => {
    expect(formatGBP(1234.5, { pence: false })).toBe('£1,235')
  })

  it('formats negatives', () => {
    expect(formatGBP(-80)).toBe('-£80.00')
  })
})

describe('formatNumber and formatPercent', () => {
  it('groups thousands', () => {
    expect(formatNumber(12345)).toBe('12,345')
    expect(formatNumber(12345.67, 1)).toBe('12,345.7')
  })

  it('turns a ratio into a percentage', () => {
    expect(formatPercent(0.873)).toBe('87%')
    expect(formatPercent(0.8735, 1)).toBe('87.4%')
  })
})

describe('dates and times', () => {
  it('shows 24-hour UK local time, including BST', () => {
    expect(formatTime(summerEvening)).toBe('18:05')
  })

  it('shows midnight as 00, not 24', () => {
    expect(formatTime(winterMidnight)).toBe('00:07')
  })

  it('formats dates day-first with a short month', () => {
    expect(formatDate(summerEvening)).toBe('14 Oct 2026')
    expect(formatDateTime(summerEvening)).toBe('14 Oct 2026, 18:05')
  })

  it('writes ISO 8601 dates for exports, on the London calendar', () => {
    expect(formatIsoDate(summerEvening)).toBe('2026-10-14')
    expect(formatIsoDate(winterMidnight)).toBe('2026-01-05')
    // 23:30 UTC on 31 Mar is already 1 Apr in London (BST)
    expect(formatIsoDate(Date.UTC(2026, 2, 31, 23, 30))).toBe('2026-04-01')
  })

  it('accepts Date objects', () => {
    expect(formatTime(new Date(summerEvening))).toBe('18:05')
  })
})

describe('formatGBPCompact', () => {
  it('shortens pounds for chart axes', () => {
    expect(formatGBPCompact(0)).toBe('£0')
    expect(formatGBPCompact(950)).toBe('£950')
    expect(formatGBPCompact(1_500)).toBe('£1.5k')
    expect(formatGBPCompact(20_000)).toBe('£20k')
    expect(formatGBPCompact(1_250_000)).toBe('£1.3m')
    expect(formatGBPCompact(-35_000)).toBe('-£35k')
  })
})

describe('formatDecimal', () => {
  it('always shows the same number of decimal places', () => {
    expect(formatDecimal(4)).toBe('4.0')
    expect(formatDecimal(2.64)).toBe('2.6')
    expect(formatDecimal(1234.5, 2)).toBe('1,234.50')
  })
})

describe('formatList', () => {
  it('joins items with commas and a final "and", with no serial comma', () => {
    expect(formatList(['response time', 'cost certainty', '24/7 cover'])).toBe(
      'response time, cost certainty and 24/7 cover',
    )
    expect(formatList(['Medical', 'Aviation'])).toBe('Medical and Aviation')
    expect(formatList(['Medical'])).toBe('Medical')
    expect(formatList([])).toBe('')
  })
})

describe('formatDuration', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [60, '1 h'],
    [75, '1 h 15 min'],
    [134.6, '2 h 15 min'],
  ])('%d minutes → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected)
  })

  it('rejects negative and non-finite input', () => {
    expect(() => formatDuration(-1)).toThrow(RangeError)
    expect(() => formatDuration(Number.NaN)).toThrow(RangeError)
  })
})
