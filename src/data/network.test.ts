import { describe, expect, it } from 'vitest'
import { siteCoverage, summariseCoverage } from '@/lib/coverage'
import { isEligible, type CoverContext } from '@/lib/matching'
import { planRecruitment } from '@/lib/recruitment'
import type { SectorId } from '@/types'
import { DATA_AS_OF, responders, SECTOR_FAMILIES, SECTORS, sectorFamily, sites, TOWNS } from './index'

const day: CoverContext = { at: DATA_AS_OF, overnight: false, weekend: false }
const night: CoverContext = { ...day, overnight: true }

describe('sector families', () => {
  it('put every sector in exactly one family', () => {
    const grouped = SECTOR_FAMILIES.flatMap((f) => f.sectors as readonly SectorId[])
    expect([...grouped].sort()).toEqual(SECTORS.map((s) => s.id).sort())
    expect(sectorFamily('medical')).toBe('critical')
    expect(sectorFamily('warehousing')).toBe('public')
  })
})

describe('coverage on the synthetic network', () => {
  const coverage = siteCoverage(sites, responders, day)

  it('never counts a responder with lapsed or missing paperwork', () => {
    const lapsed = new Set(responders.filter((r) => !isEligible(r, day)).map((r) => r.id))
    expect(lapsed.size).toBeGreaterThan(0)
    for (const entry of coverage) {
      for (const { responder } of [...entry.inReach, ...entry.nearest]) {
        expect(lapsed.has(responder.id)).toBe(false)
      }
    }
  })

  it('is never better overnight than in the daytime', () => {
    const overnight = siteCoverage(sites, responders, night)
    overnight.forEach((entry, i) => {
      expect(entry.inReach.length).toBeLessThanOrEqual(coverage[i]?.inReach.length ?? 0)
    })
  })

  it('leaves the deliberate gaps visible', () => {
    const summary = summariseCoverage(coverage.map((c) => c.status))
    expect(summary.coveredShare).toBeGreaterThan(0.3)
    expect(summary.coveredShare).toBeLessThan(0.9)
    const truro = coverage.filter((c) => c.site.town === 'Truro')
    expect(truro.length).toBeGreaterThan(0)
    expect(truro.every((c) => c.status === 'uncovered')).toBe(true)
  })

  it('plans recruits that only ever raise coverage, towards the gaps', () => {
    for (const context of [day, night]) {
      const plan = planRecruitment(siteCoverage(sites, responders, context), TOWNS)
      expect(plan.picks.length).toBeGreaterThan(0)
      let share = plan.before.coveredShare
      for (const pick of plan.picks) {
        expect(pick.after.coveredShare).toBeGreaterThanOrEqual(share)
        share = pick.after.coveredShare
      }
      expect(plan.after.coveredShare).toBeGreaterThan(plan.before.coveredShare)
      // The best-served cities never come first
      expect(['Birmingham', 'Manchester', 'London']).not.toContain(plan.picks[0]?.town.name)
    }
  })
})
