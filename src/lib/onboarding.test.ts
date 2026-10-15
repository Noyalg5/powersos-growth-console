import { describe, expect, it } from 'vitest'
import type { ChecklistItemId, OnboardingRecord, OnboardingStage, SideId } from '@/types'
import {
  biggestLeak,
  buildFunnel,
  CHECKLISTS,
  checklistItem,
  checklistLabel,
  isActive,
  isDone,
  isOnboarding,
  lastProgressAt,
  onboardingProgress,
  onboardingQueue,
  stageReached,
} from './onboarding'
import { DAY_MS } from './time'

// 09:00 on Wednesday 14 Oct 2026, London time
const AS_OF = Date.UTC(2026, 9, 14, 8, 0)
const ago = (days: number) => Date.UTC(2026, 9, 14) - days * DAY_MS

interface Spec {
  side?: SideId
  /** Days ago each stage was entered; leave out the stages not reached. */
  stages?: Partial<Record<OnboardingStage, number>>
  /** Days ago each checklist item was done. */
  done?: Partial<Record<ChecklistItemId, number>>
  lastActive?: number
  churned?: number
  stage?: OnboardingStage
}

let n = 0
function record({ side = 'responder', stages = {}, done = {}, lastActive, churned, stage }: Spec) {
  n++
  const at = (days: number | undefined) => (days === undefined ? null : ago(days))
  const reached = (['aware', 'engaged', 'signed', 'onboarded'] as const).filter(
    (s) => stages[s] !== undefined,
  )
  const live = stages.onboarded !== undefined
  return {
    id: `ONB-${String(n).padStart(3, '0')}`,
    side,
    orgId: `ORG-${n}`,
    name: `Organisation ${n}`,
    town: 'Leeds',
    stage: stage ?? reached.at(-1) ?? 'aware',
    entered: {
      aware: at(stages.aware),
      engaged: at(stages.engaged),
      signed: at(stages.signed),
      onboarded: at(stages.onboarded),
    },
    checklist: CHECKLISTS[side].map(({ id }) => ({
      item: id,
      doneAt: live ? at(stages.onboarded) : at(done[id]),
    })),
    lastActiveAt: at(lastActive),
    churnedAt: at(churned),
  } satisfies OnboardingRecord
}

const liveFor = (days: number, extra: Spec = {}) =>
  record({
    stages: { aware: days + 60, engaged: days + 40, signed: days + 20, onboarded: days },
    ...extra,
  })

describe('checklists', () => {
  it('lists the items for each side, in order', () => {
    const labels = (side: SideId) => CHECKLISTS[side].map((i) => i.label)
    expect(labels('customer')).toEqual([
      'Sites added',
      'Equipment logged',
      'Emergency contacts',
      'Cost-approval limits',
      'First test call-out',
    ])
    expect(labels('responder')).toEqual([
      'HV authorisation uploaded',
      'Insurance',
      'Competence audit',
      'Rates agreed',
      'App training',
    ])
    expect(labels('supplier')).toEqual([
      'Catalogue',
      'Stock levels',
      'Delivery SLAs',
      'Regions served',
    ])
    expect(labels('partner')).toEqual(['Agreement signed', 'Referral code', 'Co-marketing pack'])
  })

  it('looks items up by ID', () => {
    expect(checklistItem('competence-audit').waitingOn).toBe('competence audits')
    expect(() => checklistItem('nope' as ChecklistItemId)).toThrow('Unknown checklist item')
    expect(checklistLabel('delivery-slas')).toBe('Delivery SLAs')
    expect(checklistLabel('nope')).toBe('nope')
  })

  it('only counts an item done once its date has passed', () => {
    expect(isDone({ item: 'insurance', doneAt: null }, AS_OF)).toBe(false)
    expect(isDone({ item: 'insurance', doneAt: AS_OF }, AS_OF)).toBe(true)
    expect(isDone({ item: 'insurance', doneAt: AS_OF + DAY_MS }, AS_OF)).toBe(false)
  })
})

describe('stages', () => {
  it('reads the furthest stage from the dates, ignoring the future', () => {
    expect(stageReached(liveFor(10), AS_OF)).toBe('onboarded')
    expect(stageReached(record({ stages: { aware: 5, engaged: -3 } }), AS_OF)).toBe('aware')
    expect(stageReached(record({}), AS_OF)).toBeNull()
  })

  it('counts organisations active within 90 days, while still members', () => {
    expect(isActive(liveFor(200, { lastActive: 89 }), AS_OF)).toBe(true)
    expect(isActive(liveFor(200, { lastActive: 90 }), AS_OF)).toBe(false)
    expect(isActive(liveFor(200, { lastActive: 1, churned: 0 }), AS_OF)).toBe(false)
    expect(isActive(record({ stages: { aware: 10, signed: 5 }, lastActive: 1 }), AS_OF)).toBe(false)
  })

  it('treats signed, not live and not lost as onboarding', () => {
    expect(isOnboarding(record({ stages: { aware: 30, engaged: 20, signed: 10 } }), AS_OF)).toBe(
      true,
    )
    expect(isOnboarding(record({ stages: { aware: 30, signed: 10 }, churned: 2 }), AS_OF)).toBe(
      false,
    )
    expect(isOnboarding(liveFor(5), AS_OF)).toBe(false)
  })
})

describe('buildFunnel', () => {
  const records = [
    liveFor(100, { lastActive: 3 }),
    liveFor(200, { lastActive: 150 }),
    liveFor(300, { lastActive: 250, churned: 240 }),
    record({ stages: { aware: 80, engaged: 70, signed: 60 } }),
    record({ stages: { aware: 50, engaged: 40, signed: 30 }, churned: 20 }),
    record({ stages: { aware: 20, engaged: 10 } }),
    record({ stages: { aware: 15 } }),
    record({ stages: { aware: 400 }, churned: 380 }),
    // Another side is left out
    record({ side: 'partner', stages: { aware: 15 } }),
  ]
  const funnel = buildFunnel(records, 'responder', AS_OF)

  it('counts everyone who reached each step', () => {
    expect(funnel.steps.map((s) => [s.step, s.reached])).toEqual([
      ['aware', 8],
      ['engaged', 6],
      ['signed', 5],
      ['onboarded', 3],
      ['active', 1],
    ])
    expect(funnel.steps[2]?.shareOfTop).toBeCloseTo(5 / 8)
  })

  it('splits each drop into those lost and those still there', () => {
    const [toEngaged, toSigned, toOnboarded, toActive] = funnel.transitions
    expect(toEngaged).toMatchObject({ entered: 8, converted: 6, dropped: 2, left: 1, waiting: 1 })
    expect(toSigned).toMatchObject({ converted: 5, dropped: 1, left: 0, waiting: 1 })
    expect(toOnboarded).toMatchObject({ entered: 5, converted: 3, left: 1, waiting: 1 })
    expect(toOnboarded?.conversion).toBeCloseTo(0.6)
    expect(toActive).toMatchObject({
      entered: 3,
      converted: 1,
      left: 1,
      waiting: 1,
      medianDays: null,
    })
  })

  it('takes the median days in each stage from those that moved on', () => {
    // Aware to engaged: 20 days for the live three, 10 for the signed pair, 10 for one engaged
    expect(funnel.transitions[0]?.medianDays).toBe(15)
    expect(funnel.transitions[2]?.medianDays).toBe(20)
  })

  it('counts a later stage as reaching the earlier ones, even with a date missing', () => {
    const gap = record({ stages: { aware: 50, signed: 20 } })
    const f = buildFunnel([gap], 'responder', AS_OF)
    expect(f.steps.map((s) => s.reached)).toEqual([1, 1, 1, 0, 0])
    expect(f.transitions[0]?.medianDays).toBeNull()
  })

  it('copes with a side that has nobody', () => {
    const empty = buildFunnel(records, 'supplier', AS_OF)
    expect(empty.steps.every((s) => s.reached === 0 && s.shareOfTop === 0)).toBe(true)
    expect(empty.transitions.every((t) => t.conversion === null)).toBe(true)
    expect(biggestLeak(empty, records, AS_OF)).toBeNull()
  })
})

describe('onboarding queue', () => {
  const stuck = record({
    stages: { aware: 90, engaged: 80, signed: 60 },
    done: { 'hv-authorisation': 50, insurance: 40, 'app-training': 30 },
  })
  const booked = record({
    stages: { aware: 50, engaged: 40, signed: 20 },
    done: { 'hv-authorisation': -5 },
  })

  it('shows progress, the next item in checklist order and the last progress', () => {
    const progress = onboardingProgress(stuck, AS_OF)
    expect(progress).toMatchObject({ done: 3, total: 5, daysSinceSigned: 60 })
    expect(progress.next?.id).toBe('competence-audit')
    expect(progress.lastProgressAt).toBe(ago(30))
    expect(progress.items.map((i) => i.done)).toEqual([true, true, false, false, true])
  })

  it('does not count an item dated after the data date', () => {
    const progress = onboardingProgress(booked, AS_OF)
    expect(progress.done).toBe(0)
    expect(progress.next?.id).toBe('hv-authorisation')
    expect(progress.items[0]?.doneAt).toBe(ago(-5))
    expect(lastProgressAt(booked, AS_OF)).toBe(ago(20))
  })

  it('needs a signing date', () => {
    expect(() => onboardingProgress(record({ stages: { aware: 3 } }), AS_OF)).toThrow(
      'has not signed',
    )
    expect(lastProgressAt(record({ stages: { aware: 3 } }), AS_OF)).toBeNull()
  })

  it('lists only open onboardings, longest since signing first', () => {
    const queue = onboardingQueue(
      [booked, liveFor(10), stuck, record({ stages: { aware: 9 } })],
      'responder',
      AS_OF,
    )
    expect(queue.map((p) => p.record.id)).toEqual([stuck.id, booked.id])
  })
})

describe('biggestLeak', () => {
  const signedOnly = (blocker: Partial<Record<ChecklistItemId, number>>) =>
    record({ stages: { aware: 80, engaged: 60, signed: 40 }, done: blocker })

  it('names what most stalled organisations are waiting on', () => {
    const records = [
      liveFor(10, { lastActive: 1 }),
      liveFor(20, { lastActive: 1 }),
      liveFor(30, { lastActive: 1 }),
      // Two waiting on audits, one on insurance
      signedOnly({ 'hv-authorisation': 30, insurance: 20 }),
      signedOnly({ 'hv-authorisation': 30, insurance: 20 }),
      signedOnly({ 'hv-authorisation': 30 }),
    ]
    const leak = biggestLeak(buildFunnel(records, 'responder', AS_OF), records, AS_OF)
    expect(leak?.transition).toMatchObject({ from: 'signed', to: 'onboarded' })
    expect(leak?.sentence).toBe(
      'Responders stall between Signed and Onboarded: median 20 days, mostly waiting on competence audits.',
    )
  })

  it('says "most often" when the commonest blocker is short of a majority', () => {
    const records = [
      liveFor(10, { lastActive: 1 }),
      signedOnly({}),
      signedOnly({ 'hv-authorisation': 30, insurance: 20 }),
      signedOnly({ 'hv-authorisation': 30, insurance: 20 }),
      signedOnly({ 'hv-authorisation': 30, insurance: 20, 'competence-audit': 10 }),
    ]
    expect(biggestLeak(buildFunnel(records, 'responder', AS_OF), records, AS_OF)?.sentence).toBe(
      'Responders stall between Signed and Onboarded: median 20 days, most often waiting on competence audits.',
    )
  })

  it('says "drop out" when more were lost than are still waiting', () => {
    const records = [
      liveFor(10, { side: 'supplier', lastActive: 1 }),
      liveFor(20, { side: 'supplier', lastActive: 1 }),
      record({ side: 'supplier', stages: { aware: 100 }, churned: 80 }),
      record({ side: 'supplier', stages: { aware: 100 }, churned: 80 }),
      record({ side: 'supplier', stages: { aware: 5 } }),
    ]
    expect(biggestLeak(buildFunnel(records, 'supplier', AS_OF), records, AS_OF)?.sentence).toBe(
      'Suppliers drop out between Aware and Demo: only 40% get to a demo, and 2 were lost before one.',
    )
  })

  it('reports members going quiet after onboarding, and how many cancelled', () => {
    const records = [
      liveFor(100, { side: 'partner', lastActive: 2 }),
      liveFor(100, { side: 'partner', lastActive: 200 }),
      liveFor(100, { side: 'partner', lastActive: 200 }),
      liveFor(100, { side: 'partner', lastActive: 50, churned: 40 }),
    ]
    expect(biggestLeak(buildFunnel(records, 'partner', AS_OF), records, AS_OF)?.sentence).toBe(
      'Partners go quiet after onboarding: 3 of 4 not active in the last 90 days, 1 of them cancelled.',
    )
  })

  it('ignores steps with too few entrants, and returns null when nothing leaks', () => {
    const tiny = [liveFor(10, { lastActive: 200 }), liveFor(20, { lastActive: 200 })]
    expect(biggestLeak(buildFunnel(tiny, 'responder', AS_OF), tiny, AS_OF)).toBeNull()
    const perfect = [1, 2, 3].map((d) => liveFor(d * 10, { lastActive: 1 }))
    expect(biggestLeak(buildFunnel(perfect, 'responder', AS_OF), perfect, AS_OF)).toBeNull()
  })
})
