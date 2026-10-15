import { describe, expect, it } from 'vitest'
import type { Region, Responder } from '@/types'
import {
  liquidityGrid,
  liquidityInsights,
  medianAcceptMinutes,
  monthlyCounts,
  onTargetShare,
  utilisation,
  type RegionalCallOut,
} from './liquidity'
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time'

// Monday 12 Oct 2026, 00:00 London time (BST)
const MONDAY = Date.UTC(2026, 9, 11, 23, 0)
const AT = Date.UTC(2026, 9, 14, 8, 0)

function callOut(
  requestedAt: number,
  overrides: Partial<RegionalCallOut> & { acceptMin?: number; arriveMin?: number; jobMin?: number } = {},
): RegionalCallOut {
  const { acceptMin = 5, arriveMin = 60, jobMin = 120, ...rest } = overrides
  const arrivedAt = requestedAt + arriveMin * MINUTE_MS
  return {
    id: 'CO-0001',
    siteId: 'SITE-001',
    customerId: 'CUS-001',
    responderId: 'RSP-001',
    faultType: 'cable',
    requestedAt,
    acceptedAt: requestedAt + acceptMin * MINUTE_MS,
    arrivedAt,
    resolvedAt: arrivedAt + jobMin * MINUTE_MS,
    distanceMiles: 10,
    cost: { callOutFee: 300, labour: 400, parts: 0, generatorHire: 0 },
    rating: 4,
    region: 'North East',
    ...rest,
  }
}

function responder(id: string, overrides: Partial<Responder> = {}): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Newcastle',
    region: 'North East',
    lat: 54.97,
    lng: -1.61,
    engineers: 8,
    authorisationLevel: 'authorised-person',
    maxVoltageKv: 11,
    authorisationExpiry: AT + 400 * DAY_MS,
    insuranceExpiry: AT + 300 * DAY_MS,
    lastAuditAt: AT - 100 * DAY_MS,
    rating: 4.5,
    availability: { weekends: true, overnight: true, onCallEngineers: 3 },
    rates: { callOutFee: 300, hourlyRate: 100, outOfHoursMultiplier: 1.5 },
    joinedAt: AT - 500 * DAY_MS,
    contact: { name: 'Test Person', role: 'Operations director', phone: '07700 900000' },
    ...overrides,
  }
}

describe('call-out KPIs', () => {
  const calls = [
    callOut(MONDAY, { acceptMin: 3, arriveMin: 50 }),
    callOut(MONDAY, { acceptMin: 9, arriveMin: 75 }),
    callOut(MONDAY, { acceptMin: 4, arriveMin: 76 }),
    callOut(MONDAY, { acceptMin: 30, arriveMin: 140 }),
  ]

  it('takes the median time to accept', () => {
    expect(medianAcceptMinutes(calls)).toBe(6.5)
    expect(medianAcceptMinutes(calls.slice(0, 3))).toBe(4)
  })

  it('counts arrivals within the 75-minute target, edge included', () => {
    expect(onTargetShare(calls)).toBe(0.5)
  })

  it('has nothing to say about no call-outs', () => {
    expect(medianAcceptMinutes([])).toBeNull()
    expect(onTargetShare([])).toBeNull()
  })
})

describe('monthlyCounts', () => {
  it('counts every month in the range, empty ones included', () => {
    const from = Date.UTC(2026, 0, 15)
    const until = Date.UTC(2026, 3, 10)
    const calls = [
      callOut(Date.UTC(2026, 0, 20)),
      callOut(Date.UTC(2026, 0, 31, 23)),
      callOut(Date.UTC(2026, 2, 1)),
      callOut(Date.UTC(2026, 0, 10)), // before the range
      callOut(Date.UTC(2026, 3, 10)), // the range end is exclusive
    ]
    expect(monthlyCounts(calls, from, until)).toEqual([
      { month: Date.UTC(2026, 0, 1), count: 2 },
      { month: Date.UTC(2026, 1, 1), count: 0 },
      { month: Date.UTC(2026, 2, 1), count: 1 },
      { month: Date.UTC(2026, 3, 1), count: 0 },
    ])
  })

  it('needs a range that moves forward', () => {
    expect(() => monthlyCounts([], 10, 10)).toThrow(RangeError)
  })
})

describe('utilisation', () => {
  const twoDays = MONDAY + 2 * DAY_MS

  it('divides hours on jobs by hours available', () => {
    // 5 min to accept, 60 to arrive, 120 on site: 175 minutes on the job
    const result = utilisation([responder('RSP-001')], [callOut(MONDAY + HOUR_MS)], MONDAY, twoDays)
    expect(result.availableHours).toBe(48)
    expect(result.jobHours).toBeCloseTo(175 / 60, 9)
    expect(result.share).toBeCloseTo(175 / 60 / 48, 9)
  })

  it('counts only the hours a responder covers', () => {
    const dayOnly = responder('RSP-001', {
      availability: { weekends: false, overnight: false, onCallEngineers: 2 },
    })
    // Monday and Tuesday, 06:00 to 21:59: 16 daytime hours a day
    expect(utilisation([dayOnly], [], MONDAY, twoDays).availableHours).toBe(32)
    // A Saturday adds nothing for a responder without weekend cover
    const saturday = MONDAY + 5 * DAY_MS
    expect(utilisation([dayOnly], [], saturday, saturday + DAY_MS).availableHours).toBe(0)
  })

  it('stops counting when paperwork lapses and starts when a responder joins', () => {
    const lapses = responder('RSP-001', { insuranceExpiry: MONDAY + 30 * HOUR_MS })
    expect(utilisation([lapses], [], MONDAY, twoDays).availableHours).toBe(30)
    const joins = responder('RSP-002', { joinedAt: MONDAY + 40 * HOUR_MS })
    expect(utilisation([joins], [], MONDAY, twoDays).availableHours).toBe(8)
    const noExpiry = responder('RSP-003', { authorisationExpiry: null })
    expect(utilisation([noExpiry], [], MONDAY, twoDays)).toEqual({
      jobHours: 0,
      availableHours: 0,
      share: null,
    })
  })

  it("only counts the given responders' jobs", () => {
    const result = utilisation(
      [responder('RSP-001')],
      [callOut(MONDAY, { responderId: 'RSP-999' })],
      MONDAY,
      twoDays,
    )
    expect(result.jobHours).toBe(0)
  })
})

describe('liquidityGrid', () => {
  const regions: Region[] = ['North East', 'Wales']
  // 02:30 and 14:30 London time on the Monday
  const night = MONDAY + 2.5 * HOUR_MS
  const day = MONDAY + 14.5 * HOUR_MS

  it('puts demand in the London hour it was requested and compares it with supply', () => {
    const calls = [
      callOut(night),
      callOut(night),
      callOut(day),
      callOut(day, { region: 'Wales' }),
      callOut(day, { region: null }),
    ]
    const responders = [
      responder('RSP-001'),
      responder('RSP-002', {
        availability: { weekends: true, overnight: false, onCallEngineers: 2 },
      }),
      responder('RSP-003', { authorisationExpiry: AT - DAY_MS }),
      responder('RSP-004', { region: 'Scotland' }),
    ]
    const [northEast, wales] = liquidityGrid(calls, responders, regions, AT)
    expect(northEast).toMatchObject({ region: 'North East', daySupply: 2, nightSupply: 1 })
    expect(northEast?.cells[2]).toEqual({
      hour: 2,
      overnight: true,
      demand: 2,
      supply: 1,
      short: true,
    })
    expect(northEast?.cells[14]).toMatchObject({ demand: 1, supply: 2, short: false })
    expect(northEast?.cells.reduce((sum, c) => sum + c.demand, 0)).toBe(3)
    expect(wales).toMatchObject({ daySupply: 0, nightSupply: 0 })
    expect(wales?.cells[14]).toMatchObject({ demand: 1, supply: 0, short: true })
  })
})

describe('liquidityInsights', () => {
  const regions: Region[] = ['North East', 'Wales']

  it('names the worst overnight region and the worst daytime hour', () => {
    const calls = [
      ...Array.from({ length: 9 }, (_, i) => callOut(MONDAY + (1 + (i % 4)) * HOUR_MS)),
      ...Array.from({ length: 3 }, () => callOut(MONDAY + 13 * HOUR_MS, { region: 'Wales' })),
    ]
    const responders = [
      responder('RSP-001'),
      responder('RSP-002', { availability: { weekends: true, overnight: false, onCallEngineers: 2 } }),
      responder('RSP-003', { region: 'Wales' }),
    ]
    expect(liquidityInsights(liquidityGrid(calls, responders, regions, AT))).toEqual([
      'Overnight in North East: 9 call-outs, 1 responder with night cover.',
      'Daytime peak in Wales: 3 call-outs at 13:00 for 1 responder on cover.',
    ])
  })

  it('says so when nobody has night cover', () => {
    const grid = liquidityGrid([callOut(MONDAY + HOUR_MS)], [], ['North East'], AT)
    expect(liquidityInsights(grid)[0]).toBe(
      'Overnight in North East: 1 call-out, no responder with night cover.',
    )
  })

  it('has a line for a network without shortfalls', () => {
    const grid = liquidityGrid([], [responder('RSP-001')], ['North East'], AT)
    expect(liquidityInsights(grid)).toEqual([
      'Call-outs stay within the responders available in every region and hour.',
    ])
  })
})
