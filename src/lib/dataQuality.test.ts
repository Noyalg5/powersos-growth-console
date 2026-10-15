import { describe, expect, it } from 'vitest'
import type {
  CallOut,
  Customer,
  Lead,
  OnboardingRecord,
  Partner,
  Responder,
  SideId,
  Site,
  Supplier,
} from '@/types'
import {
  checkAnswerKey,
  DATASETS,
  DIMENSIONS,
  filterIssues,
  issuesTable,
  NO_ISSUE_FILTERS,
  PLANTED_ISSUE_RULES,
  qualityScore,
  RULES,
  runQualityChecks,
  type QualityData,
} from './dataQuality'
import { CHECKLISTS } from './onboarding'
import { DAY_MS, HOUR_MS, MINUTE_MS } from './time'

// 09:00 on Wednesday 14 Oct 2026, London time
const AS_OF = Date.UTC(2026, 9, 14, 8, 0)
const ago = (days: number) => Date.UTC(2026, 9, 14) - days * DAY_MS

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends readonly (infer U)[] ? U[] : T[K] }
type Fixture = Mutable<QualityData>

function site(
  id: string,
  customerId: string,
  name: string,
  lat: number,
  lng: number,
  postcodeArea: string,
): Site {
  return {
    id,
    customerId,
    name,
    town: name.split(' ')[0] ?? name,
    region: 'Yorkshire and the Humber',
    lat,
    lng,
    postcodeArea,
    criticality: 4,
    equipment: [
      { id: `${id}-E1`, kind: 'rmu', voltageKv: 11, insulation: 'SF6', installedYear: 2010 },
      {
        id: `${id}-E2`,
        kind: 'transformer',
        ratingKva: 1000,
        voltage: '11/0.433 kV',
        cooling: 'oil',
        installedYear: 2012,
      },
    ],
    contacts: [
      { name: 'Ann Example', role: 'Estates manager', phone: '07700 900001' },
      { name: 'Bob Example', role: 'Duty estates officer', phone: '07700 900002' },
    ],
  }
}

function responder(id: string, lat: number, lng: number): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    lat,
    lng,
    engineers: 8,
    authorisationLevel: 'authorised-person',
    maxVoltageKv: 11,
    authorisationExpiry: ago(-400),
    insuranceExpiry: ago(-300),
    lastAuditAt: ago(100),
    rating: 4.4,
    availability: { weekends: true, overnight: true, onCallEngineers: 2 },
    rates: { callOutFee: 300, hourlyRate: 100, outOfHoursMultiplier: 1.5 },
    joinedAt: ago(500),
    contact: { name: 'Cat Example', role: 'Operations director', phone: '07700 900003' },
  }
}

function callOut(
  id: string,
  siteId: string,
  customerId: string,
  responderId: string,
  at: number,
): CallOut {
  return {
    id,
    siteId,
    customerId,
    responderId,
    faultType: 'cable',
    requestedAt: at,
    acceptedAt: at + 5 * MINUTE_MS,
    arrivedAt: at + 50 * MINUTE_MS,
    resolvedAt: at + 170 * MINUTE_MS,
    distanceMiles: 12,
    cost: { callOutFee: 300, labour: 400, parts: 250, generatorHire: 0 },
    rating: 4,
  }
}

/** A live organisation whose checklist was finished the day it went live. */
function live(
  id: string,
  side: SideId,
  orgId: string,
  name: string,
  onboardedDaysAgo: number,
): OnboardingRecord {
  const onboarded = ago(onboardedDaysAgo)
  return {
    id,
    side,
    orgId,
    name,
    town: 'Leeds',
    stage: 'onboarded',
    entered: {
      aware: ago(onboardedDaysAgo + 80),
      engaged: ago(onboardedDaysAgo + 60),
      signed: ago(onboardedDaysAgo + 30),
      onboarded,
    },
    checklist: CHECKLISTS[side].map(({ id: item }) => ({ item, doneAt: onboarded })),
    lastActiveAt: ago(5),
    churnedAt: null,
  }
}

/** A small, clean set of every dataset. */
function fixture(): Fixture {
  const customers: Customer[] = [
    {
      id: 'CUS-001',
      name: 'Alpha Hospitals',
      sector: 'medical',
      headOffice: 'Leeds',
      joinedAt: ago(400),
      sites: [
        site('SITE-001', 'CUS-001', 'Leeds Hospital', 53.8, -1.55, 'LS'),
        site('SITE-002', 'CUS-001', 'Sheffield Hospital', 53.38, -1.47, 'S'),
      ],
    },
    {
      id: 'CUS-002',
      name: 'Beta Logistics',
      sector: 'warehousing',
      headOffice: 'Bristol',
      joinedAt: ago(300),
      sites: [site('SITE-003', 'CUS-002', 'Bristol Depot', 51.45, -2.59, 'BS')],
    },
  ]
  const suppliers: Supplier[] = [
    {
      id: 'SUP-001',
      name: 'Gamma Switchgear',
      category: 'switchgear',
      town: 'Stoke-on-Trent',
      region: 'West Midlands',
      lat: 53.0,
      lng: -2.18,
      regionsServed: ['West Midlands'],
      emergencyLine: true,
      stock: [{ description: 'HV fuse set', quantity: 10, unit: 'sets', leadTimeDays: 1 }],
      joinedAt: ago(200),
      contact: { name: 'Dee Example', role: 'Sales manager', phone: '07700 900004' },
    },
  ]
  const partners: Partner[] = [
    {
      id: 'PTN-001',
      name: 'Delta Facilities Management',
      kind: 'facilities-management',
      town: 'Leeds',
      region: 'Yorkshire and the Humber',
      referrals: 3,
      convertedReferrals: 1,
      since: ago(600),
      contact: { name: 'Eve Example', role: 'Head of engineering services', phone: '07700 900005' },
    },
  ]
  const leads: Lead[] = [
    {
      id: 'LEAD-001',
      organisation: 'Epsilon Farms',
      sector: 'agriculture',
      town: 'Lincoln',
      region: 'East Midlands',
      stage: 'wait-list',
      estimatedSites: 2,
      source: 'inbound',
      partnerId: null,
      contact: { name: 'Fay Example', role: 'Farm director', phone: '07700 900006' },
      createdAt: ago(20),
      lastContactAt: null,
      notes: '',
    },
    {
      id: 'LEAD-002',
      organisation: 'Zeta Foods',
      sector: 'manufacturing',
      town: 'Derby',
      region: 'East Midlands',
      stage: 'discovery',
      estimatedSites: 3,
      source: 'partner-referral',
      partnerId: 'PTN-001',
      contact: { name: 'Gus Example', role: 'Plant director', phone: '07700 900007' },
      createdAt: ago(50),
      lastContactAt: ago(10),
      notes: '',
    },
  ]
  const prospect = live('ONB-007', 'responder', 'RSP-003', 'Responder RSP-003', 0)
  return {
    customers,
    sites: customers.flatMap((c) => c.sites),
    responders: [responder('RSP-001', 53.79, -1.54), responder('RSP-002', 52.48, -1.89)],
    suppliers,
    partners,
    callOuts: [
      // Monday 14 Sept, 12:00, and Saturday 15 Aug, 11:00, London time
      callOut('CO-0001', 'SITE-001', 'CUS-001', 'RSP-001', ago(30) + 11 * HOUR_MS),
      callOut('CO-0002', 'SITE-003', 'CUS-002', 'RSP-002', ago(60) + 10 * HOUR_MS),
    ],
    leads,
    onboarding: [
      live('ONB-001', 'customer', 'CUS-001', 'Alpha Hospitals', 400),
      live('ONB-002', 'customer', 'CUS-002', 'Beta Logistics', 300),
      live('ONB-003', 'responder', 'RSP-001', 'Responder RSP-001', 500),
      live('ONB-004', 'responder', 'RSP-002', 'Responder RSP-002', 500),
      live('ONB-005', 'supplier', 'SUP-001', 'Gamma Switchgear', 200),
      live('ONB-006', 'partner', 'PTN-001', 'Delta Facilities Management', 600),
      // Signed 30 days ago, with its HV authorisation uploaded since
      {
        ...prospect,
        stage: 'signed',
        entered: { aware: ago(60), engaged: ago(45), signed: ago(30), onboarded: null },
        checklist: prospect.checklist.map((e, i) => ({ ...e, doneAt: i === 0 ? ago(20) : null })),
        lastActiveAt: null,
      },
      {
        ...live('ONB-008', 'customer', 'LEAD-002', 'Zeta Foods', 0),
        stage: 'engaged',
        entered: { aware: ago(50), engaged: ago(30), signed: null, onboarded: null },
        checklist: CHECKLISTS.customer.map(({ id }) => ({ item: id, doneAt: null })),
        lastActiveAt: null,
      },
    ],
  }
}

function find<T extends { id: string }>(rows: readonly T[], id: string): T {
  const row = rows.find((r) => r.id === id)
  if (!row) throw new Error(`No ${id} in the fixture`)
  return row
}

const run = (data: QualityData) => runQualityChecks(data, AS_OF)

/** Each rule, a way to break the clean fixture for it, and the record it should flag. */
const BREAKS: [ruleId: string, breakIt: (f: Fixture) => void, recordId: string][] = [
  ['site-postcode', (f) => void (find(f.sites, 'SITE-002').postcodeArea = null), 'SITE-002'],
  ['site-contacts', (f) => void find(f.sites, 'SITE-001').contacts.splice(1), 'SITE-001'],
  [
    'site-equipment',
    (f) => {
      const s = find(f.sites, 'SITE-001')
      s.equipment = s.equipment.filter((e) => e.kind !== 'transformer')
    },
    'SITE-001',
  ],
  ['customer-sites', (f) => void (find(f.customers, 'CUS-002').sites = []), 'CUS-002'],
  [
    'responder-authorisation-expiry',
    (f) => void (find(f.responders, 'RSP-002').authorisationExpiry = null),
    'RSP-002',
  ],
  ['supplier-catalogue', (f) => void (find(f.suppliers, 'SUP-001').regionsServed = []), 'SUP-001'],
  [
    'onboarding-record',
    (f) => void (f.onboarding = f.onboarding.filter((r) => r.orgId !== 'SUP-001')),
    'SUP-001',
  ],
  // Dublin
  [
    'site-mainland',
    (f) => void Object.assign(find(f.sites, 'SITE-003'), { lat: 53.35, lng: -6.26 }),
    'SITE-003',
  ],
  // Latitude and longitude swapped
  [
    'responder-mainland',
    (f) => void Object.assign(find(f.responders, 'RSP-002'), { lat: -1.89, lng: 52.48 }),
    'RSP-002',
  ],
  // Calais
  [
    'supplier-mainland',
    (f) => void Object.assign(find(f.suppliers, 'SUP-001'), { lat: 50.95, lng: 1.86 }),
    'SUP-001',
  ],
  [
    'site-postcode-format',
    (f) => void (find(f.sites, 'SITE-001').postcodeArea = 'ls1'),
    'SITE-001',
  ],
  [
    'equipment-installed',
    (f) =>
      void Object.assign(find(f.sites, 'SITE-002').equipment[0] ?? {}, { installedYear: 2031 }),
    'SITE-002',
  ],
  ['callout-values', (f) => void (find(f.callOuts, 'CO-0002').rating = 6), 'CO-0002'],
  [
    'partner-referrals',
    (f) => void (find(f.partners, 'PTN-001').convertedReferrals = 5),
    'PTN-001',
  ],
  [
    'onboarding-future',
    (f) => void (find(f.onboarding, 'ONB-001').lastActiveAt = ago(-3)),
    'ONB-001',
  ],
  [
    'site-duplicate',
    (f) => {
      const copy = { ...find(f.sites, 'SITE-001'), id: 'SITE-009' }
      find(f.customers, 'CUS-001').sites.push(copy)
      f.sites.push(copy)
    },
    'SITE-009',
  ],
  [
    'customer-duplicate',
    (f) =>
      void f.customers.push({
        ...find(f.customers, 'CUS-002'),
        id: 'CUS-009',
        name: 'beta  logistics',
      }),
    'CUS-009',
  ],
  [
    'responder-duplicate',
    (f) => void f.responders.push({ ...find(f.responders, 'RSP-001'), id: 'RSP-009' }),
    'RSP-009',
  ],
  [
    'callout-duplicate',
    (f) => void f.callOuts.push({ ...find(f.callOuts, 'CO-0001'), id: 'CO-0009' }),
    'CO-0009',
  ],
  [
    'onboarding-duplicate',
    (f) => void f.onboarding.push({ ...find(f.onboarding, 'ONB-003'), id: 'ONB-009' }),
    'ONB-009',
  ],
  ['callout-site', (f) => void (find(f.callOuts, 'CO-0002').siteId = 'SITE-404'), 'CO-0002'],
  // SITE-003 belongs to the other customer
  ['callout-parties', (f) => void (find(f.callOuts, 'CO-0001').siteId = 'SITE-003'), 'CO-0001'],
  [
    'callout-time-order',
    (f) => {
      const c = find(f.callOuts, 'CO-0001')
      c.resolvedAt = c.arrivedAt - 10 * MINUTE_MS
    },
    'CO-0001',
  ],
  // CO-0002 was on a Saturday
  [
    'callout-responder-eligible',
    (f) =>
      void (find(f.responders, 'RSP-002').availability = {
        weekends: false,
        overnight: false,
        onCallEngineers: 2,
      }),
    'CO-0002',
  ],
  [
    'callout-membership',
    (f) => void (find(f.onboarding, 'ONB-001').churnedAt = ago(40)),
    'CO-0001',
  ],
  ['lead-partner', (f) => void (find(f.leads, 'LEAD-002').partnerId = 'PTN-404'), 'LEAD-002'],
  [
    'lead-contact-dates',
    (f) => void (find(f.leads, 'LEAD-001').lastContactAt = ago(2)),
    'LEAD-001',
  ],
  ['onboarding-stage', (f) => void (find(f.onboarding, 'ONB-002').stage = 'signed'), 'ONB-002'],
  [
    'onboarding-date-order',
    (f) => void (find(f.onboarding, 'ONB-002').entered.engaged = ago(320)),
    'ONB-002',
  ],
  [
    'onboarding-checklist-complete',
    (f) => void Object.assign(find(f.onboarding, 'ONB-004').checklist[2] ?? {}, { doneAt: null }),
    'ONB-004',
  ],
  [
    'onboarding-go-live',
    (f) => void (find(f.onboarding, 'ONB-005').entered.onboarded = ago(195)),
    'ONB-005',
  ],
  [
    'responder-on-call-after-lapse',
    (f) => {
      find(f.responders, 'RSP-002').insuranceExpiry = ago(10)
      find(f.onboarding, 'ONB-004').lastActiveAt = ago(2)
    },
    'RSP-002',
  ],
  [
    'onboarding-stale',
    (f) => {
      const r = find(f.onboarding, 'ONB-007')
      r.entered = { aware: ago(300), engaged: ago(280), signed: ago(250), onboarded: null }
      r.checklist = r.checklist.map((e) => ({ ...e, doneAt: e.doneAt === null ? null : ago(240) }))
    },
    'ONB-007',
  ],
]

describe('the rules', () => {
  it('have unique IDs and cover every dimension and dataset', () => {
    const ids = RULES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const d of DIMENSIONS) expect(RULES.some((r) => r.dimension === d)).toBe(true)
    for (const ds of DATASETS) expect(RULES.some((r) => r.dataset === ds)).toBe(true)
  })

  it('name a real rule for every kind of planted issue', () => {
    const ids = RULES.map((r) => r.id)
    for (const ruleId of Object.values(PLANTED_ISSUE_RULES)) expect(ids).toContain(ruleId)
  })

  it('raise nothing on clean records', () => {
    const report = run(fixture())
    expect(report.issues).toEqual([])
    expect(report.overall.score).toBe(1)
    expect(report.results.every((r) => r.checked > 0)).toBe(true)
  })

  it('each have a test that breaks them', () => {
    expect(BREAKS.map(([id]) => id).sort()).toEqual(RULES.map((r) => r.id).sort())
  })

  it.each(BREAKS)('%s flags exactly the broken record', (ruleId, breakIt, recordId) => {
    const data = fixture()
    breakIt(data)
    const flagged = run(data).issues.filter((i) => i.ruleId === ruleId)
    expect(flagged.map((i) => i.recordId)).toEqual([recordId])
    const [issue] = flagged
    expect(issue?.problem).toMatch(/\.$/)
    expect(issue?.fix.length).toBeGreaterThan(20)
  })
})

describe('what the rules say', () => {
  const problem = (ruleId: string, breakIt: (f: Fixture) => void) => {
    const data = fixture()
    breakIt(data)
    return run(data).issues.find((i) => i.ruleId === ruleId)
  }

  it('names the original of a duplicate', () => {
    const issue = problem('site-duplicate', (f) => {
      const copy = { ...find(f.sites, 'SITE-001'), id: 'SITE-009' }
      f.sites.push(copy)
    })
    expect(issue).toMatchObject({
      relatedId: 'SITE-001',
      record: 'Leeds Hospital (Alpha Hospitals)',
      problem: 'Same customer, name and location as SITE-001.',
      severity: 'medium',
      dimension: 'uniqueness',
      dataset: 'sites',
    })
  })

  it('says which times are out of order', () => {
    const issue = problem('callout-time-order', (f) => {
      const c = find(f.callOuts, 'CO-0001')
      c.resolvedAt = c.arrivedAt - 10 * MINUTE_MS
    })
    expect(issue?.problem).toBe(
      'Resolution at 14 Sept 2026, 12:40 is before arrival at 14 Sept 2026, 12:50.',
    )
  })

  it('names the paperwork that lapsed and how long ago', () => {
    const issue = problem('responder-on-call-after-lapse', (f) => {
      find(f.responders, 'RSP-002').insuranceExpiry = ago(10)
      find(f.onboarding, 'ONB-004').lastActiveAt = ago(2)
    })
    expect(issue?.problem).toBe(
      'On call on 12 Oct 2026, 8 days after its insurance expired on 4 Oct 2026.',
    )
    expect(issue?.fix).toBe(
      'Take Responder RSP-002 off the on-call rota until the renewed insurance is uploaded.',
    )
  })

  it('tells a stale stage from the dates it should match', () => {
    const issue = problem(
      'onboarding-stage',
      (f) => void (find(f.onboarding, 'ONB-002').stage = 'signed'),
    )
    expect(issue?.problem).toBe('Stage says Signed, but its dates show Onboarded on 18 Dec 2025.')
  })

  it('reports a missing earlier stage date', () => {
    const issue = problem(
      'onboarding-stage',
      (f) => void (find(f.onboarding, 'ONB-002').entered.engaged = null),
    )
    expect(issue?.problem).toBe('Has a date for Onboarded but none for Demo / engaged.')
  })
})

describe('scores', () => {
  it('round down, so imperfect never shows as 100%', () => {
    expect(qualityScore(0, 0)).toBeNull()
    expect(qualityScore(10, 0)).toBe(1)
    expect(qualityScore(2000, 1)).toBe(0.999)
    expect(qualityScore(10_000, 1)).toBe(0.999)
    expect(qualityScore(3, 1)).toBe(0.666)
    expect(() => qualityScore(3, 4)).toThrow(RangeError)
    expect(() => qualityScore(3, -1)).toThrow(RangeError)
  })

  it('add up by dimension, dataset and both', () => {
    const data = fixture()
    find(data.sites, 'SITE-002').postcodeArea = null
    find(data.callOuts, 'CO-0002').siteId = 'SITE-404'
    const report = run(data)
    expect(report.overall.failed).toBe(2)
    expect(report.byDimension.completeness.failed).toBe(1)
    expect(report.byDimension.consistency.failed).toBe(1)
    expect(report.byDimension.validity.failed).toBe(0)
    expect(report.byDataset.sites).toMatchObject({ records: 3, failed: 1 })
    expect(report.matrix.sites.completeness.score).toBeLessThan(1)
    expect(report.matrix.partners.completeness).toMatchObject({ rules: 0, score: null })
    const checks = DIMENSIONS.reduce((sum, d) => sum + report.byDimension[d].checks, 0)
    expect(checks).toBe(report.overall.checks)
  })

  it('list the most serious issues first', () => {
    const data = fixture()
    find(data.sites, 'SITE-002').postcodeArea = null
    find(data.callOuts, 'CO-0002').siteId = 'SITE-404'
    find(data.onboarding, 'ONB-002').stage = 'signed'
    expect(run(data).issues.map((i) => i.severity)).toEqual(['high', 'medium', 'low'])
  })
})

describe('answer key and export', () => {
  const data = fixture()
  find(data.sites, 'SITE-002').postcodeArea = null
  find(data.leads, 'LEAD-002').partnerId = 'PTN-404'
  const { issues } = run(data)

  it('sorts issues into planted and found, planted and missed, and unexpected', () => {
    const result = checkAnswerKey(issues, [
      { kind: 'missing-postcode', recordId: 'SITE-002' },
      { kind: 'duplicate-site', recordId: 'SITE-003' },
    ])
    expect(result.found.map((p) => p.recordId)).toEqual(['SITE-002'])
    expect(result.missed.map((p) => p.kind)).toEqual(['duplicate-site'])
    expect(result.unexpected.map((i) => i.ruleId)).toEqual(['lead-partner'])
  })

  it('filters issues by severity, dimension and dataset', () => {
    expect(filterIssues(issues, NO_ISSUE_FILTERS)).toHaveLength(2)
    expect(
      filterIssues(issues, { ...NO_ISSUE_FILTERS, dimension: 'consistency' }).map(
        (i) => i.recordId,
      ),
    ).toEqual(['LEAD-002'])
    expect(
      filterIssues(issues, { severity: 'medium', dimension: 'completeness', dataset: 'sites' }),
    ).toHaveLength(1)
    expect(filterIssues(issues, { ...NO_ISSUE_FILTERS, severity: 'high' })).toEqual([])
  })

  it('exports every issue with its rule and suggested fix', () => {
    const lines = issuesTable(issues).split('\r\n')
    expect(lines[0]).toBe(
      'Severity,Dimension,Dataset,Record ID,Record,Rule,Problem,Suggested fix,Related ID',
    )
    expect(lines[1]).toMatch(
      /^Medium,Completeness,Sites,SITE-002,Sheffield Hospital \(Alpha Hospitals\),Every site has a postcode,No postcode on file\.,/,
    )
    expect(lines).toHaveLength(issues.length + 2)
  })
})
