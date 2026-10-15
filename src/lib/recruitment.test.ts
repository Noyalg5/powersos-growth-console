import { describe, expect, it } from 'vitest'
import type { Responder, Site } from '@/types'
import { siteCoverage, type SiteCoverage } from './coverage'
import { destinationPoint, reachKm } from './geo'
import type { CoverContext } from './matching'
import { lapsedNearby, planRecruitment, type RecruitTown } from './recruitment'
import { DAY_MS } from './time'

const AT = Date.UTC(2026, 9, 14, 8, 0)
const DAY: CoverContext = { at: AT, overnight: false, weekend: false }

// Three clusters of sites, far enough apart that no town reaches two of them
const carlisle: RecruitTown = { name: 'Carlisle', region: 'North West', lat: 54.89, lng: -2.93 }
const truro: RecruitTown = { name: 'Truro', region: 'South West', lat: 50.26, lng: -5.05 }
const norwich: RecruitTown = { name: 'Norwich', region: 'East of England', lat: 52.63, lng: 1.3 }
const nowhere: RecruitTown = { name: 'Lerwick', region: 'Scotland', lat: 60.15, lng: -1.15 }

function site(id: string, town: RecruitTown, criticality: Site['criticality']): Site {
  return {
    id,
    customerId: 'CUS-001',
    name: `Site ${id}`,
    town: town.name,
    region: town.region,
    ...destinationPoint(town, 45, 3),
    postcodeArea: null,
    criticality,
    equipment: [],
    contacts: [],
  }
}

function responder(id: string, near: RecruitTown, overrides: Partial<Responder> = {}): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: near.name,
    region: near.region,
    ...destinationPoint(near, 180, 4),
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

/** Carlisle: two uncovered sites worth 9. Truro: one thin site worth 5. Norwich: covered. */
function fixture(): SiteCoverage[] {
  const sites = [
    site('SITE-001', carlisle, 5),
    site('SITE-002', carlisle, 4),
    site('SITE-003', truro, 5),
    site('SITE-004', norwich, 5),
  ]
  const responders = [
    responder('RSP-001', truro),
    responder('RSP-002', norwich),
    responder('RSP-003', norwich),
  ]
  return siteCoverage(sites, responders, DAY)
}

const towns = [norwich, truro, carlisle, nowhere]

describe('planRecruitment', () => {
  it('picks the town that adds the most under-covered criticality', () => {
    const [first] = planRecruitment(fixture(), towns, { picks: 1 }).picks
    expect(first).toMatchObject({
      town: { name: 'Carlisle' },
      sitesReached: 2,
      firstResponder: 2,
      newlyCovered: 0,
      criticalityGained: 9,
    })
  })

  it('updates the picture between picks, so a town can win twice', () => {
    const plan = planRecruitment(fixture(), towns, { picks: 3 })
    expect(plan.picks.map((p) => p.town.name)).toEqual(['Carlisle', 'Carlisle', 'Truro'])
    expect(plan.picks[1]).toMatchObject({ newlyCovered: 2, firstResponder: 0 })
    expect(plan.picks[2]).toMatchObject({ newlyCovered: 1, criticalityGained: 5 })
    expect(plan.before).toMatchObject({ covered: 1, thin: 1, uncovered: 2 })
    expect(plan.after).toMatchObject({ covered: 4, thin: 0, uncovered: 0, coveredShare: 1 })
  })

  it('never lowers coverage with a pick', () => {
    const plan = planRecruitment(fixture(), towns, { picks: 5 })
    for (const pick of plan.picks) {
      expect(pick.after.coveredShare).toBeGreaterThanOrEqual(pick.before.coveredShare)
      expect(pick.after.uncovered).toBeLessThanOrEqual(pick.before.uncovered)
      expect(pick.criticalityGained).toBeGreaterThan(0)
    }
    plan.picks.slice(1).forEach((pick, i) => {
      expect(pick.before).toEqual(plan.picks[i]?.after)
    })
  })

  it('stops early once nothing improves', () => {
    const plan = planRecruitment(fixture(), towns, { picks: 5 })
    expect(plan.picks).toHaveLength(3)
    expect(plan.stoppedEarly).toBe(true)

    // A town that reaches nothing never gets picked
    const unreachable = planRecruitment(fixture(), [nowhere])
    expect(unreachable.picks).toEqual([])
    expect(unreachable.stoppedEarly).toBe(true)
    expect(unreachable.after).toEqual(unreachable.before)
  })

  it('breaks ties by name', () => {
    const coverage = siteCoverage([site('SITE-001', carlisle, 3)], [], DAY)
    const twin = { ...carlisle, name: 'Arnside' }
    expect(planRecruitment(coverage, [carlisle, twin], { picks: 1 }).picks[0]?.town.name).toBe(
      'Arnside',
    )
  })

  it('makes no picks when asked for none, and rejects nonsense', () => {
    const plan = planRecruitment(fixture(), towns, { picks: 0 })
    expect(plan.picks).toEqual([])
    expect(plan.stoppedEarly).toBe(false)
    expect(() => planRecruitment(fixture(), towns, { picks: -1 })).toThrow(RangeError)
    expect(() => planRecruitment(fixture(), towns, { picks: 1.5 })).toThrow(RangeError)
  })

  it('places recruits within reach of the sites they are credited with', () => {
    const edge = destinationPoint(carlisle, 0, reachKm() + 10)
    const far = siteCoverage([{ ...site('SITE-009', carlisle, 5), ...edge }], [], DAY)
    expect(planRecruitment(far, [carlisle]).picks).toEqual([])
  })
})

describe('lapsedNearby', () => {
  it('finds responders held back only by paperwork', () => {
    const responders = [
      responder('RSP-001', carlisle, { authorisationExpiry: Date.UTC(2026, 7, 15) }),
      responder('RSP-002', carlisle, { insuranceExpiry: AT - DAY_MS }),
      responder('RSP-003', carlisle),
      responder('RSP-004', truro, { authorisationExpiry: AT - DAY_MS }),
    ]
    expect(
      lapsedNearby(carlisle, responders, DAY).map((l) => [l.responder.id, l.reasons]),
    ).toEqual([
      ['RSP-001', ['Authorisation expired 15 Aug 2026']],
      ['RSP-002', ['Insurance expired 13 Oct 2026']],
    ])
  })

  it('leaves out responders who would still lack cover for the hour', () => {
    const lapsedDayOnly = responder('RSP-001', carlisle, {
      authorisationExpiry: AT - DAY_MS,
      availability: { weekends: true, overnight: false, onCallEngineers: 2 },
    })
    expect(lapsedNearby(carlisle, [lapsedDayOnly], DAY)).toHaveLength(1)
    expect(lapsedNearby(carlisle, [lapsedDayOnly], { ...DAY, overnight: true })).toEqual([])
  })
})
