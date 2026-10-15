import { describe, expect, it } from 'vitest'
import { eligibleWindow } from '@/lib/matching'
import { biggestLeak, buildFunnel, CHECKLISTS, isActive, onboardingQueue } from '@/lib/onboarding'
import { SIDES } from '@/lib/scenario'
import { DAY_MS } from '@/lib/time'
import type { OnboardingRecord, SeededOnboardingIssue, SideId } from '@/types'
import { generateDatasets, generateOnboardingRecords } from './generate'
import {
  callOuts,
  customers,
  DATA_AS_OF,
  leads,
  onboarding,
  partners,
  responders,
  SEEDED_ISSUES,
  SEEDED_ONBOARDING_ISSUES,
  sites,
  suppliers,
} from './index'
import { applyOnboardingIssues, applySeededIssues } from './issues'
import { ONBOARDING_PLANS } from './onboarding'
import { SCENARIOS } from './scenarios'

const iso = (timestamp: number | null) =>
  timestamp === null ? null : new Date(timestamp).toISOString()
const countBy = <T>(items: readonly T[], key: (item: T) => string) => {
  const counts: Record<string, number> = {}
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1
  return counts
}
const live = (side?: SideId) =>
  onboarding.filter((r) => r.entered.onboarded !== null && (side === undefined || r.side === side))
const planted = (kind: SeededOnboardingIssue['kind']) =>
  SEEDED_ONBOARDING_ISSUES.filter((i) => i.kind === kind).map((i) => i.recordId)
const lastCallOut = (key: 'customerId' | 'responderId', id: string) =>
  Math.max(-Infinity, ...callOuts.filter((c) => c[key] === id).map((c) => c.requestedAt))

describe('onboarding dataset', () => {
  it('locks its size, by side and by stage', () => {
    expect(onboarding).toHaveLength(238)
    expect(countBy(onboarding, (r) => r.side)).toEqual({
      customer: 110,
      responder: 71,
      supplier: 34,
      partner: 23,
    })
    expect(countBy(onboarding, (r) => r.stage)).toEqual({
      aware: 46,
      engaged: 36,
      // Includes the live supplier whose stage is planted a step behind
      signed: 35,
      onboarded: 121,
    })
  })

  it('pins the first record and whole-dataset fingerprints', () => {
    const [first] = onboarding
    expect(first).toMatchObject({ id: 'ONB-001', side: 'customer', orgId: 'CUS-001' })
    expect(first?.name).toBe(customers[0]?.name)
    expect(Object.values(first?.entered ?? {}).map(iso)).toEqual([
      '2025-07-19T00:00:00.000Z',
      '2025-08-02T00:00:00.000Z',
      '2025-10-16T00:00:00.000Z',
      '2025-11-06T00:00:00.000Z',
    ])
    expect([first?.lastActiveAt ?? null, first?.churnedAt ?? null].map(iso)).toEqual([
      '2026-03-20T00:00:00.000Z',
      '2026-03-21T00:00:00.000Z',
    ])
    expect(onboarding.filter((r) => isActive(r, DATA_AS_OF))).toHaveLength(98)
    // Nine customers that cancelled and 29 prospects lost along the way
    expect(onboarding.filter((r) => r.churnedAt !== null)).toHaveLength(38)
  })

  it('is deterministic, and is the generated records with the planted issues applied', () => {
    const data = applySeededIssues(generateDatasets(DATA_AS_OF), SEEDED_ISSUES)
    const records = generateOnboardingRecords(data, DATA_AS_OF)
    expect(generateOnboardingRecords(data, DATA_AS_OF)).toEqual(records)
    expect(onboarding).toEqual(applyOnboardingIssues(records, SEEDED_ONBOARDING_ISSUES))
  })

  it('reads the other datasets without changing them', () => {
    const data = generateDatasets(DATA_AS_OF)
    const before = structuredClone(data)
    generateOnboardingRecords(data, DATA_AS_OF)
    expect(data).toEqual(before)
  })

  it('uses unique record IDs, one record per organisation and unique names throughout', () => {
    expect(new Set(onboarding.map((r) => r.id)).size).toBe(onboarding.length)
    expect(new Set(onboarding.map((r) => r.orgId)).size).toBe(onboarding.length)
    const others = [
      ...customers.map((c) => c.name),
      ...responders.map((r) => r.name),
      ...suppliers.map((s) => s.name),
      ...partners.map((p) => p.name),
      ...leads.map((l) => l.organisation),
    ]
    const known = new Set(others)
    const newNames = onboarding.filter((r) => !known.has(r.name)).map((r) => r.name)
    expect(new Set([...others, ...newNames]).size).toBe(others.length + newNames.length)
  })

  it('gives every record the checklist for its side, in order', () => {
    for (const r of onboarding) {
      expect(r.checklist.map((e) => e.item)).toEqual(CHECKLISTS[r.side].map((i) => i.id))
    }
  })
})

describe('live organisations', () => {
  const datasets: [SideId, readonly { id: string; name: string }[], (id: string) => number][] = [
    ['customer', customers, (id) => customers.find((c) => c.id === id)?.joinedAt ?? 0],
    ['responder', responders, (id) => responders.find((r) => r.id === id)?.joinedAt ?? 0],
    ['supplier', suppliers, (id) => suppliers.find((s) => s.id === id)?.joinedAt ?? 0],
    ['partner', partners, (id) => partners.find((p) => p.id === id)?.since ?? 0],
  ]

  it.each(datasets)(
    'each %s went live on the day it joined, and nobody else is live',
    (side, rows, joined) => {
      expect(
        live(side)
          .map((r) => r.orgId)
          .sort(),
      ).toEqual(rows.map((r) => r.id).sort())
      for (const r of live(side)) {
        expect(r.entered.onboarded).toBe(joined(r.orgId))
        expect(r.name).toBe(rows.find((row) => row.id === r.orgId)?.name)
      }
    },
  )

  it('passed each stage in order and finished the checklist between signing and going live', () => {
    for (const r of live()) {
      const { aware, engaged, signed, onboarded } = r.entered
      expect([aware, engaged, signed, onboarded].every((d) => d !== null)).toBe(true)
      expect(aware ?? 0).toBeLessThan(engaged ?? 0)
      expect(engaged ?? 0).toBeLessThan(signed ?? 0)
      expect(signed ?? 0).toBeLessThan(onboarded ?? 0)
      for (const { doneAt } of r.checklist) {
        if (doneAt === null) {
          expect(planted('live-with-open-item')).toContain(r.id)
          continue
        }
        expect(doneAt).toBeGreaterThanOrEqual(signed ?? 0)
        expect(doneAt).toBeLessThanOrEqual(onboarded ?? 0)
      }
    }
  })

  it('were active after their last call-out, and only customers cancel', () => {
    for (const r of live()) {
      expect(r.lastActiveAt).not.toBeNull()
      expect(r.lastActiveAt ?? 0).toBeGreaterThanOrEqual(r.entered.onboarded ?? 0)
      if (r.side !== 'customer') expect(r.churnedAt).toBeNull()
      if (r.side === 'customer' || r.side === 'responder') {
        const last = lastCallOut(r.side === 'customer' ? 'customerId' : 'responderId', r.orgId)
        if (last > -Infinity)
          expect(r.lastActiveAt ?? 0).toBeGreaterThanOrEqual(last - (last % DAY_MS))
      }
    }
  })

  it('only cancelled after their last call-out and at least 60 days in', () => {
    const cancelled = live('customer').filter((r) => r.churnedAt !== null)
    expect(cancelled).toHaveLength(ONBOARDING_PLANS.customer.churned)
    for (const r of cancelled) {
      expect(r.churnedAt ?? 0).toBeGreaterThan(lastCallOut('customerId', r.orgId))
      expect(r.churnedAt ?? 0).toBeGreaterThanOrEqual((r.entered.onboarded ?? 0) + 60 * DAY_MS)
      expect(r.lastActiveAt ?? 0).toBeLessThanOrEqual(r.churnedAt ?? 0)
    }
  })

  it('keep the customers in the simulator scenarios as active members', () => {
    for (const spec of SCENARIOS) {
      const customerId = sites.find((s) => s.id === spec.siteId)?.customerId
      const record = onboarding.find((r) => r.orgId === customerId)
      expect(record?.churnedAt).toBeNull()
      expect(record && isActive(record, DATA_AS_OF)).toBe(true)
    }
  })

  it('take responders off the rota when their paperwork lapses, bar the planted one', () => {
    let lapsed = 0
    for (const responder of responders) {
      const window = eligibleWindow(responder)
      if (window === null || window.until > DATA_AS_OF) continue
      lapsed++
      const record = onboarding.find((r) => r.orgId === responder.id)
      if (planted('on-call-after-lapse').includes(responder.id)) {
        expect(record?.lastActiveAt ?? 0).toBeGreaterThanOrEqual(window.until)
      } else {
        expect(record?.lastActiveAt ?? Infinity).toBeLessThan(window.until)
      }
    }
    expect(lapsed).toBe(5)
  })

  it('show partners that referred someone this year as active this year', () => {
    for (const p of partners.filter((p) => p.referrals > 0)) {
      const record = onboarding.find((r) => r.orgId === p.id)
      expect(record?.lastActiveAt ?? 0).toBeGreaterThanOrEqual(DATA_AS_OF - 365 * DAY_MS)
    }
  })
})

describe('prospects', () => {
  it('are the leads, on the customer side', () => {
    for (const lead of leads) {
      const r = onboarding.find((o) => o.orgId === lead.id) as OnboardingRecord
      expect(r).toMatchObject({ side: 'customer', name: lead.organisation, lastActiveAt: null })
      expect(r.entered.aware).toBe(lead.createdAt)
      expect(r.entered.signed).toBeNull()
      const engaged = ['discovery', 'proposal', 'negotiation'].includes(lead.stage)
      if (lead.stage !== 'lost') expect(r.stage).toBe(engaged ? 'engaged' : 'aware')
      expect(r.churnedAt).toBe(lead.stage === 'lost' ? lead.lastContactAt : null)
    }
  })

  it('take the next free ID on each side and never appear in the live data', () => {
    const liveIds = new Set(
      [...customers, ...responders, ...suppliers, ...partners].map((o) => o.id),
    )
    const fresh = onboarding.filter(
      (r) => r.entered.onboarded === null && !r.orgId.startsWith('LEAD-'),
    )
    expect(fresh.some((r) => liveIds.has(r.orgId))).toBe(false)
    expect(countBy(fresh, (r) => r.orgId.slice(0, 3))).toEqual({
      CUS: 10,
      RSP: 36,
      SUP: 19,
      PTN: 11,
    })
    expect(fresh.map((r) => r.orgId)).toContain('RSP-036')
    expect(fresh.map((r) => r.orgId)).toContain('PTN-013')
  })

  it('are onboarding against the planned blockers, signed recently bar the planted stale one', () => {
    for (const side of SIDES) {
      const queue = onboardingQueue(onboarding, side, DATA_AS_OF)
      expect(countBy(queue, (p) => p.next?.id ?? 'none')).toEqual(ONBOARDING_PLANS[side].onboarding)
      for (const p of queue) {
        if (planted('stale-onboarding').includes(p.record.id)) continue
        expect(p.daysSinceSigned).toBeLessThanOrEqual(110)
      }
    }
  })
})

describe('the funnel stories', () => {
  const leak = (side: SideId) =>
    biggestLeak(buildFunnel(onboarding, side, DATA_AS_OF), onboarding, DATA_AS_OF)?.sentence

  it('match the plan for each side', () => {
    expect(leak('customer')).toBe(
      'Customers go quiet after onboarding: 15 of 60 not active in the last 90 days, 9 of them cancelled.',
    )
    expect(leak('responder')).toBe(
      'Responders stall between Signed and Onboarded: median 32 days, mostly waiting on competence audits.',
    )
    expect(leak('supplier')).toBe(
      'Suppliers drop out between Aware and Demo: only 68% get to a demo, and 7 were lost before one.',
    )
    expect(leak('partner')).toBe(
      'Partners go quiet after onboarding: 5 of 12 not active in the last 90 days.',
    )
  })
})

describe('planted onboarding issues', () => {
  const records = generateOnboardingRecords(
    applySeededIssues(generateDatasets(DATA_AS_OF), SEEDED_ISSUES),
    DATA_AS_OF,
  )
  const plant = (issue: SeededOnboardingIssue) => () => applyOnboardingIssues(records, [issue])
  const base = { description: '', dataset: 'onboarding' as const }

  it('lists one of each kind', () => {
    expect(SEEDED_ONBOARDING_ISSUES.map((i) => i.kind).sort()).toEqual([
      'future-dated-item',
      'live-with-open-item',
      'on-call-after-lapse',
      'stage-behind-dates',
      'stale-onboarding',
    ])
  })

  it('refuse to plant where they no longer fit', () => {
    expect(plant({ ...base, kind: 'stage-behind-dates', recordId: 'ONB-999' })).toThrow(
      'unknown record',
    )
    const aware = records.find((r) => r.stage === 'aware')?.id ?? ''
    const prospect = records.find((r) => r.entered.onboarded === null)?.id ?? ''
    const liveRecord = records.find((r) => r.entered.onboarded !== null)?.id ?? ''
    expect(plant({ ...base, kind: 'stage-behind-dates', recordId: aware })).toThrow('first stage')
    expect(
      plant({ ...base, kind: 'live-with-open-item', recordId: prospect, item: 'sites-added' }),
    ).toThrow('not live')
    expect(
      plant({
        ...base,
        kind: 'future-dated-item',
        recordId: liveRecord,
        item: 'sites-added',
        doneAt: DATA_AS_OF,
      }),
    ).toThrow('not outstanding')
    expect(
      plant({ ...base, kind: 'stale-onboarding', recordId: liveRecord, daysBack: 100 }),
    ).toThrow('not onboarding')
    expect(
      plant({
        ...base,
        dataset: 'responders',
        kind: 'on-call-after-lapse',
        recordId: 'CUS-001',
        lastActiveAt: DATA_AS_OF,
      }),
    ).toThrow('not a live responder')
  })
})
