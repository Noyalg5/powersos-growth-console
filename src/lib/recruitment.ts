/**
 * Where to recruit next: a greedy plan.
 *
 * Each pick imagines one new eligible responder based in an anchor town centre and
 * asks which town would do the most good. Only sites with fewer than two eligible
 * responders in reach can gain: one going from none to one, or from one to two,
 * adds its criticality (1–5). The town with the biggest gain wins; the picture is
 * updated as if that responder had joined, and the next pick is made the same way.
 * The same town can win twice: the second recruit there takes its thin sites to
 * covered. The plan stops early once no town would add anything.
 */
import type { LatLng, Region, Responder } from '@/types'
import {
  COVERED_MIN_RESPONDERS,
  coverageStatus,
  summariseCoverage,
  withinReach,
  type CoverageSummary,
  type SiteCoverage,
} from './coverage'
import { eligibilityExclusions, type CoverContext } from './matching'

export const DEFAULT_PICKS = 5

export interface RecruitTown extends LatLng {
  name: string
  region: Region
}

export interface RecruitPick {
  town: RecruitTown
  /** Under-covered sites the new responder would reach. */
  sitesReached: number
  /** Sites taken from one eligible responder to two. */
  newlyCovered: number
  /** Sites taken from none to one. */
  firstResponder: number
  criticalityGained: number
  before: CoverageSummary
  after: CoverageSummary
}

export interface RecruitmentPlan {
  picks: RecruitPick[]
  before: CoverageSummary
  after: CoverageSummary
  /** True when the plan ran out of useful towns before making every pick. */
  stoppedEarly: boolean
}

interface Option {
  town: RecruitTown
  /** Indexes of the sites within reach of the town. */
  reach: number[]
}

/** Criticality-weighted cover a recruit in this town would add, and what changes. */
function evaluate(option: Option, counts: readonly number[], criticality: readonly number[]) {
  let gain = 0
  let sitesReached = 0
  let newlyCovered = 0
  let firstResponder = 0
  for (const i of option.reach) {
    const count = counts[i] ?? 0
    if (count >= COVERED_MIN_RESPONDERS) continue
    sitesReached++
    gain += criticality[i] ?? 0
    if (count === 0) firstResponder++
    else newlyCovered++
  }
  return { gain, sitesReached, newlyCovered, firstResponder }
}

const summarise = (counts: readonly number[]) => summariseCoverage(counts.map(coverageStatus))

/** Up to `picks` recruits, best first, for the sites in `coverage`. */
export function planRecruitment(
  coverage: readonly SiteCoverage[],
  towns: readonly RecruitTown[],
  { picks = DEFAULT_PICKS }: { picks?: number } = {},
): RecruitmentPlan {
  if (!Number.isInteger(picks) || picks < 0) {
    throw new RangeError(`picks must be a non-negative integer, got ${picks}`)
  }
  const counts = coverage.map((c) => c.inReach.length)
  const criticality = coverage.map((c) => c.site.criticality)
  const options: Option[] = towns.map((town) => ({
    town,
    reach: coverage.flatMap((c, i) => (withinReach(town, c.site) ? [i] : [])),
  }))
  const before = summarise(counts)
  const chosen: RecruitPick[] = []

  while (chosen.length < picks) {
    let best: (Option & ReturnType<typeof evaluate>) | null = null
    for (const option of options) {
      const result = { ...option, ...evaluate(option, counts, criticality) }
      if (
        !best ||
        result.gain > best.gain ||
        (result.gain === best.gain &&
          (result.newlyCovered > best.newlyCovered ||
            (result.newlyCovered === best.newlyCovered &&
              result.town.name.localeCompare(best.town.name) < 0)))
      ) {
        best = result
      }
    }
    if (!best || best.gain === 0) break

    const pickBefore = summarise(counts)
    for (const i of best.reach) counts[i] = (counts[i] ?? 0) + 1
    chosen.push({
      town: best.town,
      sitesReached: best.sitesReached,
      newlyCovered: best.newlyCovered,
      firstResponder: best.firstResponder,
      criticalityGained: best.gain,
      before: pickBefore,
      after: summarise(counts),
    })
  }

  return {
    picks: chosen,
    before,
    after: summarise(counts),
    stoppedEarly: chosen.length < picks,
  }
}

export interface LapsedResponder {
  responder: Responder
  /** Why the responder cannot take jobs today, e.g. "Authorisation expired 15 Aug 2026". */
  reasons: string[]
}

/**
 * Responders within reach of a town who are held back only by paperwork. Renewing
 * it would add cover there without recruiting anyone. Responders who also lack
 * cover for the hour in `context` are left out: renewal alone would not help.
 */
export function lapsedNearby(
  town: LatLng,
  responders: readonly Responder[],
  context: CoverContext,
): LapsedResponder[] {
  return responders.flatMap((responder) => {
    const exclusions = eligibilityExclusions(responder, context)
    const paperworkOnly =
      exclusions.length > 0 && exclusions.every((e) => e.factor === 'compliance')
    return paperworkOnly && withinReach(responder, town)
      ? [{ responder, reasons: exclusions.map((e) => e.label) }]
      : []
  })
}
