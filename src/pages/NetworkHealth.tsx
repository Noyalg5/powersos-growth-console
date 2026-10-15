import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { CoverageGaps } from '@/components/network/CoverageGaps'
import { CoverageMap } from '@/components/network/CoverageMap'
import { KpiRow } from '@/components/network/KpiRow'
import { LiquidityHeatmap } from '@/components/network/LiquidityHeatmap'
import { NetworkFilterBar } from '@/components/network/NetworkFilterBar'
import { RecruitmentPlan } from '@/components/network/RecruitmentPlan'
import { PageHeader } from '@/components/PageHeader'
import { SectionHeading } from '@/components/SectionHeading'
import {
  callOuts,
  customers,
  DATA_AS_OF,
  responders,
  SECTORS,
  sites,
  suppliers,
  TOWNS,
} from '@/data'
import { demoTarget } from '@/demo'
import { formatDateTime } from '@/lib/format'
import { liquidityGrid, liquidityInsights } from '@/lib/liquidity'
import {
  COVER_MODES,
  dataBounds,
  defaultFilters,
  filtersToParams,
  parseFilters,
  type NetworkFilters,
} from '@/lib/networkFilters'
import { networkView } from '@/lib/networkHealth'
import { lapsedNearby } from '@/lib/recruitment'
import { formatSectionNumber, getSection } from '@/nav'

const section = getSection('network')

const BOUNDS = dataBounds(DATA_AS_OF)
const REGIONS = [...new Set(TOWNS.map((t) => t.region))]
const OPTIONS = { sectors: SECTORS.map((s) => s.id), regions: REGIONS }
const DATA = { customers, sites, responders, callOuts }

export default function NetworkHealth() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params, BOUNDS, OPTIONS), [params])
  const setFilters = (next: NetworkFilters) =>
    setParams(filtersToParams(next, BOUNDS), { replace: true, preventScrollReset: true })

  const view = useMemo(() => networkView(filters, DATA, TOWNS, DATA_AS_OF), [filters])
  const { scoped, context, coverage, gaps, plan, kpis } = view
  const lapsed = useMemo(
    () => plan.picks.map((pick) => lapsedNearby(pick.town, responders, context)),
    [plan, context],
  )
  const grid = useMemo(
    () =>
      liquidityGrid(
        scoped.callOuts,
        responders,
        filters.region ? [filters.region] : REGIONS,
        context.at,
      ),
    [scoped, filters.region, context],
  )

  const filtered = filtersToParams(filters, BOUNDS).size > 0
  const coverLabel = COVER_MODES[filters.cover].label.toLowerCase()

  return (
    <article>
      <PageHeader
        eyebrow={`Section ${formatSectionNumber(section.number)}`}
        title={section.title}
        lead={section.question}
      >
        <p className="mt-4 leading-relaxed text-pretty text-ink-muted">
          Three questions: where the network is strong, where it is thin, and where to recruit
          next. A site counts as covered when at least two eligible responders are within an
          estimated 75-minute drive, using the same eligibility rules as the simulator.
        </p>
      </PageHeader>

      <div className="mt-10">
        <NetworkFilterBar
          filters={filters}
          bounds={BOUNDS}
          sectors={SECTORS}
          regions={REGIONS}
          onChange={(patch) => setFilters({ ...filters, ...patch })}
          onReset={() => setFilters(defaultFilters(BOUNDS))}
          filtered={filtered}
        />
      </div>

      <section aria-labelledby="map-heading" className="mt-10">
        <SectionHeading
          id="map-heading"
          title="Coverage map"
          lead={`Cover as at ${formatDateTime(context.at)}, for ${coverLabel} requests. Click a site for its nearest eligible responders.`}
        />
        <div className="mt-4">
          <CoverageMap
            coverage={coverage}
            customers={customers}
            responders={responders}
            suppliers={suppliers}
            context={context}
          />
        </div>
      </section>

      <section aria-labelledby="kpi-heading" className="mt-12">
        <h2 id="kpi-heading" className="sr-only">
          Key measures
        </h2>
        <KpiRow kpis={kpis} />
      </section>

      <section aria-labelledby="gaps-heading" className="mt-14">
        <SectionHeading
          id="gaps-heading"
          title="Coverage gaps and recruitment plan"
          lead="Thin and uncovered sites, grouped by their nearest town and ranked by how critical they are, then the five recruits that would close the most of that gap."
        />
        <h3 className="mt-6 mb-3 text-sm font-semibold text-ink">Where the gaps are</h3>
        <CoverageGaps gaps={gaps} />

        <h3 className="mt-10 mb-3 text-sm font-semibold text-ink">Where to recruit next</h3>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div>
            <div className="rounded-xl border border-line bg-surface-muted p-4 text-sm leading-relaxed text-ink-muted">
              <p>
                <span className="font-medium text-ink">How the plan works.</span> Imagine one new
                responder, fully authorised and on call around the clock, based in a town centre.
                Add up the criticality of the sites it would bring within 75 minutes that have
                fewer than two responders today. Recruit in the town with the highest total,
                update the map as if they had joined, and repeat five times.
              </p>
              <p className="mt-2">
                A site going from no responders to one counts, and so does one going from one to
                two, so a deep gap can win twice in a row. Each pick is the best next step rather
                than a guaranteed best set of five, which keeps it simple to explain and quick to
                rerun as the network changes. It stops early if no town would help.
              </p>
              <p className="mt-2">
                Recruiting is not the only lever: where a responder nearby is held back only by
                lapsed paperwork, renewing it is the quicker win.
              </p>
            </div>
          </div>
          <div {...demoTarget('recruitment')}>
            <RecruitmentPlan plan={plan} lapsed={lapsed} />
          </div>
        </div>
      </section>

      <section aria-labelledby="liquidity-heading" className="mt-14">
        <SectionHeading
          id="liquidity-heading"
          title="Liquidity: supply against demand"
          lead="Each cell counts the call-outs requested in that hour over the period, against the eligible responders based in the region with cover at that hour. Demand grows with the length of the period; supply does not, so compare cells within one view."
        />
        <div className="mt-6">
          <LiquidityHeatmap rows={grid} insights={liquidityInsights(grid)} />
        </div>
      </section>
    </article>
  )
}
