import { describe, expect, it } from 'vitest'
import type { Responder } from '@/types'
import { destinationPoint, estimateDriveMinutes, haversineMiles } from './geo'
import {
  CANDIDATE_POOL_SIZE,
  coverContext,
  eligibilityExclusions,
  eligibleWindow,
  estimateEta,
  exclusionsFor,
  explainMatch,
  FACTOR_WEIGHTS,
  hasCover,
  isEligible,
  MAX_OFFER_ETA_MINUTES,
  matchResponders,
  mobiliseMinutes,
  trafficFactor,
} from './matching'
import { DAY_MS } from './time'

// Wednesday 14 Oct 2026 in London (BST)
const MIDDAY = Date.UTC(2026, 9, 14, 11, 0)
const TWO_AM = Date.UTC(2026, 9, 14, 1, 0)
const RUSH_HOUR = Date.UTC(2026, 9, 14, 7, 30)
// Saturday 17 Oct 2026, 12:00 BST
const SATURDAY = Date.UTC(2026, 9, 17, 11, 0)

const site = { lat: 51.752, lng: -1.2577 }

/** A responder `km` north of the site, compliant for years and available around the clock. */
function responder(id: string, km: number, overrides: Partial<Responder> = {}): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Testtown',
    region: 'South East',
    ...destinationPoint(site, 0, km),
    engineers: 10,
    authorisationLevel: 'authorised-person',
    maxVoltageKv: 11,
    authorisationExpiry: MIDDAY + 400 * DAY_MS,
    insuranceExpiry: MIDDAY + 300 * DAY_MS,
    lastAuditAt: MIDDAY - 100 * DAY_MS,
    rating: 4.5,
    availability: { weekends: true, overnight: true, onCallEngineers: 3 },
    rates: { callOutFee: 300, hourlyRate: 100, outOfHoursMultiplier: 1.5 },
    joinedAt: MIDDAY - 500 * DAY_MS,
    contact: { name: 'Test Person', role: 'Operations director', phone: '07700 900000' },
    ...overrides,
  }
}

describe('ETA', () => {
  it('takes longer to mobilise overnight', () => {
    expect(mobiliseMinutes(MIDDAY)).toBe(10)
    expect(mobiliseMinutes(TWO_AM)).toBe(20)
  })

  it('speeds up overnight and slows down in the weekday rush hour only', () => {
    expect(trafficFactor(MIDDAY)).toBe(1)
    expect(trafficFactor(TWO_AM)).toBe(0.85)
    expect(trafficFactor(RUSH_HOUR)).toBe(1.25)
    expect(trafficFactor(Date.UTC(2026, 9, 17, 7, 30))).toBe(1)
  })

  it('adds mobilisation to the drive time from geo.ts', () => {
    const depot = destinationPoint(site, 90, 40)
    const drive = estimateDriveMinutes(haversineMiles(depot, site))
    const eta = estimateEta(depot, site, MIDDAY)
    expect(eta.driveMinutes).toBe(Math.round(drive))
    expect(eta.etaMinutes).toBe(Math.round(10 + drive))
    expect(estimateEta(depot, site, TWO_AM).etaMinutes).toBe(Math.round(20 + drive * 0.85))
  })
})

describe('eligibility', () => {
  it('reads the kind of hour from the request time', () => {
    expect(coverContext(MIDDAY)).toEqual({ at: MIDDAY, overnight: false, weekend: false })
    expect(coverContext(TWO_AM)).toMatchObject({ overnight: true, weekend: false })
    expect(coverContext(SATURDAY)).toMatchObject({ overnight: false, weekend: true })
  })

  it('needs overnight cover at night and weekend cover at weekends, both for both', () => {
    const r = (overnight: boolean, weekends: boolean) =>
      responder('RSP-001', 5, { availability: { overnight, weekends, onCallEngineers: 2 } })
    expect(hasCover(r(false, false), { overnight: false, weekend: false })).toBe(true)
    expect(hasCover(r(false, true), { overnight: true, weekend: false })).toBe(false)
    expect(hasCover(r(true, false), { overnight: false, weekend: true })).toBe(false)
    expect(hasCover(r(true, false), { overnight: true, weekend: true })).toBe(false)
    expect(hasCover(r(true, true), { overnight: true, weekend: true })).toBe(true)
  })

  it('leaves out responders who have not joined yet', () => {
    const recruit = responder('RSP-001', 5, { joinedAt: MIDDAY + DAY_MS })
    expect(eligibilityExclusions(recruit, coverContext(MIDDAY))).toEqual([
      { code: 'not-on-platform', factor: 'availability', label: 'Joins 15 Oct 2026' },
    ])
    expect(isEligible(recruit, coverContext(MIDDAY + 2 * DAY_MS))).toBe(true)
  })

  it('judges paperwork and cover separately when asked', () => {
    const dayOnly = responder('RSP-001', 5, {
      availability: { weekends: true, overnight: false, onCallEngineers: 2 },
    })
    expect(isEligible(dayOnly, { at: MIDDAY, overnight: false, weekend: false })).toBe(true)
    expect(isEligible(dayOnly, { at: MIDDAY, overnight: true, weekend: false })).toBe(false)
  })

  it('agrees with eligibleWindow and hasCover for every moment', () => {
    const responders = [
      responder('RSP-001', 5),
      responder('RSP-002', 5, { authorisationExpiry: null }),
      responder('RSP-003', 5, { insuranceExpiry: MIDDAY - 10 * DAY_MS }),
      responder('RSP-004', 5, { joinedAt: MIDDAY + 3 * DAY_MS }),
      responder('RSP-005', 5, {
        availability: { weekends: false, overnight: false, onCallEngineers: 1 },
        authorisationExpiry: MIDDAY + 5 * DAY_MS,
      }),
    ]
    for (const r of responders) {
      for (let day = -20; day <= 20; day += 1) {
        for (const overnight of [false, true]) {
          for (const weekend of [false, true]) {
            const context = { at: MIDDAY + day * DAY_MS, overnight, weekend }
            const window = eligibleWindow(r)
            const inWindow = window !== null && window.from <= context.at && context.at < window.until
            expect(isEligible(r, context)).toBe(inWindow && hasCover(r, context))
          }
        }
      }
    }
  })
})

describe('exclusionsFor', () => {
  it('names the date authorisation or insurance lapsed', () => {
    const lapsed = responder('RSP-001', 5, {
      authorisationExpiry: Date.UTC(2026, 7, 12),
      insuranceExpiry: Date.UTC(2026, 8, 21),
    })
    expect(exclusionsFor(lapsed, 30, MIDDAY)).toEqual([
      {
        code: 'authorisation-expired',
        factor: 'compliance',
        label: 'Authorisation expired 12 Aug 2026',
      },
      { code: 'insurance-expired', factor: 'compliance', label: 'Insurance expired 21 Sept 2026' },
    ])
  })

  it('treats a missing authorisation expiry as a failed check', () => {
    const missing = responder('RSP-001', 5, { authorisationExpiry: null })
    expect(exclusionsFor(missing, 30, MIDDAY).map((e) => e.code)).toEqual([
      'authorisation-missing',
    ])
  })

  it('counts paperwork expiring at the moment of the request as lapsed', () => {
    const lapsing = responder('RSP-001', 5, { insuranceExpiry: MIDDAY })
    expect(exclusionsFor(lapsing, 30, MIDDAY).map((e) => e.code)).toEqual(['insurance-expired'])
  })

  it('checks cover at the hour of the request', () => {
    const daytimeOnly = responder('RSP-001', 5, {
      availability: { weekends: false, overnight: false, onCallEngineers: 2 },
    })
    expect(exclusionsFor(daytimeOnly, 30, MIDDAY)).toEqual([])
    expect(exclusionsFor(daytimeOnly, 30, TWO_AM).map((e) => e.label)).toEqual([
      'No overnight cover',
    ])
    expect(exclusionsFor(daytimeOnly, 30, SATURDAY).map((e) => e.label)).toEqual([
      'No weekend cover',
    ])
  })

  it('excludes anyone over the ETA limit', () => {
    const r = responder('RSP-001', 5)
    expect(exclusionsFor(r, MAX_OFFER_ETA_MINUTES, MIDDAY)).toEqual([])
    expect(exclusionsFor(r, 140, MIDDAY)).toEqual([
      { code: 'eta-too-long', factor: 'eta', label: 'ETA 2 h 20 min, over the 2 h limit' },
    ])
  })
})

describe('matchResponders', () => {
  it('scores 100 points over four factors that add up to the score shown', () => {
    expect(Object.values(FACTOR_WEIGHTS).reduce((a, b) => a + b, 0)).toBe(100)
    const result = matchResponders(
      [responder('RSP-001', 10), responder('RSP-002', 30, { rating: 4.9 })],
      site,
      MIDDAY,
    )
    for (const candidate of result.ranked) {
      const sum = candidate.factors.reduce((total, f) => total + f.points, 0)
      expect(candidate.score).toBeCloseTo(sum, 9)
      for (const f of candidate.factors) {
        expect(f.points).toBeGreaterThanOrEqual(0)
        expect(f.points).toBeLessThanOrEqual(f.max)
      }
    }
  })

  it('ranks on ETA and rating once every check passes', () => {
    const near = responder('RSP-001', 5, { rating: 4 })
    const farButBetter = responder('RSP-002', 60, { rating: 5 })
    const result = matchResponders([farButBetter, near], site, MIDDAY)
    expect(result.ranked.map((c) => c.responder.id)).toEqual(['RSP-001', 'RSP-002'])
    expect(result.chosen?.responder.id).toBe('RSP-001')

    const [first] = result.ranked
    expect(first?.factors.map((f) => f.factor)).toEqual([
      'eta',
      'rating',
      'availability',
      'compliance',
    ])
    expect(first?.factors.find((f) => f.factor === 'rating')?.points).toBe(12.5)
  })

  it('never chooses an expired responder, however near and well rated', () => {
    const responders = [
      responder('RSP-001', 1, { rating: 5, authorisationExpiry: MIDDAY - DAY_MS }),
      responder('RSP-002', 2, { rating: 5, insuranceExpiry: MIDDAY - DAY_MS }),
      responder('RSP-003', 3, { rating: 5, authorisationExpiry: null }),
      responder('RSP-004', 40, { rating: 3.2 }),
    ]
    const result = matchResponders(responders, site, MIDDAY)
    expect(result.chosen?.responder.id).toBe('RSP-004')
    expect(result.ranked.map((c) => c.responder.id)).toEqual(['RSP-004'])
    expect(result.excluded.map((c) => c.responder.id)).toEqual(['RSP-001', 'RSP-002', 'RSP-003'])
    for (const c of result.excluded) {
      expect(c.factors).toEqual([])
      expect(c.score).toBe(0)
    }
  })

  it('excludes responders without overnight cover from an overnight request', () => {
    const responders = [
      responder('RSP-001', 2, {
        rating: 5,
        availability: { weekends: true, overnight: false, onCallEngineers: 8 },
      }),
      responder('RSP-002', 25),
    ]
    const night = matchResponders(responders, site, TWO_AM)
    expect(night.overnight).toBe(true)
    expect(night.chosen?.responder.id).toBe('RSP-002')
    expect(night.excluded[0]?.exclusions.map((e) => e.code)).toEqual(['no-overnight-cover'])
    expect(night.ranked.every((c) => c.responder.availability.overnight)).toBe(true)

    // The same responder wins the job in the daytime
    expect(matchResponders(responders, site, MIDDAY).chosen?.responder.id).toBe('RSP-001')
  })

  it('flags paperwork renewing within 90 days without changing the score', () => {
    const renewing = responder('RSP-001', 10, { insuranceExpiry: MIDDAY + 30 * DAY_MS })
    const clear = responder('RSP-002', 10)
    const result = matchResponders([renewing, clear], site, MIDDAY)
    const compliance = (id: string) =>
      result.ranked
        .find((c) => c.responder.id === id)
        ?.factors.find((f) => f.factor === 'compliance')
    expect(compliance('RSP-001')).toMatchObject({
      points: 10,
      attention: true,
      detail: 'Insurance renews 13 Nov 2026',
    })
    expect(compliance('RSP-002')).toMatchObject({ points: 10, attention: false })
  })

  it('only considers the nearest responders', () => {
    const responders = Array.from({ length: 12 }, (_, i) =>
      responder(`RSP-${String(i + 1).padStart(3, '0')}`, 5 + i * 3),
    )
    const result = matchResponders(responders, site, MIDDAY)
    expect(result.ranked.length + result.excluded.length).toBe(CANDIDATE_POOL_SIZE)
    expect(result.notConsidered).toBe(12 - CANDIDATE_POOL_SIZE)
    expect(matchResponders(responders, site, MIDDAY, { poolSize: 3 }).ranked).toHaveLength(3)
  })

  it('breaks ties the same way every time', () => {
    const a = responder('RSP-002', 10)
    const b = responder('RSP-001', 10)
    expect(matchResponders([a, b], site, MIDDAY).chosen?.responder.id).toBe('RSP-001')
    expect(matchResponders([b, a], site, MIDDAY).chosen?.responder.id).toBe('RSP-001')
  })

  it('chooses nobody when nobody passes', () => {
    const result = matchResponders([responder('RSP-001', 400)], site, MIDDAY)
    expect(result.chosen).toBeNull()
    expect(result.excluded[0]?.exclusions[0]?.code).toBe('eta-too-long')
    expect(matchResponders([], site, MIDDAY).chosen).toBeNull()
  })

  it('rejects an unusable pool size', () => {
    expect(() => matchResponders([], site, MIDDAY, { poolSize: 0 })).toThrow(RangeError)
    expect(() => matchResponders([], site, MIDDAY, { poolSize: 1.5 })).toThrow(RangeError)
  })
})

describe('explainMatch', () => {
  it('gives the margin, the factors that decided it and anyone nearer who was excluded', () => {
    const responders = [
      responder('RSP-001', 1, { name: 'Lapsed Ltd', insuranceExpiry: MIDDAY - DAY_MS }),
      responder('RSP-002', 10, { name: 'Quick Ltd', rating: 4 }),
      responder('RSP-003', 40, { name: 'Slow Ltd', rating: 5 }),
    ]
    const lines = explainMatch(matchResponders(responders, site, MIDDAY))
    expect(lines[0]).toMatch(/^Quick Ltd scores [\d.]+, [\d.]+ points ahead of Slow Ltd\.$/)
    expect(lines[1]).toMatch(/^ETA: \d+ min against \d+ min \(\+[\d.]+\)\.$/)
    expect(lines[2]).toBe('Rating: 4 of 5 against 5 of 5 (−12.5).')
    expect(lines[3]).toBe('Nearer but excluded: Lapsed Ltd (Insurance expired 13 Oct 2026).')
  })

  it('covers a single eligible responder and nobody at all', () => {
    expect(explainMatch(matchResponders([responder('RSP-001', 10)], site, MIDDAY))).toEqual([
      'Responder RSP-001 is the only responder that passes every check.',
    ])
    expect(explainMatch(matchResponders([], site, MIDDAY))).toEqual([
      'No responder passes every check within 2 h.',
    ])
  })

  it('names the tiebreak when scores are level', () => {
    const lines = explainMatch(
      matchResponders([responder('RSP-002', 10), responder('RSP-001', 10)], site, MIDDAY),
    )
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(
      /^Responder RSP-001 ties with Responder RSP-002 on [\d.]+ and goes first on responder ID\.$/,
    )
  })
})
