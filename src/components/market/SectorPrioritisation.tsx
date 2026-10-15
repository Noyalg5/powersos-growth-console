import { useMemo } from 'react'
import { ResetBar } from '@/components/ResetBar'
import { Tag } from '@/components/Tag'
import type { Persisted } from '@/components/usePersistentState'
import { demoTarget } from '@/demo'
import { formatDate, formatNumber } from '@/lib/format'
import {
  CRITERIA,
  DEFAULT_RATIONALE,
  DEFAULT_SECTOR_INPUTS,
  hasWeight,
  sensitivity,
  SENSITIVITY_STEP,
  TOP_N,
  WEIGHT_MAX,
  type CriterionId,
  type GoFirst,
  type SectorEvidence,
  type SectorInfo,
  type SectorInputs,
  type SectorResult,
  type Sensitivity,
  type TopChange,
} from '@/lib/sectorScoring'
import type { SectorId } from '@/types'
import { PriorityMatrix } from './PriorityMatrix'
import { RankedTable, ScoreEditor } from './SectorTables'
import { WeightControls } from './WeightControls'

interface SectorPrioritisationProps {
  sectors: readonly SectorInfo[]
  state: Persisted<SectorInputs>
  /** Null while every weight is zero. */
  ranked: readonly SectorResult[] | null
  pick: GoFirst | null
  evidence: Readonly<Record<SectorId, SectorEvidence>>
  /** How the evidence was measured, in a sentence. */
  evidenceNote: string
  asOf: number
}

const VERDICT_STYLE: Record<Sensitivity['verdict'], string> = {
  robust: 'border-line bg-surface text-ink',
  'leader-holds': 'border-line bg-surface text-ink',
  'leader-changes': 'border-accent bg-surface text-accent-ink',
}

const CHANGE_LABELS: Record<TopChange, string> = {
  none: 'No change',
  order: 'Order changes',
  members: `Top ${TOP_N} changes`,
}

const criterionLabel = (id: CriterionId) => CRITERIA.find((c) => c.id === id)?.phrase ?? id

/** Tab 1: score the nine sectors, see where they sit, and which to go after first. */
export function SectorPrioritisation({
  sectors,
  state,
  ranked,
  pick,
  evidence,
  evidenceNote,
  asOf,
}: SectorPrioritisationProps) {
  const { weights, scores } = state.value
  const check = useMemo(
    () => (hasWeight(weights) ? sensitivity(sectors, scores, weights) : null),
    [sectors, scores, weights],
  )
  const label = (id: SectorId) => sectors.find((s) => s.id === id)?.label ?? id

  const setWeight = (id: CriterionId, weight: number) =>
    state.set({ ...state.value, weights: { ...weights, [id]: weight } })
  const setScore = (sector: SectorId, criterion: CriterionId, score: number) =>
    state.set({
      ...state.value,
      scores: { ...scores, [sector]: { ...scores[sector], [criterion]: score } },
    })

  return (
    <div className="space-y-8">
      <ResetBar
        edited={state.edited}
        saved={state.saved}
        onReset={state.reset}
        what="sector scores and weights"
      >
        <Tag kind="assumption" />
        <span>Default scores and weights.</span>
        <Tag kind="synthetic" />
        <span>Evidence from the network, as at {formatDate(asOf)}.</span>
      </ResetBar>

      <div
        className="rounded-xl border border-accent bg-accent-soft px-4 py-4 sm:px-5"
        {...demoTarget('go-first')}
      >
        <p className="text-xs font-medium tracking-wide text-accent-ink uppercase">Go first</p>
        {pick ? (
          <>
            <p className="mt-1 text-xl font-semibold tracking-tight text-ink">{pick.label}</p>
            <p className="mt-1 max-w-3xl text-sm text-ink" aria-live="polite">
              {pick.sentence}
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-ink">
            Every weight is zero. Give at least one criterion some weight to rank the sectors.
          </p>
        )}
        {check && (
          <div className="mt-3 flex flex-wrap items-start gap-x-2 gap-y-1 border-t border-accent/40 pt-3">
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${VERDICT_STYLE[check.verdict]}`}
            >
              Weight check
            </span>
            <p className="min-w-0 flex-1 basis-64 text-sm text-ink" aria-live="polite">
              {check.sentence}
            </p>
          </div>
        )}
      </div>

      <section aria-labelledby="weights-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 id="weights-heading" className="text-sm font-semibold text-ink">
            Weights
          </h3>
          <p className="text-xs text-ink-subtle">
            Out of {formatNumber(WEIGHT_MAX)}. Only the proportions matter: they are scaled to add
            up to 100%.
          </p>
        </div>
        <WeightControls
          weights={weights}
          defaults={DEFAULT_SECTOR_INPUTS.weights}
          onChange={setWeight}
        />
      </section>

      {ranked && (
        <section aria-labelledby="matrix-heading">
          <h3 id="matrix-heading" className="mb-3 text-sm font-semibold text-ink">
            Where each sector sits
          </h3>
          <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <PriorityMatrix results={ranked} evidence={evidence} leader={pick?.sector ?? null} />
            <RankedTable results={ranked} />
          </div>
        </section>
      )}

      <section aria-labelledby="scores-heading">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 id="scores-heading" className="text-sm font-semibold text-ink">
            Scores and evidence
          </h3>
          <p className="text-xs text-ink-subtle">
            Change any score; edited scores are outlined. {evidenceNote}
          </p>
        </div>
        <ScoreEditor
          sectors={sectors}
          scores={scores}
          defaults={DEFAULT_SECTOR_INPUTS.scores}
          evidence={evidence}
          onChange={setScore}
        />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-ink">
              Why these default scores
            </summary>
            <dl className="mt-3 space-y-2">
              {sectors.map((s) => (
                <div key={s.id}>
                  <dt className="font-medium text-ink">{s.label}</dt>
                  <dd className="text-ink-muted">{DEFAULT_RATIONALE[s.id]}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-ink-subtle">
              Starting points from desk knowledge of each sector, to validate with MPN and early
              customers.
            </p>
          </details>
          {check && (
            <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
              <summary className="cursor-pointer font-medium text-ink">
                Sensitivity check: all {formatNumber(check.cases.length)} weight changes
              </summary>
              <p className="mt-2 text-xs text-ink-subtle">
                Each row moves one weight {Math.round(SENSITIVITY_STEP * 100)}% up or down, leaves
                the rest alone and ranks the sectors again. Today's top {TOP_N}:{' '}
                {check.baseline.map(label).join(', ')}.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[28rem] text-xs">
                  <thead>
                    <tr className="border-b border-line text-left text-ink-subtle">
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Change
                      </th>
                      <th scope="col" className="py-2 pr-3 font-medium">
                        Top {TOP_N}
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Result
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {check.cases.map((c) => (
                      <tr key={`${c.criterion}-${c.direction}`}>
                        <th scope="row" className="py-2 pr-3 text-left font-normal text-ink-muted">
                          {c.direction === 'up' ? 'More' : 'Less'} weight on{' '}
                          {criterionLabel(c.criterion)}
                        </th>
                        <td className="py-2 pr-3 text-ink">{c.top.map(label).join(', ')}</td>
                        <td
                          className={`py-2 whitespace-nowrap ${c.change === 'none' ? 'text-ink-subtle' : 'font-medium text-accent-ink'}`}
                        >
                          {CHANGE_LABELS[c.change]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      </section>
    </div>
  )
}
