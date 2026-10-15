import { describe, expect, it } from 'vitest'
import type { OnboardingRecord, OnboardingStage, SideId } from '@/types'
import { PLAN_TEXT_MAX_LENGTH, restorePlan, sideSnapshot, type NinetyDayPlan } from './overview'
import { DAY_MS } from './time'

const AS_OF = Date.UTC(2026, 9, 14, 8, 0)
const ago = (days: number) => AS_OF - days * DAY_MS

let n = 0
function record(
  side: SideId,
  stage: OnboardingStage,
  { lastActive, churned }: { lastActive?: number; churned?: number } = {},
): OnboardingRecord {
  n++
  const order: OnboardingStage[] = ['aware', 'engaged', 'signed', 'onboarded']
  const reached = order.slice(0, order.indexOf(stage) + 1)
  return {
    id: `ONB-${n}`,
    side,
    orgId: `ORG-${n}`,
    name: `Organisation ${n}`,
    town: 'Leeds',
    stage,
    entered: {
      aware: ago(200),
      engaged: reached.includes('engaged') ? ago(150) : null,
      signed: reached.includes('signed') ? ago(100) : null,
      onboarded: reached.includes('onboarded') ? ago(50) : null,
    },
    checklist: [],
    lastActiveAt: lastActive === undefined ? null : ago(lastActive),
    churnedAt: churned === undefined ? null : ago(churned),
  }
}

describe('sideSnapshot', () => {
  const records = [
    record('customer', 'onboarded', { lastActive: 5 }),
    record('customer', 'onboarded', { lastActive: 120 }),
    record('customer', 'onboarded', { lastActive: 60, churned: 10 }),
    record('customer', 'signed'),
    record('customer', 'signed', { churned: 20 }),
    record('customer', 'engaged'),
    record('responder', 'onboarded', { lastActive: 1 }),
  ]

  it('counts live members, active ones and those onboarding, for one side only', () => {
    expect(sideSnapshot(records, 'customer', AS_OF)).toEqual({
      side: 'customer',
      live: 2,
      active: 1,
      onboarding: 1,
    })
    expect(sideSnapshot(records, 'responder', AS_OF)).toMatchObject({ live: 1, active: 1 })
  })

  it('counts nothing for a side with no records', () => {
    expect(sideSnapshot(records, 'partner', AS_OF)).toEqual({
      side: 'partner',
      live: 0,
      active: 0,
      onboarding: 0,
    })
  })

  it('ignores stages reached after the date asked about', () => {
    const early = AS_OF - 75 * DAY_MS
    expect(sideSnapshot(records, 'customer', early)).toMatchObject({ live: 0, onboarding: 3 })
  })
})

describe('restorePlan', () => {
  const defaults: NinetyDayPlan = ['Learn.', 'Pilot.', 'Report.']

  it('keeps a saved plan, including a month the viewer cleared', () => {
    expect(restorePlan(['Listen.', '', 'Report back.'], defaults)).toEqual([
      'Listen.',
      '',
      'Report back.',
    ])
  })

  it('falls back month by month for anything that is not usable text', () => {
    expect(restorePlan([4, 'Pilot in medical.', 'x'.repeat(PLAN_TEXT_MAX_LENGTH + 1)], defaults)).toEqual(
      ['Learn.', 'Pilot in medical.', 'Report.'],
    )
  })

  it('returns the defaults for anything that is not a three-month plan', () => {
    expect(restorePlan(null, defaults)).toBe(defaults)
    expect(restorePlan('plan', defaults)).toBe(defaults)
    expect(restorePlan(['One.', 'Two.'], defaults)).toBe(defaults)
    expect(restorePlan({ 0: 'One.', 1: 'Two.', 2: 'Three.' }, defaults)).toBe(defaults)
  })
})
