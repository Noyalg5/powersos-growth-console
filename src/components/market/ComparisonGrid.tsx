import {
  FACTORS,
  NOTE_MAX_LENGTH,
  OPTIONS,
  RATING_LABELS,
  RATINGS,
  type Comparison,
  type FactorId,
  type FactorVerdict,
  type OptionId,
  type Rating,
} from '@/lib/positioning'

interface ComparisonGridProps {
  comparison: Comparison
  defaults: Comparison
  verdicts: readonly FactorVerdict[]
  editing: boolean
  onChange: (option: OptionId, factor: FactorId, patch: { rating?: Rating; note?: string }) => void
}

/** Full, half or empty: the rating reads by shape as well as by its word. */
export function RatingMark({ rating }: { rating: Rating }) {
  return (
    <svg viewBox="0 0 14 14" width={14} height={14} aria-hidden="true" className="shrink-0">
      <circle cx={7} cy={7} r={5.75} className="fill-none stroke-ink" strokeWidth={1.5} />
      {rating === 'strong' && <circle cx={7} cy={7} r={5.75} className="fill-ink" />}
      {rating === 'partial' && <path d="M7 1.25a5.75 5.75 0 0 1 0 11.5Z" className="fill-ink" />}
    </svg>
  )
}

const OUTCOME_LABELS: Record<FactorVerdict['outcome'], string> = {
  wins: 'PowerSOS wins',
  level: 'Level',
  behind: 'Behind',
}

/** How each way of handling an HV emergency compares, factor by factor. */
export function ComparisonGrid({
  comparison,
  defaults,
  verdicts,
  editing,
  onChange,
}: ComparisonGridProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[62rem] text-sm">
        <caption className="sr-only">
          Ways of handling an HV emergency rated Strong, Partial or Weak on six factors, with
          PowerSOS in the last column
        </caption>
        <thead>
          <tr className="border-b border-line text-left align-bottom text-xs text-ink-subtle">
            <th scope="col" className="sticky left-0 z-10 w-44 bg-surface px-4 py-3 font-medium">
              Factor
            </th>
            {OPTIONS.map((o) => (
              <th
                key={o.id}
                scope="col"
                className={`px-3 py-3 font-medium ${o.id === 'powersos' ? 'bg-surface-muted text-ink' : ''}`}
              >
                {o.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {FACTORS.map((f) => {
            const verdict = verdicts.find((v) => v.factor === f.id)
            return (
              <tr key={f.id} className="align-top">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-4 py-3 text-left font-medium text-ink"
                >
                  {f.label}
                  <span className="mt-0.5 block text-xs font-normal text-ink-subtle">
                    Strong: {f.strong.toLowerCase()}
                  </span>
                  {verdict && (
                    <span
                      className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                        verdict.outcome === 'wins'
                          ? 'border-ink-muted text-ink'
                          : verdict.outcome === 'behind'
                            ? 'border-accent text-accent-ink'
                            : 'border-line text-ink-subtle'
                      }`}
                    >
                      {OUTCOME_LABELS[verdict.outcome]}
                    </span>
                  )}
                </th>
                {OPTIONS.map((o) => {
                  const cell = comparison[o.id][f.id]
                  const original = defaults[o.id][f.id]
                  const edited = cell.rating !== original.rating || cell.note !== original.note
                  const name = `${o.label}, ${f.label}`
                  return (
                    <td
                      key={o.id}
                      className={`px-3 py-3 ${o.id === 'powersos' ? 'bg-surface-muted' : ''}`}
                    >
                      {editing ? (
                        <div className="space-y-1.5">
                          <select
                            value={cell.rating}
                            onChange={(e) =>
                              onChange(o.id, f.id, { rating: e.target.value as Rating })
                            }
                            aria-label={`${name}: rating`}
                            className="h-8 w-full rounded-md border border-line bg-surface px-1.5 text-sm text-ink focus-visible:border-accent"
                          >
                            {RATINGS.map((r) => (
                              <option key={r} value={r}>
                                {RATING_LABELS[r]}
                              </option>
                            ))}
                          </select>
                          <textarea
                            value={cell.note}
                            maxLength={NOTE_MAX_LENGTH}
                            rows={2}
                            onChange={(e) => onChange(o.id, f.id, { note: e.target.value })}
                            aria-label={`${name}: note`}
                            className="w-full resize-none rounded-md border border-line bg-surface px-2 py-1 text-xs leading-snug text-ink focus-visible:border-accent"
                          />
                        </div>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5 font-medium text-ink">
                            <RatingMark rating={cell.rating} />
                            {RATING_LABELS[cell.rating]}
                            {edited && (
                              <span className="text-[11px] font-normal text-ink-subtle">
                                (edited)
                              </span>
                            )}
                          </span>
                          {cell.note && (
                            <span className="mt-1 block text-xs leading-snug text-ink-muted">
                              {cell.note}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
