import { describe, expect, it } from 'vitest'
import type { CallOut, CallOutRates } from '@/types'
import {
  billableHours,
  callOutCharge,
  costTotal,
  CREW_SIZE,
  faultHistory,
  hireDayRate,
  labourCharge,
  materialsCharge,
  median,
  responseCharge,
} from './costs'

const rates: CallOutRates = { callOutFee: 290, hourlyRate: 78, outOfHoursMultiplier: 1.5 }

const MINUTE = 60_000
function callOut(overrides: Partial<CallOut> & { repairMinutes?: number } = {}): CallOut {
  const { repairMinutes = 120, ...rest } = overrides
  const arrivedAt = Date.UTC(2026, 0, 5, 10, 0)
  return {
    id: 'CO-0001',
    siteId: 'SITE-001',
    customerId: 'CUS-001',
    responderId: 'RSP-001',
    faultType: 'transformer',
    requestedAt: arrivedAt - 60 * MINUTE,
    acceptedAt: arrivedAt - 55 * MINUTE,
    arrivedAt,
    resolvedAt: arrivedAt + repairMinutes * MINUTE,
    distanceMiles: 12,
    cost: { callOutFee: 300, labour: 400, parts: 1000, generatorHire: 0 },
    rating: 4,
    ...rest,
  }
}

describe('billableHours', () => {
  it('bills half hours with a one-hour minimum', () => {
    expect(billableHours(0)).toBe(1)
    expect(billableHours(59)).toBe(1)
    expect(billableHours(60)).toBe(1)
    expect(billableHours(61)).toBe(1.5)
    expect(billableHours(90)).toBe(1.5)
    expect(billableHours(91)).toBe(2)
    expect(billableHours(596)).toBe(10)
  })

  it('rejects unusable input', () => {
    expect(() => billableHours(-1)).toThrow(RangeError)
    expect(() => billableHours(Number.NaN)).toThrow(RangeError)
  })
})

describe('call-out and labour charges', () => {
  it('charges the fee as listed in hours and with the multiplier out of hours', () => {
    expect(callOutCharge(rates, false)).toBe(290)
    expect(callOutCharge(rates, true)).toBe(435)
  })

  it('bills the whole crew for every billable hour', () => {
    expect(CREW_SIZE).toBe(2)
    // 3 h 20 min → 3.5 h × 2 engineers × £78
    expect(labourCharge(rates, 200, false)).toBe(546)
    expect(labourCharge(rates, 200, true)).toBe(819)
  })

  it('rounds to the penny', () => {
    expect(callOutCharge({ ...rates, callOutFee: 333, outOfHoursMultiplier: 1.75 }, true)).toBe(
      582.75,
    )
    expect(labourCharge({ ...rates, hourlyRate: 77.777 }, 60, false)).toBe(155.55)
  })
})

describe('costTotal', () => {
  it('equals the sum of its parts', () => {
    const cost = { callOutFee: 435, labour: 819, parts: 480.29, generatorHire: 0 }
    expect(costTotal(cost)).toBe(1734.29)
    expect(costTotal(cost)).toBeCloseTo(
      cost.callOutFee + cost.labour + cost.parts + cost.generatorHire,
      9,
    )
  })

  it('does not drift with floating-point pennies', () => {
    expect(costTotal({ callOutFee: 0.1, labour: 0.2, parts: 0, generatorHire: 0 })).toBe(0.3)
  })
})

describe('responseCharge and materialsCharge', () => {
  it('split an invoice into the work and what it used, to the penny', () => {
    const cost = { callOutFee: 435, labour: 819.1, parts: 480.29, generatorHire: 250.2 }
    expect(responseCharge(cost)).toBe(1254.1)
    expect(materialsCharge(cost)).toBe(730.49)
    expect(responseCharge(cost) + materialsCharge(cost)).toBeCloseTo(costTotal(cost), 9)
  })
})

describe('median', () => {
  it('handles odd and even counts without touching the input', () => {
    const values = [9, 1, 5]
    expect(median(values)).toBe(5)
    expect(values).toEqual([9, 1, 5])
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([7])).toBe(7)
  })

  it('needs at least one value', () => {
    expect(() => median([])).toThrow(RangeError)
  })
})

describe('faultHistory', () => {
  const history = [
    callOut({ repairMinutes: 100, cost: { callOutFee: 1, labour: 1, parts: 500, generatorHire: 0 } }),
    callOut({ repairMinutes: 300, cost: { callOutFee: 1, labour: 1, parts: 900, generatorHire: 0 } }),
    callOut({ repairMinutes: 200, cost: { callOutFee: 1, labour: 1, parts: 700, generatorHire: 0 } }),
    callOut({ faultType: 'cable', repairMinutes: 999 }),
  ]

  it('summarises time on site and parts for one kind of fault', () => {
    expect(faultHistory(history, 'transformer')).toEqual({
      faultType: 'transformer',
      jobs: 3,
      medianRepairMinutes: 200,
      longestRepairMinutes: 300,
      medianParts: 700,
      largestParts: 900,
    })
  })

  it('refuses to predict from no history', () => {
    expect(() => faultHistory(history, 'generator')).toThrow(RangeError)
  })
})

describe('hireDayRate', () => {
  it('is the median of the hires on record, ignoring jobs without one', () => {
    const hire = (generatorHire: number) =>
      callOut({ cost: { callOutFee: 1, labour: 1, parts: 1, generatorHire } })
    expect(hireDayRate([hire(0), hire(600), hire(1000), hire(0), hire(800)])).toBe(800)
  })

  it('needs at least one hire', () => {
    expect(() => hireDayRate([callOut()])).toThrow(RangeError)
  })
})
