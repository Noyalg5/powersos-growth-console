import { formatMonth, formatNumber, formatPercent } from '@/lib/format'
import type { RetentionTable } from '@/lib/retention'

/**
 * Shading shows cancellations: a cohort nobody has left stays quiet, and the more
 * that have gone, the stronger the cell stands out, in either theme. The share still
 * members is printed in each.
 */
const STEPS = [
  { min: 1, label: '100%', className: 'bg-surface-muted text-ink-subtle' },
  { min: 0.9, label: '90–99%', className: 'bg-seq-1 text-seq-1-ink' },
  { min: 0.75, label: '75–89%', className: 'bg-seq-2 text-seq-2-ink' },
  { min: 0.5, label: '50–74%', className: 'bg-seq-3 text-seq-3-ink' },
  { min: 0, label: 'Under 50%', className: 'bg-seq-4 text-seq-4-ink' },
] as const

const stepFor = (share: number) => STEPS.find((s) => share >= s.min) ?? STEPS[4]

const members = (n: number) => `${formatNumber(n)} ${n === 1 ? 'member' : 'members'}`

/** Customers by the month they went live, and the share still members each month after. */
export function RetentionGrid({ table }: { table: RetentionTable }) {
  const months = Array.from({ length: table.months }, (_, k) => k)

  if (table.cohorts.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
        No customers have been live for a full month yet.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto p-3 sm:p-4">
        <table className="w-full border-separate border-spacing-0.5 text-[11px]">
          <caption className="sr-only">
            Share of each month's new customers still members at the end of each month since they
            went live
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                rowSpan={2}
                className="sticky left-0 z-10 bg-surface pr-2 pb-1 text-left align-bottom text-xs font-medium text-ink-subtle"
              >
                Went live
              </th>
              <th
                scope="col"
                rowSpan={2}
                className="pr-2 pb-1 text-right align-bottom text-xs font-medium text-ink-subtle"
              >
                Customers
              </th>
              <th
                scope="colgroup"
                colSpan={table.months}
                className="pb-1 text-left text-xs font-medium text-ink-subtle"
              >
                Months since going live
              </th>
            </tr>
            <tr>
              {months.map((k) => (
                <th
                  key={k}
                  scope="col"
                  className="min-w-8 pb-1 text-center font-normal text-ink-subtle tabular-nums"
                >
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.cohorts.map((cohort) => (
              <tr key={cohort.month}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface pr-2 text-left text-xs font-normal whitespace-nowrap text-ink-muted"
                >
                  {formatMonth(cohort.month)}
                </th>
                <td className="pr-2 text-right text-xs text-ink-muted tabular-nums">
                  {formatNumber(cohort.size)}
                </td>
                {months.map((k) => {
                  const left = cohort.retained[k]
                  if (left === undefined) return <td key={k} />
                  const share = left / cohort.size
                  const label = `${formatMonth(cohort.month)} cohort, month ${k}: ${members(left)} of ${formatNumber(cohort.size)} (${formatPercent(share)})`
                  return (
                    <td
                      key={k}
                      title={label}
                      aria-label={label}
                      className={`h-7 rounded text-center tabular-nums ${stepFor(share).className}`}
                    >
                      {formatPercent(share)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-surface pt-1.5 pr-2 text-left text-xs font-semibold whitespace-nowrap text-ink"
              >
                All cohorts
              </th>
              <td className="pt-1.5 pr-2 text-right text-xs font-semibold text-ink tabular-nums">
                {formatNumber(table.joined)}
              </td>
              {table.overall.map((share, k) => {
                if (share === null) return <td key={k} />
                const label = `All cohorts, month ${k}: ${formatPercent(share)} of ${formatNumber(table.measured[k] ?? 0)} customers still members`
                return (
                  <td key={k} className="pt-1.5">
                    <span
                      title={label}
                      aria-label={label}
                      className={`flex h-7 items-center justify-center rounded font-semibold tabular-nums ${stepFor(share).className}`}
                    >
                      {formatPercent(share)}
                    </span>
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line px-4 py-3 text-xs text-ink-muted">
        <span>Share still members; the more that cancel, the stronger the colour:</span>
        {STEPS.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5">
            <span className={`size-3 rounded-sm ${s.className}`} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}
