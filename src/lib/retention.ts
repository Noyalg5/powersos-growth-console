/**
 * Monthly retention cohorts: of the organisations that went live in a month, the
 * share still members at the end of each month after. "Still a member" means not
 * churned; quiet members still count, and the funnel shows them separately.
 * Only complete months are measured, so the current month is never shown half-done.
 */
import type { OnboardingRecord, Timestamp } from '@/types'
import { DAY_MS } from './time'

export interface Cohort {
  /** 00:00 UTC on the first of the month the cohort went live. */
  month: Timestamp
  size: number
  /**
   * Members left at the end of month 0 (the month they went live), month 1 and so
   * on, up to the last complete month.
   */
  retained: number[]
}

export interface RetentionTable {
  cohorts: Cohort[]
  /** Across every cohort old enough to be measured at each month: members left ÷ joined. */
  overall: (number | null)[]
  /** How many customers each month's overall share is based on. */
  measured: number[]
  /** The most months any cohort can be measured for, plus one for month 0. */
  months: number
  /** Everyone who has gone live, and how many of them have cancelled since. */
  joined: number
  cancelled: number
}

/** First of the month, `offset` months on from the month containing `at`. */
export function monthStart(at: Timestamp, offset = 0): Timestamp {
  const date = new Date(at)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offset, 1)
}

/** Monthly cohorts by go-live date, oldest first. Records that never went live are left out. */
export function retentionCohorts(
  records: readonly OnboardingRecord[],
  asOf: Timestamp,
): RetentionTable {
  const live = records.flatMap((r) =>
    r.entered.onboarded !== null && r.entered.onboarded <= asOf
      ? [{ onboarded: r.entered.onboarded, churnedAt: r.churnedAt }]
      : [],
  )
  const byMonth = new Map<Timestamp, (typeof live)[number][]>()
  for (const member of live) {
    const month = monthStart(member.onboarded)
    byMonth.set(month, [...(byMonth.get(month) ?? []), member])
  }

  const cohorts = [...byMonth.entries()]
    .sort(([a], [b]) => a - b)
    .map(([month, members]): Cohort => {
      const retained: number[] = []
      // Month k ends where month k + 1 begins; stop at the last month that has ended
      for (let k = 0; monthStart(month, k + 1) <= asOf; k++) {
        const end = monthStart(month, k + 1)
        retained.push(members.filter((m) => m.churnedAt === null || m.churnedAt >= end).length)
      }
      return { month, size: members.length, retained }
    })

  const months = Math.max(0, ...cohorts.map((c) => c.retained.length))
  const old = (k: number) => cohorts.filter((c) => c.retained.length > k)
  const measured = Array.from({ length: months }, (_, k) =>
    old(k).reduce((sum, c) => sum + c.size, 0),
  )
  const overall = measured.map((joined, k) => {
    const left = old(k).reduce((sum, c) => sum + (c.retained[k] ?? 0), 0)
    return joined === 0 ? null : left / joined
  })

  return {
    cohorts,
    overall,
    measured,
    months,
    joined: live.length,
    cancelled: live.filter((m) => m.churnedAt !== null && m.churnedAt <= asOf).length,
  }
}

export interface ChurnRate {
  /** Members lost across every cohort month measured. */
  cancellations: number
  /** Members at the start of each of those months, added up. */
  memberMonths: number
  /** Share of members lost in an average month; null with nothing measured. */
  monthly: number | null
}

/**
 * Average monthly churn across the cohort grid: members lost ÷ members at the start
 * of each month, over every cohort month measured. Members count in full for the
 * month they went live, and the current month is left out, as in the grid.
 */
export function monthlyChurn(table: RetentionTable): ChurnRate {
  let cancellations = 0
  let memberMonths = 0
  for (const cohort of table.cohorts) {
    let start = cohort.size
    for (const left of cohort.retained) {
      cancellations += start - left
      memberMonths += start
      start = left
    }
  }
  return {
    cancellations,
    memberMonths,
    monthly: memberMonths === 0 ? null : cancellations / memberMonths,
  }
}

/** Organisations that cancelled after going live, by ID, with the date each left. */
export function cancellations(records: readonly OnboardingRecord[]): Map<string, Timestamp> {
  return new Map(
    records.flatMap((r): [string, Timestamp][] =>
      r.entered.onboarded !== null && r.churnedAt !== null ? [[r.orgId, r.churnedAt]] : [],
    ),
  )
}

export interface Membership {
  /** Members on the books at the date: live and not cancelled. */
  live: number
  /** Went live in the 365 days to the date. */
  joinedLastYear: number
}

export function membershipAt(records: readonly OnboardingRecord[], asOf: Timestamp): Membership {
  const yearAgo = asOf - 365 * DAY_MS
  const live = records.filter((r) => r.entered.onboarded !== null && r.entered.onboarded <= asOf)
  return {
    live: live.filter((r) => r.churnedAt === null || r.churnedAt > asOf).length,
    joinedLastYear: live.filter((r) => (r.entered.onboarded ?? 0) > yearAgo).length,
  }
}
