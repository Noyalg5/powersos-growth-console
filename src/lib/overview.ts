/**
 * The Overview's own logic: where each side of the ecosystem stands today, and the
 * editable first-90-days plan. Every other figure on the Overview comes straight from
 * the functions the section pages use.
 */
import type { OnboardingRecord, SideId, Timestamp } from '@/types'
import { isActive, isOnboarding, stageReached } from './onboarding'

export interface SideSnapshot {
  side: SideId
  /** Live on the platform and still a member. */
  live: number
  /** Live and used the platform in the last 90 days. */
  active: number
  /** Signed and working through the onboarding checklist. */
  onboarding: number
}

/** One side's members as at `asOf`, counted the same way as the Onboarding funnels. */
export function sideSnapshot(
  records: readonly OnboardingRecord[],
  side: SideId,
  asOf: Timestamp,
): SideSnapshot {
  const own = records.filter((r) => r.side === side)
  return {
    side,
    live: own.filter((r) => stageReached(r, asOf) === 'onboarded' && r.churnedAt === null).length,
    active: own.filter((r) => isActive(r, asOf)).length,
    onboarding: own.filter((r) => isOnboarding(r, asOf)).length,
  }
}

/** One entry per month. */
export type NinetyDayPlan = readonly [string, string, string]

export const PLAN_TEXT_MAX_LENGTH = 400

/**
 * A saved plan, month by month: anything that is not text, or is too long, falls back
 * to that month's default. An empty month is kept, as the viewer cleared it.
 */
export function restorePlan(raw: unknown, defaults: NinetyDayPlan): NinetyDayPlan {
  if (!Array.isArray(raw) || raw.length !== defaults.length) return defaults
  const month = (i: 0 | 1 | 2) => {
    const text: unknown = raw[i]
    return typeof text === 'string' && text.length <= PLAN_TEXT_MAX_LENGTH ? text : defaults[i]
  }
  return [month(0), month(1), month(2)]
}
