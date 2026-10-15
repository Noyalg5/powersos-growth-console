import { describe, expect, it } from 'vitest'
import type { CallOut, Customer, Responder, Site } from '@/types'
import { siteCoverage, summariseCoverage } from './coverage'
import { destinationPoint } from './geo'
import { networkView } from './networkHealth'
import { coverContextFor, defaultFilters } from './networkFilters'
import type { RecruitTown } from './recruitment'
import { DAY_MS, HOUR_MS } from './time'

const AT = Date.UTC(2026, 9, 14, 8, 0)
const bounds = { min: Date.UTC(2025, 9, 14), max: Date.UTC(2026, 9, 14) }

const leeds: RecruitTown = { name: 'Leeds', region: 'Yorkshire and the Humber', lat: 53.8, lng: -1.55 }
const truro: RecruitTown = { name: 'Truro', region: 'South West', lat: 50.26, lng: -5.05 }

const customers = [
  { id: 'CUS-001', sector: 'medical' },
  { id: 'CUS-002', sector: 'telecoms' },
] as Customer[]

function site(id: string, customerId: string, town: RecruitTown): Site {
  return {
    id,
    customerId,
    name: `Site ${id}`,
    town: town.name,
    region: town.region,
    ...destinationPoint(town, 45, 3),
    postcodeArea: null,
    criticality: 4,
    equipment: [],
    contacts: [],
  }
}

function responder(id: string, near: RecruitTown): Responder {
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
  }
}

function callOut(id: string, siteId: string, customerId: string, acceptMinutes: number): CallOut {
  const requestedAt = Date.UTC(2026, 4, 1, 12)
  return {
    id,
    siteId,
    customerId,
    responderId: 'RSP-001',
    faultType: 'cable',
    requestedAt,
    acceptedAt: requestedAt + acceptMinutes * 60_000,
    arrivedAt: requestedAt + 60 * 60_000,
    resolvedAt: requestedAt + 3 * HOUR_MS,
    distanceMiles: 10,
    cost: { callOutFee: 300, labour: 400, parts: 0, generatorHire: 0 },
    rating: 5,
  }
}

const data = {
  customers,
  // Leeds is covered twice over; Truro has nobody
  sites: [site('SITE-001', 'CUS-001', leeds), site('SITE-002', 'CUS-002', truro)],
  responders: [responder('RSP-001', leeds), responder('RSP-002', leeds)],
  callOuts: [callOut('CO-1', 'SITE-001', 'CUS-001', 4), callOut('CO-2', 'SITE-001', 'CUS-001', 8)],
}

describe('networkView', () => {
  const filters = defaultFilters(bounds)
  const view = networkView(filters, data, [leeds, truro], AT)

  it('matches the coverage worked out directly', () => {
    const direct = siteCoverage(data.sites, data.responders, coverContextFor(filters, AT))
    expect(view.coverage.map((c) => c.status)).toEqual(direct.map((c) => c.status))
    expect(view.kpis.coverage).toEqual(summariseCoverage(direct.map((c) => c.status)))
    expect(view.coverage.map((c) => c.status)).toEqual(['covered', 'uncovered'])
  })

  it('lists the gaps and recruits towards them', () => {
    expect(view.gaps.map((g) => g.town)).toEqual(['Truro'])
    expect(view.plan.picks[0]?.town.name).toBe('Truro')
  })

  it('reports the headline measures for the call-outs in view', () => {
    expect(view.kpis.callOuts).toBe(2)
    expect(view.kpis.medianAccept).toBe(6)
    expect(view.kpis.onTarget).toBe(1)
    expect(view.kpis.monthly.reduce((sum, m) => sum + m.count, 0)).toBe(2)
    expect(view.kpis.utilisation.jobHours).toBeGreaterThan(0)
  })

  it('narrows everything to the filters', () => {
    const telecoms = networkView({ ...filters, sector: 'telecoms' }, data, [leeds, truro], AT)
    expect(telecoms.coverage.map((c) => c.site.id)).toEqual(['SITE-002'])
    expect(telecoms.kpis.callOuts).toBe(0)
    expect(telecoms.kpis.medianAccept).toBeNull()
    expect(telecoms.kpis.onTarget).toBeNull()
  })

  it('copes with an empty network', () => {
    const empty = networkView(filters, { customers: [], sites: [], responders: [], callOuts: [] }, [], AT)
    expect(empty.kpis.coverage.sites).toBe(0)
    expect(empty.gaps).toEqual([])
    expect(empty.plan.picks).toEqual([])
    expect(empty.kpis.utilisation.share).toBeNull()
  })
})
