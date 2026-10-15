import { describe, expect, it } from 'vitest'
import type { Customer, Equipment, Partner, Responder, Site, Supplier } from '@/types'
import { costTotal } from './costs'
import { destinationPoint } from './geo'
import {
  buildSimulation,
  costAtStep,
  describeEquipment,
  etaStatus,
  expectedRating,
  MAKE_SAFE_MINUTES,
  responseProgress,
  SIDES,
  STEPS,
  type CostLine,
  type ScenarioInput,
} from './scenario'
import { DAY_MS, MINUTE_MS } from './time'

// Wednesday 14 Oct 2026 in London (BST)
const MIDDAY = Date.UTC(2026, 9, 14, 11, 0)
const TWO_AM = Date.UTC(2026, 9, 14, 1, 0)

const site: Site = {
  id: 'SITE-900',
  customerId: 'CUS-900',
  name: 'Testford Hospital',
  town: 'Oxford',
  region: 'South East',
  lat: 51.752,
  lng: -1.2577,
  postcodeArea: 'OX',
  criticality: 5,
  equipment: [
    {
      id: 'SITE-900-E1',
      kind: 'transformer',
      ratingKva: 800,
      voltage: '11/0.433 kV',
      cooling: 'oil',
      installedYear: 1990,
    },
    { id: 'SITE-900-E2', kind: 'generator', ratingKva: 500, fuel: 'diesel', installedYear: 2015 },
  ],
  contacts: [
    { name: 'Day Contact', role: 'Estates manager', phone: '07700 900001' },
    { name: 'Night Contact', role: 'Duty estates officer', phone: '07700 900002' },
  ],
}

const customer: Customer = {
  id: 'CUS-900',
  name: 'Testford Healthcare',
  sector: 'medical',
  headOffice: 'Oxford',
  joinedAt: MIDDAY - 400 * DAY_MS,
  sites: [site],
}

function responder(id: string, km: number, overrides: Partial<Responder> = {}): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Testtown',
    region: 'South East',
    ...destinationPoint(site, 45, km),
    engineers: 10,
    authorisationLevel: 'authorised-person',
    maxVoltageKv: 11,
    authorisationExpiry: MIDDAY + 400 * DAY_MS,
    insuranceExpiry: MIDDAY + 300 * DAY_MS,
    lastAuditAt: MIDDAY - 100 * DAY_MS,
    rating: 4.4,
    availability: { weekends: true, overnight: true, onCallEngineers: 3 },
    rates: { callOutFee: 300, hourlyRate: 100, outOfHoursMultiplier: 1.5 },
    joinedAt: MIDDAY - 500 * DAY_MS,
    contact: { name: 'Test Person', role: 'Operations director', phone: '07700 900003' },
    ...overrides,
  }
}

function supplier(id: string, overrides: Partial<Supplier>): Supplier {
  return {
    id,
    name: `Supplier ${id}`,
    category: 'generator-hire',
    town: 'Testtown',
    region: 'South East',
    ...destinationPoint(site, 0, 30),
    regionsServed: ['South East'],
    emergencyLine: true,
    stock: [],
    joinedAt: MIDDAY - 300 * DAY_MS,
    contact: { name: 'Test Person', role: 'Sales manager', phone: '07700 900004' },
    ...overrides,
  }
}

const partner = (id: string, kind: Partner['kind']): Partner => ({
  id,
  name: `Partner ${id}`,
  kind,
  town: 'Bristol',
  region: 'South West',
  referrals: 4,
  convertedReferrals: 1,
  since: MIDDAY - 200 * DAY_MS,
  contact: { name: 'Test Person', role: 'Head of engineering services', phone: '07700 900005' },
})

const hireSupplier = supplier('SUP-001', {
  stock: [{ description: '500 kVA containerised generator', quantity: 2, unit: 'units', leadTimeDays: 1 }],
})
const transformerSupplier = supplier('SUP-002', {
  category: 'transformers',
  emergencyLine: false,
  stock: [
    {
      description: '1,000 kVA 11/0.433 kV ground-mounted transformer',
      quantity: 1,
      unit: 'each',
      leadTimeDays: 2,
    },
  ],
})

function input(overrides: Partial<ScenarioInput> = {}): ScenarioInput {
  return {
    id: 'test',
    title: 'Test emergency',
    customer,
    site,
    equipment: site.equipment[0] as Equipment,
    faultType: 'transformer',
    faultLabel: 'Transformer fault',
    requestedAt: MIDDAY,
    story: { request: 'It failed.', onSite: 'Made safe.', resolved: 'Fixed.' },
    responders: [
      // Nearest and best rated, but uninsured: must never be sent
      responder('RSP-001', 3, { rating: 5, insuranceExpiry: MIDDAY - DAY_MS }),
      responder('RSP-002', 20),
      responder('RSP-003', 45),
    ],
    suppliers: [hireSupplier, transformerSupplier],
    orders: [{ category: 'generator-hire', purpose: 'hire', minKva: 480 }],
    facilities: partner('PTN-001', 'facilities-management'),
    insurer: partner('PTN-002', 'insurer'),
    history: {
      faultType: 'transformer',
      jobs: 10,
      medianRepairMinutes: 300,
      longestRepairMinutes: 600,
      medianParts: 5000,
      largestParts: 12000,
    },
    basis: 'typical',
    hireDayRate: 1000,
    ...overrides,
  }
}

describe('steps and sides', () => {
  it('runs request to review across four sides', () => {
    expect(STEPS.map((s) => s.label)).toEqual([
      'Request',
      'Match',
      'Dispatch',
      'Source parts',
      'On site',
      'Resolved',
      'Review',
    ])
    expect(SIDES).toEqual(['customer', 'responder', 'supplier', 'partner'])
  })
})

describe('etaStatus', () => {
  it('is amber from 15 minutes before the 75-minute target and red past it', () => {
    expect(etaStatus(0)).toBe('on-track')
    expect(etaStatus(59)).toBe('on-track')
    expect(etaStatus(60)).toBe('near-target')
    expect(etaStatus(75)).toBe('near-target')
    expect(etaStatus(76)).toBe('past-target')
    expect(etaStatus(50, 60)).toBe('near-target')
  })

  it('rejects unusable input', () => {
    expect(() => etaStatus(-1)).toThrow(RangeError)
    expect(() => etaStatus(Number.NaN)).toThrow(RangeError)
    expect(() => etaStatus(10, 15)).toThrow(RangeError)
  })
})

describe('responseProgress', () => {
  const timeline = {
    requestedAt: MIDDAY,
    acceptedAt: MIDDAY + 4 * MINUTE_MS,
    arrivedAt: MIDDAY + 80 * MINUTE_MS,
  }

  it('has no expected arrival until a responder accepts', () => {
    expect(responseProgress(MIDDAY, timeline)).toEqual({
      elapsedMinutes: 0,
      expectedMinutes: null,
      arrived: false,
      status: null,
    })
  })

  it('counts up to arrival and then holds', () => {
    expect(responseProgress(MIDDAY + 30 * MINUTE_MS, timeline)).toEqual({
      elapsedMinutes: 30,
      expectedMinutes: 80,
      arrived: false,
      status: 'past-target',
    })
    expect(responseProgress(MIDDAY + 300 * MINUTE_MS, timeline)).toMatchObject({
      elapsedMinutes: 80,
      arrived: true,
    })
  })

  it('rejects a time before the request', () => {
    expect(() => responseProgress(MIDDAY - 1, timeline)).toThrow(RangeError)
  })
})

describe('costAtStep', () => {
  const lines: CostLine[] = [
    { key: 'callOutFee', label: 'Call-out fee', amount: 300, basis: '', committedAt: 'match' },
    { key: 'labour', label: 'Labour', amount: 600.5, basis: '', committedAt: 'resolved' },
    { key: 'parts', label: 'Parts', amount: 99.99, basis: '', committedAt: 'source' },
  ]

  it('shows nothing before the match, then an estimate that fills in step by step', () => {
    expect(costAtStep(lines, 'request')).toMatchObject({ committed: 0, predicted: null })
    expect(costAtStep(lines, 'request').lines.every((l) => l.status === 'pending')).toBe(true)
    expect(costAtStep(lines, 'match')).toMatchObject({ committed: 300, predicted: 1000.49 })
    expect(costAtStep(lines, 'source').committed).toBe(399.99)
    expect(costAtStep(lines, 'source').lines.map((l) => l.status)).toEqual([
      'committed',
      'estimate',
      'committed',
    ])
    expect(costAtStep(lines, 'review')).toMatchObject({ committed: 1000.49, predicted: 1000.49 })
  })

  it('rejects an unknown step', () => {
    expect(() => costAtStep(lines, 'invoice' as never)).toThrow(RangeError)
  })
})

describe('expectedRating', () => {
  it('follows the average, marked down for a late arrival', () => {
    expect(expectedRating(4.4, 60)).toBe(4)
    expect(expectedRating(4.4, 30)).toBe(5)
    expect(expectedRating(4.4, 80)).toBe(4)
    expect(expectedRating(4.4, 120)).toBe(3)
    expect(expectedRating(5, 10)).toBe(5)
    expect(expectedRating(1.2, 200)).toBe(1)
  })
})

describe('describeEquipment', () => {
  it('describes each kind of plant', () => {
    const [transformer, standby] = site.equipment as [Equipment, Equipment]
    expect(describeEquipment(transformer)).toBe('800 kVA oil-filled transformer (1990)')
    expect(describeEquipment(standby)).toBe('500 kVA standby generator (2015)')
    expect(
      describeEquipment({
        id: 'x',
        kind: 'switchgear',
        voltageKv: 11,
        panels: 7,
        insulation: 'SF6',
        installedYear: 2011,
      }),
    ).toBe('11 kV switchboard, 7 panels (2011)')
    expect(
      describeEquipment({ id: 'x', kind: 'rmu', voltageKv: 11, insulation: 'oil', installedYear: 1985 }),
    ).toBe('11 kV ring main unit (1985)')
  })
})

describe('buildSimulation', () => {
  const sim = buildSimulation(input())

  it('never sends an expired responder', () => {
    expect(sim.responder.responder.id).toBe('RSP-002')
    expect(sim.match.excluded.map((c) => c.responder.id)).toContain('RSP-001')
  })

  it('times every step in order from the request', () => {
    expect(sim.steps.map((s) => s.id)).toEqual(STEPS.map((s) => s.id))
    for (let i = 1; i < sim.steps.length; i++) {
      expect(sim.steps[i]?.at).toBeGreaterThanOrEqual(sim.steps[i - 1]?.at ?? Infinity)
    }
    expect(sim.times['on-site'] - sim.times.request).toBe(sim.responseMinutes * MINUTE_MS)
    expect(sim.responseMinutes).toBe(4 + sim.responder.etaMinutes)
  })

  it('makes the cost total the sum of its parts at every step', () => {
    expect(sim.total).toBe(costTotal(sim.cost))
    expect(sim.total).toBeCloseTo(
      sim.cost.callOutFee + sim.cost.labour + sim.cost.parts + sim.cost.generatorHire,
      9,
    )
    expect(sim.total).toBeCloseTo(
      sim.costs.reduce((sum, line) => sum + line.amount, 0),
      9,
    )
    const running = sim.steps.map((s) => s.cost.committed)
    expect(running[0]).toBe(0)
    for (let i = 1; i < running.length; i++) {
      expect(running[i]).toBeGreaterThanOrEqual(running[i - 1] ?? Infinity)
    }
    expect(running.at(-1)).toBe(sim.total)
  })

  it('prices the job from the responder, the history and the hire rate', () => {
    expect(sim.cost).toEqual({
      callOutFee: 300,
      // 300 min on site → 5 h × 2 engineers × £100
      labour: 1000,
      parts: 5000,
      generatorHire: 1000,
    })
    expect(buildSimulation(input({ basis: 'largest' })).cost.parts).toBe(12000)
  })

  it('orders parts and hire only once the customer has approved', () => {
    const approval = sim.steps.find((s) => s.id === 'source')
    const customerScreen = approval?.screens.customer[0]
    expect(customerScreen?.title).toBe('Approve the estimate')
    expect(customerScreen?.action).toMatch(/^Approve £/)

    for (const key of ['parts', 'generatorHire'] as const) {
      const statuses = sim.steps.map(
        (s) => s.cost.lines.find((l) => l.line.key === key)?.status,
      )
      expect(statuses.indexOf('committed')).toBe(STEPS.findIndex((s) => s.id === 'source'))
    }
    for (const order of sim.orders) expect(order.deliveryAt).toBeGreaterThan(sim.times.source)
    expect(sim.steps[2]?.screens.supplier[0]?.title).toBe('Reserved')
    expect(sim.steps[3]?.screens.supplier[0]?.title).toBe('Order confirmed')
  })

  it('shows every side at every step, empty when it has nothing to do', () => {
    for (const step of sim.steps) expect(Object.keys(step.screens).sort()).toEqual([...SIDES].sort())
    const quiet = (side: (typeof SIDES)[number]) =>
      sim.steps.filter((s) => s.screens[side].length === 0).map((s) => s.id)
    expect(quiet('customer')).toEqual([])
    expect(quiet('supplier')).toEqual(['request'])
    expect(quiet('partner')).toEqual(['match', 'source', 'on-site'])
    const closing = sim.steps.at(-1)?.screens.partner.map((s) => s.title)
    expect(closing).toEqual(['Closing report', 'Incident record filed'])
  })

  it('applies out-of-hours rates and calls the on-call contact overnight', () => {
    const night = buildSimulation(input({ requestedAt: TWO_AM }))
    expect(night.outOfHours).toBe(true)
    expect(night.contact.name).toBe('Night Contact')
    expect(night.cost.callOutFee).toBe(450)
    expect(sim.contact.name).toBe('Day Contact')
  })

  it('bills a short wait for parts, but only making safe when parts are days away', () => {
    const part = { category: 'transformers', purpose: 'part', minKva: 800 } as const
    const longWait = buildSimulation(input({ orders: [part] }))
    const delivered = longWait.orders[0]?.deliveryAt
    expect(delivered).toBe(longWait.times.source + 2 * DAY_MS)
    expect(longWait.onSiteMinutes).toBe(MAKE_SAFE_MINUTES + 300)
    expect(longWait.times.resolved).toBe((delivered ?? 0) + 300 * MINUTE_MS)
    expect(longWait.cost.generatorHire).toBe(0)

    const shortWait = buildSimulation(
      input({
        orders: [part],
        suppliers: [{ ...transformerSupplier, emergencyLine: true }],
      }),
    )
    const wait = ((shortWait.orders[0]?.deliveryAt ?? 0) - shortWait.times['on-site']) / MINUTE_MS
    expect(wait).toBeGreaterThan(0)
    expect(shortWait.onSiteMinutes).toBe(wait + 300)
  })

  it('hires for every day, or part day, until the job is resolved', () => {
    expect(sim.cost.generatorHire).toBe(1000)
    const longJob = buildSimulation(
      input({ history: { ...input().history, medianRepairMinutes: 30 * 60 } }),
    )
    expect(longJob.cost.generatorHire).toBe(2000)
  })

  it('refuses a scenario nobody can respond to or supply', () => {
    expect(() => buildSimulation(input({ responders: [responder('RSP-009', 500)] }))).toThrow(
      'No eligible responder',
    )
    expect(() =>
      buildSimulation(
        input({ orders: [{ category: 'generator-hire', purpose: 'hire', minKva: 5000 }] }),
      ),
    ).toThrow('No supplier can provide 5000 kVA')
    expect(() => buildSimulation(input({ site: { ...site, contacts: [] } }))).toThrow(
      'no emergency contact',
    )
  })
})
