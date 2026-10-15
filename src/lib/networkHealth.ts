/**
 * Network health in one call: the data in view, each site's cover, the gaps, the
 * recruitment plan and the five headline measures. The Network health page and the
 * Overview both read it, so their figures always agree.
 */
import {
  coverageGaps,
  siteCoverage,
  summariseCoverage,
  type CoverageSummary,
  type GapArea,
  type SiteCoverage,
} from './coverage'
import {
  medianAcceptMinutes,
  monthlyCounts,
  onTargetShare,
  utilisation,
  type MonthCount,
  type Utilisation,
} from './liquidity'
import type { CoverContext } from './matching'
import {
  coverContextFor,
  rangeUntil,
  scopeNetwork,
  type NetworkData,
  type NetworkFilters,
  type ScopedNetwork,
} from './networkFilters'
import { planRecruitment, type RecruitmentPlan, type RecruitTown } from './recruitment'

/** The five headline measures, in the order the page shows them. */
export interface NetworkKpis {
  coverage: CoverageSummary
  /** Null when there are no call-outs in view. */
  medianAccept: number | null
  onTarget: number | null
  callOuts: number
  utilisation: Utilisation
  monthly: MonthCount[]
}

export interface NetworkView {
  scoped: ScopedNetwork
  context: CoverContext
  coverage: SiteCoverage[]
  gaps: GapArea[]
  plan: RecruitmentPlan
  kpis: NetworkKpis
}

/**
 * Everything Network health shows for a set of filters. Cover counts every responder,
 * wherever they are based; utilisation counts only those based in the region chosen.
 */
export function networkView(
  filters: NetworkFilters,
  data: NetworkData,
  towns: readonly RecruitTown[],
  asOf: number,
): NetworkView {
  const scoped = scopeNetwork(filters, data)
  const context = coverContextFor(filters, asOf)
  const coverage = siteCoverage(scoped.sites, data.responders, context)
  const until = rangeUntil(filters)
  return {
    scoped,
    context,
    coverage,
    gaps: coverageGaps(coverage),
    plan: planRecruitment(coverage, towns),
    kpis: {
      coverage: summariseCoverage(coverage.map((c) => c.status)),
      medianAccept: medianAcceptMinutes(scoped.callOuts),
      onTarget: onTargetShare(scoped.callOuts),
      callOuts: scoped.callOuts.length,
      utilisation: utilisation(scoped.responders, scoped.callOuts, filters.from, until),
      monthly: monthlyCounts(scoped.callOuts, filters.from, until),
    },
  }
}
