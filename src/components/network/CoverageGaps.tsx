import { useState } from 'react'
import type { GapArea } from '@/lib/coverage'
import { formatNumber } from '@/lib/format'

const SHOWN = 8

/** Thin and uncovered sites by nearest anchor town, most critical first. */
export function CoverageGaps({ gaps }: { gaps: readonly GapArea[] }) {
  const [all, setAll] = useState(false)
  const rows = all ? gaps : gaps.slice(0, SHOWN)
  const maxCriticality = Math.max(1, ...gaps.map((g) => g.criticality))

  if (gaps.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
        Every site in this view has two or more eligible responders within reach.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <caption className="sr-only">
            Coverage gaps by nearest anchor town, ranked by total criticality
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Area
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Uncovered
              </th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">
                Thin
              </th>
              <th scope="col" className="w-[38%] px-4 py-2.5 font-medium">
                Criticality at risk
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((gap) => (
              <tr key={gap.town} className="align-top">
                <th scope="row" className="px-4 py-3 text-left font-normal">
                  <span className="block font-medium text-ink">{gap.town}</span>
                  <span className="block text-xs text-ink-subtle">{gap.region}</span>
                  <span
                    className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted"
                    title={gap.sites.map((s) => s.site.name).join(', ')}
                  >
                    {gap.sites.map((s) => s.site.name).join(', ')}
                  </span>
                </th>
                <td className="px-3 py-3 text-right text-ink tabular-nums">
                  {gap.uncovered > 0 ? formatNumber(gap.uncovered) : '–'}
                </td>
                <td className="px-3 py-3 text-right text-ink tabular-nums">
                  {gap.thin > 0 ? formatNumber(gap.thin) : '–'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-ink-muted"
                        style={{ width: `${(gap.criticality / maxCriticality) * 100}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-ink tabular-nums">
                      {formatNumber(gap.criticality)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {gaps.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          className="w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          {all ? 'Show the top areas only' : `Show all ${gaps.length} areas`}
        </button>
      )}
    </div>
  )
}
