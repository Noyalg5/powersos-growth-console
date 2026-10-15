import { describe, expect, it } from 'vitest'
import type { Responder, Site } from '@/types'
import {
  coverageGaps,
  coverageStatus,
  driveMinutes,
  NEAREST_SHOWN,
  siteCoverage,
  summariseCoverage,
  withinReach,
} from './coverage'
import { destinationPoint, reachKm } from './geo'
import type { CoverContext } from './matching'
import { DAY_MS } from './time'

// Wednesday 14 Oct 2026, 09:00 London time
const AT = Date.UTC(2026, 9, 14, 8, 0)
const DAY: CoverContext = { at: AT, overnight: false, weekend: false }
const NIGHT: CoverContext = { at: AT, overnight: true, weekend: false }

const centre = { lat: 54.89, lng: -2.93 }
const IN_REACH_KM = reachKm() - 5
const OUT_OF_REACH_KM = reachKm() + 5

function site(id: string, overrides: Partial<Site> = {}): Site {
  return {
    id,
    customerId: 'CUS-001',
    name: `Site ${id}`,
    town: 'Carlisle',
    region: 'North West',
    ...centre,
    postcodeArea: 'CA',
    criticality: 3,
    equipment: [],
    contacts: [],
    ...overrides,
  }
}

/** A compliant, always-available responder `km` east of the centre. */
function responder(id: string, km: number, overrides: Partial<Responder> = {}): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Testtown',
    region: 'North West',
    ...destinationPoint(centre, 90, km),
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

const expired = { authorisationExpiry: AT - DAY_MS }

describe('coverageStatus', () => {
  it('needs two eligible responders to call a site covered', () => {
    expect(coverageStatus(0)).toBe('uncovered')
    expect(coverageStatus(1)).toBe('thin')
    expect(coverageStatus(2)).toBe('covered')
    expect(coverageStatus(7)).toBe('covered')
  })

  it('rejects counts that cannot happen', () => {
    expect(() => coverageStatus(-1)).toThrow(RangeError)
    expect(() => coverageStatus(1.5)).toThrow(RangeError)
  })
})

describe('reach', () => {
  it('is the 75-minute drive estimate, edge included', () => {
    const edge = destinationPoint(centre, 90, reachKm())
    expect(driveMinutes(centre, edge)).toBeCloseTo(75, 6)
    expect(withinReach(centre, destinationPoint(centre, 90, IN_REACH_KM))).toBe(true)
    expect(withinReach(centre, destinationPoint(centre, 90, OUT_OF_REACH_KM))).toBe(false)
  })
})

describe('siteCoverage', () => {
  it('counts a site with two eligible responders in range as covered', () => {
    const [result] = siteCoverage(
      [site('SITE-001')],
      [responder('RSP-001', 10), responder('RSP-002', IN_REACH_KM)],
      DAY,
    )
    expect(result?.status).toBe('covered')
    expect(result?.inReach.map((r) => r.responder.id)).toEqual(['RSP-001', 'RSP-002'])
  })

  it('never counts an expired responder', () => {
    const near = [responder('RSP-001', 5), responder('RSP-002', 10, expired)]
    expect(siteCoverage([site('SITE-001')], near, DAY)[0]?.status).toBe('thin')

    const lapsed = [
      responder('RSP-001', 5, expired),
      responder('RSP-002', 6, { insuranceExpiry: AT - DAY_MS }),
      responder('RSP-003', 7, { authorisationExpiry: null }),
    ]
    const [result] = siteCoverage([site('SITE-001')], lapsed, DAY)
    expect(result?.status).toBe('uncovered')
    expect(result?.inReach).toEqual([])
    expect(result?.nearest).toEqual([])
  })

  it('counts only responders with cover for the hour', () => {
    const dayOnly = { availability: { weekends: true, overnight: false, onCallEngineers: 4 } }
    const responders = [responder('RSP-001', 5, dayOnly), responder('RSP-002', 9)]
    expect(siteCoverage([site('SITE-001')], responders, DAY)[0]?.status).toBe('covered')
    expect(siteCoverage([site('SITE-001')], responders, NIGHT)[0]?.status).toBe('thin')
  })

  it('ignores responders out of reach, but still lists the nearest', () => {
    const responders = [
      responder('RSP-001', OUT_OF_REACH_KM + 40),
      responder('RSP-002', 20),
      responder('RSP-003', OUT_OF_REACH_KM),
      responder('RSP-004', OUT_OF_REACH_KM + 80),
    ]
    const [result] = siteCoverage([site('SITE-001')], responders, DAY)
    expect(result?.status).toBe('thin')
    expect(result?.nearest).toHaveLength(NEAREST_SHOWN)
    expect(result?.nearest.map((r) => r.responder.id)).toEqual(['RSP-002', 'RSP-003', 'RSP-001'])
    expect(result?.nearest[1]?.minutes).toBeGreaterThan(75)
  })
})

describe('summariseCoverage', () => {
  it('counts each status and the covered share', () => {
    expect(summariseCoverage(['covered', 'thin', 'covered', 'uncovered'])).toEqual({
      sites: 4,
      covered: 2,
      thin: 1,
      uncovered: 1,
      coveredShare: 0.5,
    })
  })

  it('reports nothing covered when there are no sites', () => {
    expect(summariseCoverage([]).coveredShare).toBe(0)
  })
})

describe('coverageGaps', () => {
  it('groups thin and uncovered sites by anchor town, most critical first', () => {
    const sites = [
      site('SITE-001', { town: 'Carlisle', criticality: 5 }),
      site('SITE-002', { town: 'Carlisle', criticality: 4 }),
      site('SITE-003', { town: 'Truro', region: 'South West', criticality: 5, lat: 50.26, lng: -5.05 }),
      site('SITE-004', { town: 'Leeds', region: 'Yorkshire and the Humber', lat: 53.8, lng: -1.55 }),
    ]
    // One responder near Carlisle; Truro and Leeds have none
    const coverage = siteCoverage(sites, [responder('RSP-001', 5)], DAY)
    const gaps = coverageGaps(coverage)
    expect(gaps.map((g) => [g.town, g.thin, g.uncovered, g.criticality])).toEqual([
      ['Carlisle', 2, 0, 9],
      ['Truro', 0, 1, 5],
      ['Leeds', 0, 1, 3],
    ])
    expect(gaps[1]?.region).toBe('South West')
  })

  it('leaves out covered sites', () => {
    const coverage = siteCoverage(
      [site('SITE-001')],
      [responder('RSP-001', 5), responder('RSP-002', 6)],
      DAY,
    )
    expect(coverageGaps(coverage)).toEqual([])
  })
})
