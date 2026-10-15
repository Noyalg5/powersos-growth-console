import { describe, expect, it } from 'vitest'
import type { OnboardingRecord } from '@/types'
import {
  cancellations,
  membershipAt,
  monthlyChurn,
  monthStart,
  retentionCohorts,
} from './retention'

// 14 Oct 2026: the last complete month is September
const AS_OF = Date.UTC(2026, 9, 14, 8, 0)

let n = 0
function member(onboarded: number | null, churnedAt: number | null = null): OnboardingRecord {
  n++
  return {
    id: `ONB-${n}`,
    side: 'customer',
    orgId: `CUS-${n}`,
    name: `Customer ${n}`,
    town: 'Leeds',
    stage: onboarded === null ? 'signed' : 'onboarded',
    entered: { aware: Date.UTC(2024, 0, 1), engaged: null, signed: null, onboarded },
    checklist: [],
    lastActiveAt: null,
    churnedAt,
  }
}

describe('monthStart', () => {
  it('finds the first of the month, and counts months on from it', () => {
    expect(monthStart(Date.UTC(2026, 9, 14, 8))).toBe(Date.UTC(2026, 9, 1))
    expect(monthStart(Date.UTC(2026, 9, 14), 3)).toBe(Date.UTC(2027, 0, 1))
    expect(monthStart(Date.UTC(2026, 9, 14), -10)).toBe(Date.UTC(2025, 11, 1))
  })
})

describe('retentionCohorts', () => {
  const table = retentionCohorts(
    [
      member(Date.UTC(2026, 5, 3)),
      member(Date.UTC(2026, 5, 20), Date.UTC(2026, 7, 15)),
      // Churned on the first of August: still a member at the end of July
      member(Date.UTC(2026, 5, 28), Date.UTC(2026, 7, 1)),
      member(Date.UTC(2026, 7, 9)),
      // Live this month: not measurable yet
      member(Date.UTC(2026, 9, 2)),
      // Never went live
      member(null),
    ],
    AS_OF,
  )

  it('groups members by the month they went live, oldest first', () => {
    expect(table.cohorts.map((c) => [c.month, c.size])).toEqual([
      [Date.UTC(2026, 5, 1), 3],
      [Date.UTC(2026, 7, 1), 1],
      [Date.UTC(2026, 9, 1), 1],
    ])
  })

  it('counts members left at the end of each complete month', () => {
    // June, July, August, September
    expect(table.cohorts[0]?.retained).toEqual([3, 3, 1, 1])
    expect(table.cohorts[1]?.retained).toEqual([1, 1])
    expect(table.cohorts[2]?.retained).toEqual([])
  })

  it('counts everyone who went live and how many cancelled', () => {
    expect(table).toMatchObject({ joined: 5, cancelled: 2 })
  })

  it('averages across the cohorts measured at each month, weighted by size', () => {
    expect(table.months).toBe(4)
    expect(table.overall).toEqual([1, 1, 1 / 3, 1 / 3])
    expect(table.measured).toEqual([4, 4, 3, 3])
  })

  it('leaves out the future and copes with no members', () => {
    expect(retentionCohorts([member(AS_OF + 86_400_000)], AS_OF).cohorts).toEqual([])
    expect(retentionCohorts([], AS_OF)).toEqual({
      cohorts: [],
      overall: [],
      measured: [],
      months: 0,
      joined: 0,
      cancelled: 0,
    })
  })
})

describe('monthlyChurn', () => {
  it('divides members lost by members at the start of each measured month', () => {
    const table = retentionCohorts(
      [
        member(Date.UTC(2026, 5, 3)),
        member(Date.UTC(2026, 5, 20), Date.UTC(2026, 7, 15)),
        member(Date.UTC(2026, 5, 28), Date.UTC(2026, 7, 1)),
        member(Date.UTC(2026, 7, 9)),
        // Live this month and cancelled already: not measured, as in the grid
        member(Date.UTC(2026, 9, 2), Date.UTC(2026, 9, 10)),
      ],
      AS_OF,
    )
    // June cohort: 3, 3, 3, 1 at the start of June to September; August cohort: 1, 1
    expect(monthlyChurn(table)).toEqual({ cancellations: 2, memberMonths: 12, monthly: 2 / 12 })
  })

  it('has no rate with nothing measured', () => {
    expect(monthlyChurn(retentionCohorts([], AS_OF))).toEqual({
      cancellations: 0,
      memberMonths: 0,
      monthly: null,
    })
  })
})

describe('cancellations', () => {
  it('lists members who left after going live, not prospects who dropped out', () => {
    const left = member(Date.UTC(2026, 1, 3), Date.UTC(2026, 6, 1))
    const prospect = { ...member(null), churnedAt: Date.UTC(2026, 3, 1) }
    const map = cancellations([left, prospect, member(Date.UTC(2026, 2, 1))])
    expect([...map]).toEqual([[left.orgId, Date.UTC(2026, 6, 1)]])
  })
})

describe('membershipAt', () => {
  it('counts members on the books and those who went live in the last year', () => {
    const records = [
      member(Date.UTC(2024, 3, 1)),
      member(Date.UTC(2026, 2, 1)),
      member(Date.UTC(2026, 4, 1), Date.UTC(2026, 8, 1)),
      // Cancels after the date: still a member on it
      member(Date.UTC(2025, 2, 1), AS_OF + 86_400_000),
      member(AS_OF + 86_400_000),
      member(null),
    ]
    expect(membershipAt(records, AS_OF)).toEqual({ live: 3, joinedLastYear: 2 })
  })
})
