import type { CoverageSummary } from '@/lib/coverage'
import { formatNumber, formatPercent } from '@/lib/format'
import type { LapsedResponder, RecruitmentPlan as Plan } from '@/lib/recruitment'

interface RecruitmentPlanProps {
  plan: Plan
  /** Responders held back only by paperwork near each pick, in pick order. */
  lapsed: readonly LapsedResponder[][]
}

const plural = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

export function RecruitmentPlan({ plan, lapsed }: RecruitmentPlanProps) {
  if (plan.picks.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
        No single recruit would add cover in this view: every site that could gain is already
        covered.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <ol className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {plan.picks.map((pick, i) => {
          const again = plan.picks.slice(0, i).filter((p) => p.town.name === pick.town.name).length
          const gains = [
            pick.newlyCovered > 0 && `+${plural(pick.newlyCovered, 'site', 'sites')} covered`,
            pick.firstResponder > 0 &&
              `${plural(pick.firstResponder, 'site', 'sites')} ${pick.firstResponder === 1 ? 'gets' : 'get'} a first responder`,
          ].filter(Boolean)
          const renew = lapsed[i] ?? []
          return (
            <li key={`${pick.town.name}-${i}`} className="grid gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]">
              <span className="text-sm font-semibold text-ink tabular-nums">{i + 1}</span>
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  <span className="font-medium">
                    Recruit {again === 0 ? '' : again === 1 ? 'a second responder ' : 'another '}
                    near {pick.town.name}
                  </span>{' '}
                  <span className="text-ink-muted">→ {gains.join(', ')}</span>
                </p>
                <p className="mt-0.5 text-xs text-ink-subtle">
                  {pick.town.region} · reaches {plural(pick.sitesReached, 'under-covered site', 'under-covered sites')} · criticality +{formatNumber(pick.criticalityGained)}
                </p>
                {renew.length > 0 && (
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">
                    <span className="font-medium text-accent-ink">Quicker win:</span> renew{' '}
                    {renew
                      .map((r) => `${r.responder.name} (${r.reasons.join('; ')})`)
                      .join(', ')}
                    , already within reach.
                  </p>
                )}
              </div>
              <p className="text-sm text-ink tabular-nums sm:text-right">
                <span className="text-ink-subtle">Coverage </span>
                {formatPercent(pick.before.coveredShare)} → {formatPercent(pick.after.coveredShare)}
              </p>
            </li>
          )
        })}
      </ol>
      {plan.stoppedEarly && (
        <p className="text-xs text-ink-subtle">
          The plan stopped after {plural(plan.picks.length, 'pick', 'picks')}: no other town would
          add cover in this view.
        </p>
      )}
      <CoverageBars before={plan.before} after={plan.after} picks={plan.picks.length} />
    </div>
  )
}

const SEGMENTS = [
  { key: 'covered', label: 'Covered', className: 'bg-ink-muted' },
  { key: 'thin', label: 'Thin', className: 'bg-accent' },
  { key: 'uncovered', label: 'Uncovered', className: 'bg-danger' },
] as const

/** Covered, thin and uncovered sites today and after the plan, as two stacked bars. */
function CoverageBars({
  before,
  after,
  picks,
}: {
  before: CoverageSummary
  after: CoverageSummary
  picks: number
}) {
  const rows = [
    { label: 'Today', summary: before },
    { label: `After ${plural(picks, 'recruit', 'recruits')}`, summary: after },
  ]
  return (
    <figure className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <figcaption className="text-sm font-medium text-ink">Coverage before and after</figcaption>
      <div className="mt-3 space-y-3">
        {rows.map(({ label, summary }) => (
          <div key={label} className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[8rem_minmax(0,1fr)_3.5rem]">
            <span className="text-xs text-ink-muted">{label}</span>
            <div
              className="flex h-4 gap-0.5 overflow-hidden rounded-md"
              role="img"
              aria-label={`${label}: ${summary.covered} covered, ${summary.thin} thin, ${summary.uncovered} uncovered`}
            >
              {SEGMENTS.map(({ key, className }) =>
                summary[key] > 0 ? (
                  <div
                    key={key}
                    className={`${className} transition-[flex-grow] duration-500 motion-reduce:transition-none`}
                    style={{ flexGrow: summary[key] }}
                  />
                ) : null,
              )}
            </div>
            <span className="text-sm font-semibold text-ink tabular-nums sm:text-right">
              {formatPercent(summary.coveredShare)}
            </span>
          </div>
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        {SEGMENTS.map(({ key, label, className }) => (
          <li key={key} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-sm ${className}`} aria-hidden="true" />
            {label}: {formatNumber(before[key])} → {formatNumber(after[key])}
          </li>
        ))}
      </ul>
    </figure>
  )
}
