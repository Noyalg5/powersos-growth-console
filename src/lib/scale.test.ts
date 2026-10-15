import { describe, expect, it } from 'vitest'
import { niceScale } from './scale'

describe('niceScale', () => {
  it('covers the data with round ticks from zero', () => {
    expect(niceScale(0, 17_342)).toEqual({
      min: 0,
      max: 20_000,
      ticks: [0, 5_000, 10_000, 15_000, 20_000],
    })
    expect(niceScale(12, 92).ticks).toEqual([0, 25, 50, 75, 100])
  })

  it('reaches below zero for negative values', () => {
    expect(niceScale(-3_200, 8_100)).toEqual({
      min: -5_000,
      max: 10_000,
      ticks: [-5_000, 0, 5_000, 10_000],
    })
  })

  it('keeps small steps free of floating-point tails', () => {
    expect(niceScale(0, 0.7).ticks).toEqual([0, 0.2, 0.4, 0.6, 0.8])
  })

  it('gives a flat series at zero an axis of 0 to 1', () => {
    expect(niceScale(0, 0)).toEqual({ min: 0, max: 1, ticks: [0, 1] })
  })

  it('rejects invalid input', () => {
    expect(() => niceScale(5, 1)).toThrow(RangeError)
    expect(() => niceScale(0, Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => niceScale(0, 10, 0)).toThrow(RangeError)
  })
})
