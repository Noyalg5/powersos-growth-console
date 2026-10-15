import { describe, expect, it } from 'vitest'
import type { CallOut, Customer, SectorId, Site } from '@/types'
import { averageJobCost, callOutRate, callOutsAtSites, YEAR_MS } from './demand'

const FROM = Date.UTC(2025, 9, 14)
const TO = FROM + YEAR_MS
const PERIOD = { from: FROM, to: TO }

function site(id: string, customerId: string): Site {
  return {
    id,
    customerId,
    name: `Site ${id}`,
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    lat: 53.8,
    lng: -1.55,
    postcodeArea: 'LS',
    criticality: 3,
    equipment: [],
    contacts: [],
  }
}

function customer(
  id: string,
  sites: number,
  joinedAt: number,
  sector: SectorId = 'medical',
): Customer {
  return {
    id,
    name: `Customer ${id}`,
    sector,
    headOffice: 'Leeds',
    joinedAt,
    sites: Array.from({ length: sites }, (_, i) => site(`${id}-S${i + 1}`, id)),
  }
}

let n = 0
function callOut(
  siteId: string,
  requestedAt: number,
  cost: Partial<CallOut['cost']> = {},
): CallOut {
  n++
  return {
    id: `CO-${n}`,
    siteId,
    customerId: siteId.split('-S')[0] ?? '',
    responderId: 'RSP-001',
    faultType: 'cable',
    requestedAt,
    acceptedAt: requestedAt,
    arrivedAt: requestedAt,
    resolvedAt: requestedAt,
    distanceMiles: 10,
    cost: { callOutFee: 400, labour: 1000, parts: 1500, generatorHire: 0, ...cost },
    rating: 5,
  }
}

const halfway = FROM + YEAR_MS / 2

describe('callOutsAtSites', () => {
  it('separates call-outs whose site is missing from the records', () => {
    const customers = [customer('A', 1, FROM)]
    const orphan = callOut('GONE-S1', halfway)
    const kept = callOut('A-S1', halfway)
    expect(callOutsAtSites(customers, [kept, orphan])).toEqual({
      matched: [kept],
      unmatched: [orphan],
    })
  })
})

describe('callOutRate', () => {
  it('measures call-outs per site per year of membership', () => {
    // Two sites all year, and two sites for the second half: three site-years
    const customers = [customer('A', 2, FROM - YEAR_MS), customer('B', 2, halfway)]
    const callOuts = [
      ...Array.from({ length: 4 }, () => callOut('A-S1', halfway)),
      callOut('B-S2', halfway + 1000),
      callOut('A-S2', FROM + 10),
    ]
    const rate = callOutRate(customers, callOuts, PERIOD)
    expect(rate).toMatchObject({ customers: 2, sites: 4, callOuts: 6 })
    expect(rate.siteYears).toBeCloseTo(3, 9)
    expect(rate.perSiteYear).toBeCloseTo(2, 9)
  })

  it('stops counting a site once its customer has left', () => {
    const customers = [customer('A', 1, FROM - YEAR_MS)]
    const left = new Map([['A', halfway]])
    const rate = callOutRate(customers, [callOut('A-S1', FROM + 5)], PERIOD, left)
    expect(rate.siteYears).toBeCloseTo(0.5, 9)
    expect(rate.perSiteYear).toBeCloseTo(2, 9)
  })

  it('leaves out call-outs outside the period or at sites not on record', () => {
    const customers = [customer('A', 1, FROM - YEAR_MS)]
    const rate = callOutRate(
      customers,
      [callOut('A-S1', FROM - 1), callOut('A-S1', TO), callOut('GONE-S1', halfway)],
      PERIOD,
    )
    expect(rate.callOuts).toBe(0)
    expect(rate.perSiteYear).toBe(0)
  })

  it('has no rate when nobody was a member in the period', () => {
    expect(callOutRate([customer('A', 3, TO)], [], PERIOD)).toEqual({
      customers: 1,
      sites: 3,
      callOuts: 0,
      siteYears: 0,
      perSiteYear: null,
    })
    expect(callOutRate([], [], PERIOD).perSiteYear).toBeNull()
  })

  it('rejects a period that ends before it starts', () => {
    expect(() => callOutRate([], [], { from: TO, to: FROM })).toThrow(RangeError)
    expect(() => callOutRate([], [], { from: Number.NaN, to: TO })).toThrow(RangeError)
  })
})

describe('averageJobCost', () => {
  it('averages the work and what it used separately, to the penny', () => {
    const jobs = [
      callOut('A-S1', halfway, { callOutFee: 300, labour: 600, parts: 100, generatorHire: 0 }),
      callOut('A-S1', halfway, { callOutFee: 450, labour: 800.01, parts: 0, generatorHire: 350 }),
      callOut('A-S1', halfway, { callOutFee: 450, labour: 1200, parts: 2400, generatorHire: 0 }),
    ]
    expect(averageJobCost(jobs)).toEqual({ jobs: 3, response: 1266.67, materials: 950 })
  })

  it('needs at least one call-out', () => {
    expect(() => averageJobCost([])).toThrow(RangeError)
  })
})
