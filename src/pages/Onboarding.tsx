import { useSearchParams } from 'react-router'
import { ComplianceTracker } from '@/components/onboarding/ComplianceTracker'
import { DataQualityPanel, type PlantedProblem } from '@/components/onboarding/DataQualityPanel'
import { FunnelView } from '@/components/onboarding/FunnelView'
import { OnboardingQueue } from '@/components/onboarding/OnboardingQueue'
import { RetentionGrid } from '@/components/onboarding/RetentionGrid'
import { PageHeader } from '@/components/PageHeader'
import { SectionHeading } from '@/components/SectionHeading'
import { tabIds } from '@/components/tabIds'
import { TabList, type Tab } from '@/components/Tabs'
import {
  callOuts,
  customers,
  DATA_AS_OF,
  leads,
  onboarding,
  partners,
  responders,
  SEEDED_ISSUE_LABELS,
  SEEDED_ISSUES,
  SEEDED_ONBOARDING_ISSUE_LABELS,
  SEEDED_ONBOARDING_ISSUES,
  sites,
  suppliers,
} from '@/data'
import { complianceRows } from '@/lib/compliance'
import { checkAnswerKey, RULES, runQualityChecks } from '@/lib/dataQuality'
import { formatDate, formatNumber, formatPercent } from '@/lib/format'
import {
  biggestLeak,
  buildFunnel,
  CHECKLISTS,
  onboardingQueue,
  SIDE_LABELS,
  type Funnel,
  type Leak,
  type OnboardingProgress,
} from '@/lib/onboarding'
import { retentionCohorts } from '@/lib/retention'
import { SIDES, type SideId } from '@/lib/scenario'
import { formatSectionNumber, getSection } from '@/nav'

const section = getSection('onboarding')

interface SideView {
  funnel: Funnel
  leak: Leak | null
  queue: OnboardingProgress[]
}

// The data never changes once loaded, so each view is worked out once, when the page opens
const SIDE_VIEWS = Object.fromEntries(
  SIDES.map((side): [SideId, SideView] => {
    const funnel = buildFunnel(onboarding, side, DATA_AS_OF)
    return [
      side,
      {
        funnel,
        leak: biggestLeak(funnel, onboarding, DATA_AS_OF),
        queue: onboardingQueue(onboarding, side, DATA_AS_OF),
      },
    ]
  }),
) as Record<SideId, SideView>

const SIDE_TABS: Tab<SideId>[] = SIDES.map((side) => ({
  id: side,
  label: SIDE_LABELS[side].many,
  count: SIDE_VIEWS[side].funnel.steps[0]?.reached ?? 0,
}))

/** Partners and suppliers are working definitions: see docs/brief.md. */
const WORKING_DEFINITIONS: Partial<Record<SideId, string>> = {
  supplier:
    'Suppliers are a working definition: firms that keep repairs moving, such as switchgear spares, cable and generator hire.',
  partner:
    'Partners are a working definition: organisations that bring customers or capability, such as facilities managers, insurers and consultancies.',
}

const COMPLIANCE = complianceRows(responders, DATA_AS_OF)
const QUALITY = runQualityChecks(
  { customers, sites, responders, suppliers, partners, callOuts, leads, onboarding },
  DATA_AS_OF,
)
const PLANTED: PlantedProblem[] = [
  ...SEEDED_ISSUES.map((i) => ({ ...i, label: SEEDED_ISSUE_LABELS[i.kind] })),
  ...SEEDED_ONBOARDING_ISSUES.map((i) => ({ ...i, label: SEEDED_ONBOARDING_ISSUE_LABELS[i.kind] })),
]
const ANSWER_KEY = checkAnswerKey(QUALITY.issues, PLANTED)
const RETENTION = retentionCohorts(
  onboarding.filter((r) => r.side === 'customer'),
  DATA_AS_OF,
)
const DATASET_COUNT = new Set(RULES.map((r) => r.dataset)).size

const JUMPS = [
  { id: 'funnels', label: 'Funnels' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'data-quality', label: 'Data quality' },
  { id: 'retention', label: 'Retention' },
]

const isSide = (value: string | null): value is SideId => SIDES.some((s) => s === value)

export default function Onboarding() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('side')
  const side: SideId = isSide(requested) ? requested : 'customer'
  const { funnel, leak, queue } = SIDE_VIEWS[side]
  const ids = tabIds('sides', side)
  const yearOn = RETENTION.overall[12]

  return (
    <article>
      <PageHeader
        eyebrow={`Section ${formatSectionNumber(section.number)}`}
        title={section.title}
        lead={section.question}
      >
        <p className="mt-4 leading-relaxed text-pretty text-ink-muted">
          How organisations join the network and whether it can be trusted once they have: a funnel
          for each side, who is onboarding now, whether responders are in date, and whether the data
          itself holds up. Everything is as at {formatDate(DATA_AS_OF)}.
        </p>
        <nav aria-label="On this page" className="mt-6 flex flex-wrap gap-2">
          {JUMPS.map((j) => (
            <a
              key={j.id}
              href={`#${j.id}`}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {j.label}
            </a>
          ))}
        </nav>
      </PageHeader>

      <section id="funnels" aria-labelledby="funnels-heading" className="mt-12 scroll-mt-20">
        <SectionHeading
          id="funnels-heading"
          title="Funnels and onboarding"
          lead="Every organisation from first contact to active use, side by side. Each stage shows how many move on, where the rest went and how long the move takes."
        />
        <div className="mt-6">
          <TabList
            tabs={SIDE_TABS}
            selected={side}
            onSelect={(next) =>
              setParams({ side: next }, { replace: true, preventScrollReset: true })
            }
            label="Side of the ecosystem"
            group="sides"
          />
        </div>

        <div
          role="tabpanel"
          id={ids.panel}
          aria-labelledby={ids.tab}
          tabIndex={0}
          className="mt-6 space-y-6 focus-visible:outline-offset-4"
        >
          {leak && (
            <div className="rounded-xl border border-accent bg-accent-soft px-4 py-3">
              <p className="text-xs font-medium tracking-wide text-accent-ink uppercase">
                Biggest leak
              </p>
              <p className="mt-1 text-sm text-ink">{leak.sentence}</p>
            </div>
          )}
          <FunnelView funnel={funnel} leak={leak} />
          {WORKING_DEFINITIONS[side] && (
            <p className="text-xs text-ink-subtle">{WORKING_DEFINITIONS[side]}</p>
          )}

          <div>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h3 className="text-sm font-semibold text-ink">
                Onboarding now: {formatNumber(queue.length)}
              </h3>
              <p className="text-xs text-ink-subtle">
                Checklist: {CHECKLISTS[side].map((i) => i.label).join(' · ')}
              </p>
            </div>
            <OnboardingQueue side={side} queue={queue} asOf={DATA_AS_OF} />
          </div>
        </div>
      </section>

      <section id="compliance" aria-labelledby="compliance-heading" className="mt-14 scroll-mt-20">
        <SectionHeading
          id="compliance-heading"
          title="Responder compliance"
          lead="HV authorisation, insurance and competence audits for every responder, by how soon each runs out. Matching is judged by the same eligibility rule as the simulator and the coverage map, so anyone shown as excluded here is never offered a job."
        />
        <div className="mt-6">
          <ComplianceTracker rows={COMPLIANCE} asOf={DATA_AS_OF} />
        </div>
      </section>

      <section
        id="data-quality"
        aria-labelledby="data-quality-heading"
        className="mt-14 scroll-mt-20"
      >
        <SectionHeading
          id="data-quality-heading"
          title="Data quality"
          lead={`${formatNumber(RULES.length)} rule-based checks across all ${DATASET_COUNT} datasets, grouped by the five standard dimensions. A three-click request only works if the site, equipment and responder records behind it are right, so every issue comes with the record, the rule it breaks and how to fix it.`}
        />
        <div className="mt-6">
          <DataQualityPanel report={QUALITY} answerKey={ANSWER_KEY} asOf={DATA_AS_OF} />
        </div>
      </section>

      <section id="retention" aria-labelledby="retention-heading" className="mt-14 scroll-mt-20">
        <SectionHeading
          id="retention-heading"
          title="Customer retention"
          lead={`${formatNumber(RETENTION.cancelled)} of ${formatNumber(RETENTION.joined)} customers have cancelled since going live.${
            yearOn === null || yearOn === undefined
              ? ''
              : ` Across every cohort old enough to tell, ${formatPercent(yearOn)} were still members a year in.`
          } Each row is the customers who went live that month; each cell, the share still members at the end of each month after. Quiet members still count here: the funnel shows them separately.`}
        />
        <div className="mt-6">
          <RetentionGrid table={RETENTION} />
        </div>
      </section>
    </article>
  )
}
