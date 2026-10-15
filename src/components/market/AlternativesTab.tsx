import { useMemo, useState } from 'react'
import { ResetBar } from '@/components/ResetBar'
import { Tag } from '@/components/Tag'
import type { Persisted } from '@/components/usePersistentState'
import {
  DEFAULT_COMPARISON,
  factorVerdicts,
  suggestedPositioning,
  summariseComparison,
  type AlternativesInputs,
  type FactorId,
  type OptionId,
  type Positioning,
  type PositioningField,
  type Rating,
} from '@/lib/positioning'
import type { SectorId } from '@/types'
import { ComparisonGrid } from './ComparisonGrid'
import { PositioningBuilder } from './PositioningBuilder'

interface AlternativesTabProps {
  state: Persisted<AlternativesInputs>
  /** The current top sector from the first tab, or null while it can't be ranked. */
  topSector: { id: SectorId; label: string } | null
}

/** Tab 2: what organisations do about HV emergencies today, and how PowerSOS is positioned. */
export function AlternativesTab({ state, topSector }: AlternativesTabProps) {
  const [editing, setEditing] = useState(false)
  const { comparison, positioning } = state.value
  const verdicts = useMemo(() => factorVerdicts(comparison), [comparison])
  const summary = useMemo(() => summariseComparison(comparison), [comparison])
  // While no sector can be ranked, fall back to the default leader so the fields still read well
  const suggested: Positioning = useMemo(
    () => suggestedPositioning(topSector?.id ?? 'telecoms', comparison),
    [topSector, comparison],
  )

  const setCell = (option: OptionId, factor: FactorId, patch: { rating?: Rating; note?: string }) =>
    state.set({
      ...state.value,
      comparison: {
        ...comparison,
        [option]: {
          ...comparison[option],
          [factor]: { ...comparison[option][factor], ...patch },
        },
      },
    })

  const setField = (field: PositioningField, text: string | null) => {
    const next = { ...positioning }
    if (text === null) delete next[field]
    else next[field] = text
    state.set({ ...state.value, positioning: next })
  }

  return (
    <div className="space-y-8">
      <ResetBar
        edited={state.edited}
        saved={state.saved}
        onReset={() => {
          setEditing(false)
          state.reset()
        }}
        what="ratings, notes and positioning"
      >
        <Tag kind="assumption" />
        <span>
          Default ratings and notes. Generic categories only: no real company is named or rated.
        </span>
      </ResetBar>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
            Where PowerSOS wins
          </p>
          <p className="mt-1 text-sm text-ink" aria-live="polite">
            {summary.winsSentence}
          </p>
        </div>
        <div className="rounded-xl border border-accent bg-accent-soft p-4">
          <p className="text-xs font-medium tracking-wide text-accent-ink uppercase">
            Where it is weakest
          </p>
          <p className="mt-1 text-sm text-ink" aria-live="polite">
            {summary.weakestSentence}
          </p>
        </div>
      </div>

      <section aria-labelledby="comparison-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div>
            <h3 id="comparison-heading" className="text-sm font-semibold text-ink">
              How organisations handle an HV emergency today
            </h3>
            <p className="mt-0.5 text-xs text-ink-subtle">
              Strong, Partial or Weak, always read so that Strong is good for the customer. The
              PowerSOS column rests only on its public claims.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={editing}
            onClick={() => setEditing(!editing)}
            className={`inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition-colors ${
              editing
                ? 'border-accent bg-accent-soft text-ink'
                : 'border-line bg-surface text-ink hover:bg-surface-muted'
            }`}
          >
            {editing ? 'Done editing' : 'Edit ratings and notes'}
          </button>
        </div>
        <ComparisonGrid
          comparison={comparison}
          defaults={DEFAULT_COMPARISON}
          verdicts={verdicts}
          editing={editing}
          onChange={setCell}
        />
      </section>

      <section aria-labelledby="positioning-heading">
        <div className="mb-3">
          <h3 id="positioning-heading" className="text-sm font-semibold text-ink">
            Positioning statement
          </h3>
          <p className="mt-0.5 text-xs text-ink-subtle">
            For [segment] who [need], PowerSOS is [category] that [benefit], unlike [alternative].
          </p>
        </div>
        <PositioningBuilder
          suggested={suggested}
          sectorLabel={topSector?.label ?? null}
          edits={positioning}
          onEdit={setField}
        />
      </section>
    </div>
  )
}
