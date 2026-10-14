import { describe, expect, it } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatDuration,
  formatGBP,
  formatNumber,
  formatPercent,
  formatTime,
} from './format'

// 14 Oct 2026, 17:05 UTC, which is 18:05 in London (BST)
const summerEvening = Date.UTC(2026, 9, 14, 17, 5)
// 5 Jan 2026, 00:07 UTC, which is 00:07 in London (GMT)
const winterMidnight = Date.UTC(2026, 0, 5, 0, 7)

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

  it('accepts Date objects', () => {
    expect(formatTime(new Date(summerEvening))).toBe('18:05')
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
