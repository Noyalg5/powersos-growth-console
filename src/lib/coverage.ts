/**
 * Network coverage: which sites have enough eligible responders within reach.
 *
 * Reach is the planning estimate from geo.ts: straight-line distance × road factor
 * at an average speed, within the 75-minute target. It leaves out mobilisation and
 * traffic, which the simulator adds for a live ETA. Eligibility is the simulator's
 * rule from matching.ts, so a responder that could not be sent to a job never
 * counts towards cover.
 */
import type { LatLng, Region, Responder, Site } from '@/types'
import { estimateDriveMinutes, haversineMiles, isWithinTarget } from './geo'
import { isEligible, type CoverContext } from './matching'

/** A site is covered when at least this many eligible responders can reach it. */
export const COVERED_MIN_RESPONDERS = 2
/** Responders listed for each site, in or out of reach. */
export const NEAREST_SHOWN = 3

export type CoverageStatus = 'covered' | 'thin' | 'uncovered'

/** Covered with 2 or more eligible responders in reach, thin with 1, uncovered with none. */
export function coverageStatus(responders: number): CoverageStatus {
  if (!Number.isInteger(responders) || responders < 0) {
    throw new RangeError(`responders must be a non-negative integer, got ${responders}`)
  }
  if (responders >= COVERED_MIN_RESPONDERS) return 'covered'
  return responders === 1 ? 'thin' : 'uncovered'
}

/** Estimated drive time between two points, in minutes. */
export function driveMinutes(from: LatLng, to: LatLng): number {
  return estimateDriveMinutes(haversineMiles(from, to))
}

/** Whether `to` is within an estimated 75-minute drive of `from`. */
export function withinReach(from: LatLng, to: LatLng): boolean {
  return isWithinTarget(driveMinutes(from, to))
}

export interface ResponderReach {
  responder: Responder
  /** Estimated drive, rounded to the minute. */
  minutes: number
}

/** Cover for one site: a customer's by default, or any point with a location, such as a lead's site. */
export interface SiteCoverage<S extends LatLng = Site> {
  site: S
  /** Eligible responders within reach, nearest first. */
  inReach: ResponderReach[]
  /** The nearest eligible responders, whether in reach or not. */
  nearest: ResponderReach[]
  status: CoverageStatus
}

/** Coverage for each site, counting only responders eligible in `context`. */
export function siteCoverage<S extends LatLng>(
  sites: readonly S[],
  responders: readonly Responder[],
  context: CoverContext,
): SiteCoverage<S>[] {
  const eligible = responders.filter((r) => isEligible(r, context))
  return sites.map((site) => {
    const reaches = eligible
      .map((responder) => ({ responder, exact: driveMinutes(responder, site) }))
      .sort((a, b) => a.exact - b.exact || a.responder.id.localeCompare(b.responder.id))
    const inReach = reaches.filter((r) => isWithinTarget(r.exact))
    const toReach = ({ responder, exact }: (typeof reaches)[number]): ResponderReach => ({
      responder,
      minutes: Math.round(exact),
    })
    return {
      site,
      inReach: inReach.map(toReach),
      nearest: reaches.slice(0, NEAREST_SHOWN).map(toReach),
      status: coverageStatus(inReach.length),
    }
  })
}

export interface CoverageSummary {
  sites: number
  covered: number
  thin: number
  uncovered: number
  /** Covered sites as a share of all sites, 0 to 1. Zero when there are no sites. */
  coveredShare: number
}

export function summariseCoverage(statuses: readonly CoverageStatus[]): CoverageSummary {
  const count = (status: CoverageStatus) => statuses.filter((s) => s === status).length
  const covered = count('covered')
  return {
    sites: statuses.length,
    covered,
    thin: count('thin'),
    uncovered: count('uncovered'),
    coveredShare: statuses.length === 0 ? 0 : covered / statuses.length,
  }
}

export interface GapArea {
  /** The anchor town the sites are nearest to. */
  town: string
  region: Region
  sites: SiteCoverage[]
  uncovered: number
  thin: number
  /** Sum of the criticality (1–5) of every thin or uncovered site. */
  criticality: number
}

/**
 * Thin and uncovered sites grouped by nearest anchor town, most critical first:
 * by total criticality, then by uncovered sites, then by name.
 */
export function coverageGaps(coverage: readonly SiteCoverage[]): GapArea[] {
  const areas = new Map<string, GapArea>()
  for (const entry of coverage) {
    if (entry.status === 'covered') continue
    const { town, region, criticality } = entry.site
    const area = areas.get(town) ?? { town, region, sites: [], uncovered: 0, thin: 0, criticality: 0 }
    area.sites.push(entry)
    area[entry.status] += 1
    area.criticality += criticality
    areas.set(town, area)
  }
  return [...areas.values()].sort(
    (a, b) =>
      b.criticality - a.criticality || b.uncovered - a.uncovered || a.town.localeCompare(b.town),
  )
}
