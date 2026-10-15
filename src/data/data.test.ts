import { describe, expect, it } from 'vitest'
import { haversineKm } from '@/lib/geo'
import { DAY_MS, isOvernight, isWeekend, MINUTE_MS } from '@/lib/time'
import type { CallOut, SectorId } from '@/types'
import { SECTOR_PROFILES } from './customers'
import { generateDatasets } from './generate'
import {
  callOuts,
  customers,
  DATA_AS_OF,
  getTown,
  leads,
  partners,
  responders,
  SECTORS,
  SEEDED_ISSUES,
  sites,
  suppliers,
  TOWNS,
} from './index'
import { applySeededIssues } from './issues'
import { STAGE_COUNTS } from './leads'
import { COMPLIANCE_GROUPS } from './responders'

const iso = (timestamp: number) => new Date(timestamp).toISOString()
const totalCost = ({ cost }: CallOut) =>
  cost.callOutFee + cost.labour + cost.parts + cost.generatorHire
const countBy = <T, K extends string>(items: readonly T[], key: (item: T) => K) => {
  const counts: Partial<Record<K, number>> = {}
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1
  return counts
}
const expectUnique = (ids: readonly string[]) => expect(new Set(ids).size).toBe(ids.length)

const siteIds = new Set(sites.map((s) => s.id))
const orphan = SEEDED_ISSUES.find((issue) => issue.kind === 'orphaned-call-out')

describe('dataset sizes', () => {
  it('locks the size of every dataset', () => {
    expect({
      towns: TOWNS.length,
      customers: customers.length,
      sites: sites.length,
      responders: responders.length,
      suppliers: suppliers.length,
      partners: partners.length,
      callOuts: callOuts.length,
      leads: leads.length,
      seededIssues: SEEDED_ISSUES.length,
    }).toEqual({
      towns: 45,
      customers: 60,
      sites: 194,
      responders: 35,
      suppliers: 15,
      partners: 12,
      callOuts: 400,
      leads: 40,
      seededIssues: 4,
    })
  })

  it('spreads towns across England, Scotland and Wales', () => {
    expect(countBy(TOWNS, (t) => t.nation)).toEqual({ England: 32, Scotland: 8, Wales: 5 })
  })

  it('covers all nine sectors with the planned number of customers', () => {
    expect(SECTORS).toHaveLength(9)
    const planned = Object.fromEntries(
      SECTORS.map((s) => [s.id, SECTOR_PROFILES[s.id as SectorId].customers]),
    )
    expect(countBy(customers, (c) => c.sector)).toEqual(planned)
  })

  it('matches the planned mix of leads, partners and suppliers', () => {
    expect(countBy(leads, (l) => l.stage)).toEqual(STAGE_COUNTS)
    expect(countBy(partners, (p) => p.kind)).toEqual({
      'facilities-management': 3,
      'icp-idno': 3,
      insurer: 2,
      consultant: 2,
      'trade-body': 2,
    })
    expect(countBy(suppliers, (s) => s.category)).toEqual({
      transformers: 3,
      switchgear: 3,
      'generator-hire': 3,
      'cable-jointing': 3,
      fuel: 3,
    })
  })
})

describe('sample values', () => {
  it('pins the reference date', () => {
    expect(iso(DATA_AS_OF)).toBe('2026-10-14T08:00:00.000Z')
  })

  it('pins the first customer and site', () => {
    expect(customers[0]).toMatchObject({
      id: 'CUS-001',
      name: 'Fennelby Data Centres',
      sector: 'telecoms',
      headOffice: 'Leeds',
    })
    expect(customers[0]?.sites.map((s) => s.id)).toEqual(['SITE-001', 'SITE-002'])
    expect(sites[0]).toMatchObject({
      id: 'SITE-001',
      name: 'Leeds Data Centre',
      lat: 53.8417,
      lng: -1.6661,
      postcodeArea: 'LS',
      criticality: 4,
    })
    expect(sites[0]?.equipment).toHaveLength(8)
    expect(sites[0]?.contacts[0]).toEqual({
      name: 'Nathan Brennan',
      role: 'Data centre manager',
      phone: '07700 900572',
    })
  })

  it('pins the first responder, supplier, partner and lead', () => {
    expect(responders[0]).toMatchObject({
      id: 'RSP-001',
      name: 'Claythwaite Power Engineering',
      town: 'Canterbury',
      rating: 3.8,
      rates: { callOutFee: 455, hourlyRate: 75, outOfHoursMultiplier: 1.75 },
    })
    expect(suppliers[0]).toMatchObject({
      id: 'SUP-001',
      name: 'Knottwick Transformers',
      town: 'Stoke-on-Trent',
    })
    expect(partners[0]).toMatchObject({
      id: 'PTN-001',
      name: 'Maplehythe Facilities Management',
      referrals: 7,
    })
    expect(leads[0]).toMatchObject({
      id: 'LEAD-001',
      organisation: 'Dogwoodholt Farms',
      stage: 'proposal',
      source: 'outbound',
      estimatedSites: 3,
    })
  })

  it('pins the first and last call-outs', () => {
    const first = callOuts[0] as CallOut
    expect(first).toMatchObject({
      id: 'CO-0001',
      siteId: 'SITE-096',
      responderId: 'RSP-025',
      faultType: 'cable',
      distanceMiles: 41.7,
      cost: { callOutFee: 420, labour: 1696, parts: 2516.51, generatorHire: 1450 },
      rating: 4,
    })
    expect(
      [first.requestedAt, first.acceptedAt, first.arrivedAt, first.resolvedAt].map(iso),
    ).toEqual([
      '2025-10-14T19:50:00.000Z',
      '2025-10-14T19:56:00.000Z',
      '2025-10-14T21:34:00.000Z',
      '2025-10-15T05:09:00.000Z',
    ])
    expect(callOuts.at(-1)?.id).toBe('CO-0400')
    expect(iso(callOuts.at(-1)?.requestedAt ?? 0)).toBe('2026-10-12T12:56:00.000Z')
  })

  it('pins whole-dataset fingerprints', () => {
    const spend = callOuts.reduce((sum, c) => sum + totalCost(c), 0)
    expect(Math.round(spend * 100) / 100).toBe(1_367_179.39)
    expect(sites.reduce((n, s) => n + s.equipment.length, 0)).toBe(878)
    expect(callOuts.filter((c) => c.arrivedAt - c.requestedAt <= 75 * MINUTE_MS)).toHaveLength(283)
  })
})

describe('generation', () => {
  it('is deterministic', () => {
    expect(generateDatasets(DATA_AS_OF)).toEqual(generateDatasets(DATA_AS_OF))
  })

  it('exports exactly the generated data with the seeded issues applied', () => {
    const data = applySeededIssues(generateDatasets(DATA_AS_OF), SEEDED_ISSUES)
    expect(customers).toEqual(data.customers)
    expect(responders).toEqual(data.responders)
    expect(callOuts).toEqual(data.callOuts)
  })

  it('uses unique IDs and organisation names', () => {
    for (const ids of [
      customers.map((c) => c.id),
      sites.map((s) => s.id),
      sites.flatMap((s) => s.equipment.map((e) => e.id)),
      responders.map((r) => r.id),
      suppliers.map((s) => s.id),
      partners.map((p) => p.id),
      callOuts.map((c) => c.id),
      leads.map((l) => l.id),
    ]) {
      expectUnique(ids)
    }
    expectUnique([
      ...customers.map((c) => c.name),
      ...responders.map((r) => r.name),
      ...suppliers.map((s) => s.name),
      ...partners.map((p) => p.name),
      ...leads.map((l) => l.organisation),
    ])
  })

  it('only uses fictional phone numbers', () => {
    const phones = [
      ...sites.flatMap((s) => s.contacts.map((c) => c.phone)),
      ...[...responders, ...suppliers, ...partners, ...leads].map((x) => x.contact.phone),
    ]
    for (const phone of phones) expect(phone).toMatch(/^07700 900\d{3}$/)
  })
})

describe('customers and sites', () => {
  it('gives every customer one to six sites', () => {
    for (const customer of customers) {
      expect(customer.sites.length).toBeGreaterThanOrEqual(1)
      expect(customer.sites.length).toBeLessThanOrEqual(6)
      for (const site of customer.sites) expect(site.customerId).toBe(customer.id)
    }
  })

  it('places every site near its anchor town', () => {
    for (const site of sites) {
      const town = getTown(site.town)
      expect(site.region).toBe(town.region)
      expect(haversineKm(site, town)).toBeLessThanOrEqual(town.spreadKm + 0.05)
    }
  })

  it('keeps sites on the landward side of coastal towns', () => {
    for (const site of sites) {
      const town = getTown(site.town)
      if (!town.landBearings) continue
      const [from, to] = town.landBearings
      // Initial bearing from the town centre to the site
      const rad = Math.PI / 180
      const y = Math.sin((site.lng - town.lng) * rad) * Math.cos(site.lat * rad)
      const x =
        Math.cos(town.lat * rad) * Math.sin(site.lat * rad) -
        Math.sin(town.lat * rad) * Math.cos(site.lat * rad) * Math.cos((site.lng - town.lng) * rad)
      const bearing = (Math.atan2(y, x) / rad + 360) % 360
      const offset = (bearing - from + 360) % 360
      // A degree of slack for rounding coordinates to 4 decimal places
      expect(offset).toBeLessThanOrEqual(((to - from + 360) % 360) + 1)
    }
  })

  it('gives every site an 11 kV RMU, a rated transformer and two contacts', () => {
    for (const site of sites) {
      expect(site.criticality).toBeGreaterThanOrEqual(1)
      expect(site.criticality).toBeLessThanOrEqual(5)
      expect(site.equipment.some((e) => e.kind === 'rmu' && e.voltageKv === 11)).toBe(true)
      expect(site.equipment.some((e) => e.kind === 'transformer' && e.ratingKva > 0)).toBe(true)
      expect(site.contacts).toHaveLength(2)
    }
  })

  it('has standby generators at every hospital and data centre site', () => {
    const critical = customers.filter((c) => c.sector === 'medical' || c.sector === 'telecoms')
    for (const site of critical.flatMap((c) => c.sites)) {
      expect(site.equipment.some((e) => e.kind === 'generator')).toBe(true)
    }
  })
})

describe('responders', () => {
  const inDays = (timestamp: number) => (timestamp - DATA_AS_OF) / DAY_MS

  it('includes expired and soon-to-expire authorisations', () => {
    const expiries = responders.flatMap((r) =>
      r.authorisationExpiry === null ? [] : [r.authorisationExpiry],
    )
    expect(expiries.filter((t) => inDays(t) < 0)).toHaveLength(
      COMPLIANCE_GROUPS.authorisationExpired,
    )
    expect(expiries.filter((t) => inDays(t) >= 0 && inDays(t) <= 90)).toHaveLength(
      COMPLIANCE_GROUPS.authorisationDueSoon,
    )
  })

  it('includes expired and soon-to-expire insurance, and overdue audits', () => {
    const insurance = responders.map((r) => inDays(r.insuranceExpiry))
    expect(insurance.filter((d) => d < 0)).toHaveLength(COMPLIANCE_GROUPS.insuranceExpired)
    expect(insurance.filter((d) => d >= 0 && d <= 90)).toHaveLength(
      COMPLIANCE_GROUPS.insuranceDueSoon,
    )
    expect(responders.filter((r) => inDays(r.lastAuditAt) < -365)).toHaveLength(
      COMPLIANCE_GROUPS.auditOverdue,
    )
  })

  it('has sensible ratings, rates and cover', () => {
    for (const r of responders) {
      expect(r.rating).toBeGreaterThanOrEqual(1)
      expect(r.rating).toBeLessThanOrEqual(5)
      expect(r.rates.callOutFee).toBeGreaterThan(0)
      expect(r.rates.outOfHoursMultiplier).toBeGreaterThanOrEqual(1)
      expect(r.availability.onCallEngineers).toBeLessThanOrEqual(r.engineers)
      if (r.availability.overnight) expect(r.availability.weekends).toBe(true)
    }
    const overnight = responders.filter((r) => r.availability.overnight).length
    expect(overnight).toBeGreaterThan(0)
    expect(overnight).toBeLessThan(responders.length)
  })

  it('leaves the deliberate coverage gaps without a base', () => {
    const bases = new Set(responders.map((r) => r.town))
    for (const town of [
      'Truro',
      'Aberystwyth',
      'Bangor',
      'Carlisle',
      'Dumfries',
      'Inverness',
      'Fort William',
    ]) {
      expect(bases.has(town)).toBe(false)
    }
  })
})

describe('call-outs', () => {
  const responderById = new Map(responders.map((r) => [r.id, r]))
  const siteById = new Map(sites.map((s) => [s.id, s]))

  it('fall within the 12 months to the reference date, in order', () => {
    for (const c of callOuts) {
      expect(c.requestedAt).toBeGreaterThanOrEqual(DATA_AS_OF - 365 * DAY_MS)
      expect(c.acceptedAt).toBeGreaterThanOrEqual(c.requestedAt)
      expect(c.arrivedAt).toBeGreaterThan(c.acceptedAt)
      expect(c.resolvedAt).toBeGreaterThan(c.arrivedAt)
      expect(c.resolvedAt).toBeLessThanOrEqual(DATA_AS_OF)
    }
    const times = callOuts.map((c) => c.requestedAt)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })

  it('peak in winter', () => {
    const month = (c: CallOut) => new Date(c.requestedAt).getUTCMonth()
    const winter = callOuts.filter((c) => [11, 0, 1].includes(month(c))).length
    const summer = callOuts.filter((c) => [5, 6, 7].includes(month(c))).length
    expect(winter).toBeGreaterThan(summer * 2)
  })

  it('include some overnight jobs, all taken by responders with overnight cover', () => {
    const overnight = callOuts.filter((c) => isOvernight(c.requestedAt))
    expect(overnight.length / callOuts.length).toBeGreaterThan(0.1)
    for (const c of overnight)
      expect(responderById.get(c.responderId)?.availability.overnight).toBe(true)
    for (const c of callOuts.filter((c) => isWeekend(c.requestedAt))) {
      expect(responderById.get(c.responderId)?.availability.weekends).toBe(true)
    }
  })

  it('only go to responders who had joined and were authorised and insured at the time', () => {
    for (const c of callOuts) {
      const r = responderById.get(c.responderId)
      expect(r).toBeDefined()
      if (!r) continue
      expect(r.joinedAt).toBeLessThanOrEqual(c.requestedAt)
      expect(r.insuranceExpiry).toBeGreaterThan(c.requestedAt)
      if (r.authorisationExpiry !== null)
        expect(r.authorisationExpiry).toBeGreaterThan(c.requestedAt)
    }
  })

  it('point at real sites of the right customer, except the seeded orphan', () => {
    for (const c of callOuts) {
      if (c.id === orphan?.recordId) continue
      expect(siteById.get(c.siteId)?.customerId).toBe(c.customerId)
      expect(customers.find((cu) => cu.id === c.customerId)?.joinedAt).toBeLessThanOrEqual(
        c.requestedAt,
      )
    }
  })

  it('have non-negative costs and whole-star ratings', () => {
    for (const c of callOuts) {
      expect(Object.values(c.cost).every((v) => v >= 0)).toBe(true)
      expect(totalCost(c)).toBeGreaterThan(0)
      expect([1, 2, 3, 4, 5]).toContain(c.rating)
    }
  })
})

describe('leads and partners', () => {
  it('link partner referrals to real partners within their open referrals', () => {
    const referred = countBy(
      leads.filter((l) => l.source === 'partner-referral'),
      (l) => l.partnerId ?? 'missing',
    )
    expect(referred.missing).toBeUndefined()
    for (const p of partners) {
      expect(p.convertedReferrals).toBeLessThanOrEqual(p.referrals)
      expect(referred[p.id] ?? 0).toBeLessThanOrEqual(p.referrals - p.convertedReferrals)
    }
    for (const l of leads) if (l.source !== 'partner-referral') expect(l.partnerId).toBeNull()
  })

  it('only record contact once a lead is off the wait-list', () => {
    for (const l of leads) {
      if (l.stage === 'wait-list') {
        expect(l.lastContactAt).toBeNull()
      } else {
        expect(l.lastContactAt).not.toBeNull()
        expect(l.lastContactAt ?? 0).toBeGreaterThanOrEqual(l.createdAt)
        expect(l.lastContactAt ?? 0).toBeLessThanOrEqual(DATA_AS_OF)
      }
    }
  })
})

describe('seeded data-quality issues', () => {
  it('lists one issue of each kind', () => {
    expect(SEEDED_ISSUES.map((i) => i.kind)).toEqual([
      'duplicate-site',
      'missing-postcode',
      'missing-authorisation-expiry',
      'orphaned-call-out',
    ])
  })

  it('plants a duplicate site, and it is the only one', () => {
    const issue = SEEDED_ISSUES[0]
    const copy = sites.find((s) => s.id === issue?.recordId)
    const original = sites.find((s) => s.id === issue?.relatedId)
    expect(copy).toBeDefined()
    expect(copy).toMatchObject({
      customerId: original?.customerId,
      name: original?.name,
      lat: original?.lat,
      lng: original?.lng,
      postcodeArea: original?.postcodeArea,
    })
    const keys = sites.map((s) => `${s.customerId}|${s.name}|${s.lat}|${s.lng}`)
    expect(keys.length - new Set(keys).size).toBe(1)
  })

  it('plants a missing postcode, and it is the only one', () => {
    expect(sites.filter((s) => s.postcodeArea === null).map((s) => s.id)).toEqual([
      SEEDED_ISSUES[1]?.recordId,
    ])
  })

  it('plants a missing authorisation expiry, and it is the only one', () => {
    expect(responders.filter((r) => r.authorisationExpiry === null).map((r) => r.id)).toEqual([
      SEEDED_ISSUES[2]?.recordId,
    ])
  })

  it('plants a call-out for a deleted site, and it is the only one', () => {
    expect(orphan?.relatedId).toBeDefined()
    expect(siteIds.has(orphan?.relatedId ?? '')).toBe(false)
    expect(callOuts.filter((c) => !siteIds.has(c.siteId)).map((c) => c.id)).toEqual([
      orphan?.recordId,
    ])
  })

  it('refuses to plant issues that no longer fit the data', () => {
    const fresh = () => generateDatasets(DATA_AS_OF)
    const base = { dataset: 'sites' as const, relatedId: null, description: '' }
    expect(() =>
      applySeededIssues(fresh(), [{ ...base, kind: 'missing-postcode', recordId: 'SITE-999' }]),
    ).toThrow()
    expect(() =>
      applySeededIssues(fresh(), [
        { ...base, kind: 'duplicate-site', recordId: 'SITE-001', relatedId: 'SITE-002' },
      ]),
    ).toThrow(/already in use/)
    expect(() =>
      applySeededIssues(fresh(), [
        {
          ...base,
          dataset: 'callOuts',
          kind: 'orphaned-call-out',
          recordId: 'CO-0001',
          relatedId: 'SITE-001',
        },
      ]),
    ).toThrow(/orphan/)
  })
})
