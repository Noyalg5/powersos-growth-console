import { formatNumber, formatPercent } from '@/lib/format'
import {
  AXIS_LABELS,
  CRITERIA,
  hasWeight,
  normaliseWeights,
  WEIGHT_MAX,
  type Axis,
  type CriterionId,
  type Weights,
} from '@/lib/sectorScoring'

interface WeightControlsProps {
  weights: Weights
  defaults: Weights
  onChange: (id: CriterionId, weight: number) => void
}

const AXES: Axis[] = ['attractiveness', 'ability']

/** A slider per criterion, grouped by the axis it feeds, with each one's share of the score. */
export function WeightControls({ weights, defaults, onChange }: WeightControlsProps) {
  const shares = hasWeight(weights) ? normaliseWeights(weights) : null

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {AXES.map((axis) => {
        const criteria = CRITERIA.filter((c) => c.axis === axis)
        const share = shares && criteria.reduce((sum, c) => sum + shares[c.id], 0)
        return (
          <fieldset key={axis} className="min-w-0 rounded-xl border border-line bg-surface p-4">
            <legend className="sr-only">{AXIS_LABELS[axis]} weights</legend>
            <div className="flex items-baseline justify-between gap-3" aria-hidden="true">
              <h4 className="text-sm font-semibold text-ink">{AXIS_LABELS[axis]}</h4>
              <span className="text-xs text-ink-subtle tabular-nums">
                {share === null ? '—' : `${formatPercent(share)} of the score`}
              </span>
            </div>
            <div className="mt-3 space-y-4">
              {criteria.map((c) => {
                const id = `weight-${c.id}`
                const weight = weights[c.id]
                const edited = weight !== defaults[c.id]
                return (
                  <div key={c.id}>
                    <div className="flex items-baseline justify-between gap-3">
                      <label htmlFor={id} className="text-sm text-ink">
                        {c.label}
                        {edited && <span className="sr-only"> (edited)</span>}
                      </label>
                      <span className="text-xs whitespace-nowrap text-ink-muted tabular-nums">
                        <span className={edited ? 'font-semibold text-ink' : ''}>
                          {formatNumber(weight, 1)}
                        </span>
                        {' · '}
                        {shares ? formatPercent(shares[c.id]) : '—'}
                      </span>
                    </div>
                    <input
                      id={id}
                      type="range"
                      min={0}
                      max={WEIGHT_MAX}
                      step={0.5}
                      value={weight}
                      onChange={(e) => onChange(c.id, Number(e.target.value))}
                      aria-valuetext={`${formatNumber(weight, 1)} of ${WEIGHT_MAX}${shares ? `, ${formatPercent(shares[c.id])} of the score` : ''}`}
                      className="mt-1 w-full accent-accent"
                    />
                    <p className="text-[11px] leading-relaxed text-ink-subtle">
                      1: {c.low}. 5: {c.high}.
                      {!c.higherIsBetter && ' Counts against: a high score lowers the total.'}
                    </p>
                  </div>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}
