import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRightIcon, PlayIcon } from '@/components/icons'
import { KpiRow } from '@/components/network/KpiRow'
import { AssumptionsPanel } from '@/components/overview/AssumptionsPanel'
import { FirstNinetyDays } from '@/components/overview/FirstNinetyDays'
import { useSaved } from '@/components/usePersistentState'
import {
  callOuts,
  customers,
  DATA_AS_OF,
  leads,
  onboarding,
  responders,
  SECTORS,
  sites,
  TOWNS,
} from '@/data'
import { PRICING_DEFAULTS } from '@/data/evidence'
import { BOARD_OPTIONS, NO_MOVES, restoreMoves } from '@/data/pipeline'
import { demoTarget } from '@/demo'
import { modelAssumptions } from '@/lib/assumptions'
import { COVERED_MIN_RESPONDERS } from '@/lib/coverage'
import { formatDate, formatGBP, formatNumber, formatPercent } from '@/lib/format'
import { RESPONSE_TARGET_MINUTES } from '@/lib/geo'
import { dataBounds, defaultFilters } from '@/lib/networkFilters'
import { networkView } from '@/lib/networkHealth'
import { ACTIVE_WINDOW_DAYS, SIDE_LABELS } from '@/lib/onboarding'
import { sideSnapshot } from '@/lib/overview'
import {
  buildBoard,
  stageTotals,
  unweightedPipelineValue,
  weightedPipelineValue,
} from '@/lib/pipeline'
import {
  DEFAULT_SECTOR_INPUTS,
  formatScore,
  hasWeight,
  rankSectors,
  restoreSectorInputs,
  TOP_N,
} from '@/lib/sectorScoring'
import { sectionPath } from '@/nav'
import { useDemoStore } from '@/store/demo'
import { STORAGE_KEYS } from '@/storageKeys'
import type { SideId } from '@/types'

// The data never changes once loaded, so the network figures are worked out once
const NETWORK = networkView(
  defaultFilters(dataBounds(DATA_AS_OF)),
  { customers, sites, responders, callOuts },
  TOWNS,
  DATA_AS_OF,
)
const TOP_GAPS = NETWORK.gaps.slice(0, 3)
const FIRST_PICK = NETWORK.plan.picks[0] ?? null

/** In the order of the brief: the two public sides, then the two working definitions. */
const SIDES: readonly { id: SideId; workingDefinition: boolean }[] = [
  { id: 'customer', workingDefinition: false },
  { id: 'responder', workingDefinition: false },
  { id: 'partner', workingDefinition: true },
  { id: 'supplier', workingDefinition: true },
]
const SIDES_NOW = SIDES.map((side) => ({ ...side, ...sideSnapshot(onboarding, side.id, DATA_AS_OF) }))

const pounds = (n: number) => formatGBP(n, { pence: false })
const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

function Card({
  title,
  to,
  linkLabel,
  children,
}: {
  title: string
  to: string
  /** Where the link goes, read by screen readers after "Open". */
  linkLabel: string
  children: ReactNode
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <MoreLink to={to} label={linkLabel} />
      </div>
      <div className="mt-3 flex flex-1 flex-col">{children}</div>
    </section>
  )
}

function MoreLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="group inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink-muted hover:text-ink"
    >
      {label}
      <ArrowRightIcon
        width={14}
        height={14}
        className="transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
      />
    </Link>
  )
}

/** A short closing line at the foot of a card. */
function Footnote({ children }: { children: ReactNode }) {
  return <p className="mt-auto border-t border-line pt-2.5 text-sm text-ink">{children}</p>
}

export default function Overview() {
  const start = useDemoStore((s) => s.go)

  const sectorInputs = useSaved(STORAGE_KEYS.marketSectors, DEFAULT_SECTOR_INPUTS, restoreSectorInputs)
  const { weights, scores } = sectorInputs.value
  const ranked = hasWeight(weights) ? rankSectors(SECTORS, scores, weights) : null
  const topSectors = ranked?.slice(0, TOP_N) ?? []

  const moves = useSaved(STORAGE_KEYS.pipelineCrm, NO_MOVES, restoreMoves)
  const board = buildBoard(leads, moves.value, BOARD_OPTIONS)
  const totals = stageTotals(board.cards)
  const live = totals.find((t) => t.stage.id === 'live')?.cards ?? 0
  const closest = [...totals].reverse().find((t) => t.stage.id !== 'live' && t.cards > 0)
  const open = board.cards.length - live

  const assumptions = modelAssumptions({
    weights,
    weightsEdited: sectorInputs.edited,
    pricing: PRICING_DEFAULTS,
    asOf: DATA_AS_OF,
  })

  const topSector = topSectors[0]?.label
  const biggestGap = TOP_GAPS[0]?.town
  const today =
    topSector || biggestGap
      ? `Today: ${[topSector && `top sector ${topSector}`, biggestGap && `biggest gap around ${biggestGap}`].filter(Boolean).join('; ')}.`
      : null

  return (
    <article className="space-y-4">
      <header className="flex flex-col gap-x-8 gap-y-4 pb-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs tracking-wider text-accent-ink uppercase">
            Overview · as at {formatDate(DATA_AS_OF)}
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-balance text-ink sm:text-3xl">
            Growing a four-sided emergency-response ecosystem
          </h1>
          <p className="mt-2 leading-relaxed text-pretty text-ink-muted">
            Where the network stands, where to focus next and my plan for the first 90 days.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-pretty text-ink-subtle">
            Public facts (powersos.co.uk): {formatNumber(RESPONSE_TARGET_MINUTES)}-minute target
            response, 24/7 across mainland UK, three-click requests, unlimited call-outs. Everything
            else is synthetic.
          </p>
        </div>
        <button
          type="button"
          data-demo-start
          onClick={() => start('start')}
          className="inline-flex h-10 shrink-0 items-center gap-2 self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-95 sm:self-auto"
        >
          <PlayIcon width={16} height={16} />
          Start demo
        </button>
      </header>

      <div className="space-y-4" {...demoTarget('overview')}>
        <section aria-labelledby="health-heading">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="health-heading" className="text-sm font-semibold text-ink">
              Network health
              <span className="ml-2 text-xs font-normal text-ink-subtle">
                Last 12 months, weekday daytime cover
              </span>
            </h2>
            <MoreLink to={sectionPath('network')} label="Coverage map" />
          </div>
          <KpiRow kpis={NETWORK.kpis} compact />
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card title="Top coverage gaps" to={sectionPath('network')} linkLabel="Recruitment plan">
            {TOP_GAPS.length === 0 ? (
              <p className="text-sm text-ink-muted">
                Every site has {formatNumber(COVERED_MIN_RESPONDERS)} or more eligible responders
                in reach.
              </p>
            ) : (
              <ol className="mb-3 space-y-1.5">
                {TOP_GAPS.map((gap, i) => (
                  <li key={gap.town} className="flex items-baseline gap-2 text-sm">
                    <span className="w-3 shrink-0 text-xs text-ink-subtle tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink" title={gap.region}>
                      {gap.town}
                    </span>
                    <span className="text-xs whitespace-nowrap text-ink-muted tabular-nums">
                      {[
                        gap.uncovered > 0 && `${formatNumber(gap.uncovered)} uncovered`,
                        gap.thin > 0 && `${formatNumber(gap.thin)} thin`,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <Footnote>
              {FIRST_PICK ? (
                <>
                  <span className="font-medium">First recruit: near {FIRST_PICK.town.name}.</span>{' '}
                  <span className="text-ink-muted">
                    Sites covered: {formatPercent(FIRST_PICK.before.coveredShare)} →{' '}
                    {formatPercent(FIRST_PICK.after.coveredShare)}.
                  </span>
                </>
              ) : (
                <span className="text-ink-muted">No single recruit would add cover today.</span>
              )}
            </Footnote>
          </Card>

          <Card title="Priority sectors" to={sectionPath('market')} linkLabel="Sector scores">
            {topSectors.length === 0 ? (
              <p className="mb-3 text-sm text-ink-muted">
                Every weight is zero in Market strategy, so no sector is ranked.
              </p>
            ) : (
              <ol className="mb-3 space-y-1.5">
                {topSectors.map((s) => (
                  <li key={s.sector} className="flex items-baseline gap-2 text-sm">
                    <span className="w-3 shrink-0 text-xs text-ink-subtle tabular-nums">{s.rank}</span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">{s.label}</span>
                    <span className="text-xs whitespace-nowrap text-ink-muted tabular-nums">
                      {formatScore(s.score)} of 5
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <Footnote>
              <span className="text-ink-muted">
                {sectorInputs.edited
                  ? 'Ranked on your saved weights and scores.'
                  : 'Default weights; your edits in Market strategy show here.'}
              </span>
            </Footnote>
          </Card>

          <Card title="Early-adopter pipeline" to={sectionPath('pipeline')} linkLabel="CRM">
            <p className="text-xs text-ink-subtle">Weighted pipeline value, a year</p>
            <p className="text-xl font-semibold tracking-tight text-ink tabular-nums">
              {pounds(weightedPipelineValue(board.cards))}
            </p>
            <p className="mb-3 text-xs text-ink-muted">
              Of {pounds(unweightedPipelineValue(board.cards))} across{' '}
              {plural(board.cards.length, 'deal')}
              {moves.edited && ', with your card moves'}
            </p>
            <Footnote>
              <span className="font-medium">
                {plural(live, 'early adopter', 'early adopters')} live.
              </span>{' '}
              <span className="text-ink-muted">
                {open === 0
                  ? 'No deals are still open.'
                  : closest && `Closest: ${plural(closest.cards, 'deal')} at ${closest.stage.label}.`}
              </span>
            </Footnote>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section
          aria-labelledby="sides-heading"
          className="flex flex-col rounded-xl border border-line bg-surface p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="sides-heading" className="text-sm font-semibold text-ink">
              The four sides
            </h2>
            <MoreLink to={sectionPath('onboarding')} label="Funnels" />
          </div>
          <ul className="mt-3 space-y-1.5">
            {SIDES_NOW.map((side) => (
              <li key={side.id} className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-2 text-sm">
                <span className="font-medium text-ink">
                  {SIDE_LABELS[side.id].many}
                  {side.workingDefinition && <span className="text-ink-subtle">*</span>}
                </span>
                <span className="text-ink-muted tabular-nums">
                  {formatNumber(side.live)} live · {formatNumber(side.active)} active ·{' '}
                  {formatNumber(side.onboarding)} onboarding
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-3 text-xs leading-relaxed text-ink-subtle">
            Active: used the platform in the last {formatNumber(ACTIVE_WINDOW_DAYS)} days. *Partners
            and suppliers are working definitions.
          </p>
        </section>

        <FirstNinetyDays today={today} />
      </div>

      <AssumptionsPanel groups={assumptions} />
    </article>
  )
}
