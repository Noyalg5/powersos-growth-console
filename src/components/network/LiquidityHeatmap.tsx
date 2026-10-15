import { formatHour, formatNumber } from '@/lib/format'
import type { LiquidityRow } from '@/lib/liquidity'
import { isOvernightHour } from '@/lib/time'

interface LiquidityHeatmapProps {
  rows: readonly LiquidityRow[]
  insights: readonly string[]
}

const STEP_CLASSES = [
  '',
  'bg-seq-1 text-seq-1-ink',
  'bg-seq-2 text-seq-2-ink',
  'bg-seq-3 text-seq-3-ink',
  'bg-seq-4 text-seq-4-ink',
  'bg-seq-5 text-seq-5-ink',
] as const

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
/** Header labels every three hours. */
const LABELLED = HOURS.filter((h) => h % 3 === 0)

const responders = (n: number) => `${formatNumber(n)} ${n === 1 ? 'responder' : 'responders'}`
const callOuts = (n: number) => `${formatNumber(n)} ${n === 1 ? 'call-out' : 'call-outs'}`

/** Call-out demand against responders on cover, by region and hour of the day. */
export function LiquidityHeatmap({ rows, insights }: LiquidityHeatmapProps) {
  const max = Math.max(1, ...rows.flatMap((r) => r.cells.map((c) => c.demand)))
  const step = (demand: number) => (demand === 0 ? 0 : Math.max(1, Math.ceil((demand / max) * 5)))

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-accent bg-accent-soft px-4 py-3">
        <p className="text-xs font-medium tracking-wide text-accent-ink uppercase">Insight</p>
        <ul className="mt-1 space-y-1 text-sm text-ink">
          {insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto p-3 sm:p-4">
          <table className="w-full min-w-[46rem] border-separate border-spacing-0.5 text-[11px]">
            <caption className="sr-only">
              Call-outs by region and hour of request, against eligible responders based in the
              region with cover at that hour
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-36 pb-1 text-left font-medium text-ink-subtle">
                  Region
                </th>
                {LABELLED.map((h) => (
                  <th
                    key={h}
                    scope="colgroup"
                    colSpan={3}
                    className="pb-1 text-left font-normal text-ink-subtle tabular-nums"
                  >
                    {formatHour(h)}
                  </th>
                ))}
                <th scope="col" className="w-20 pb-1 pl-2 text-right font-medium text-ink-subtle">
                  On cover
                </th>
              </tr>
              <tr aria-hidden="true">
                <td />
                {HOURS.map((h) => (
                  <td
                    key={h}
                    className={`h-1 rounded-full ${isOvernightHour(h) ? 'bg-ink-subtle' : ''}`}
                  />
                ))}
                <td />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.region}>
                  <th
                    scope="row"
                    className="truncate pr-2 text-left text-xs font-normal text-ink-muted"
                  >
                    {row.region}
                  </th>
                  {row.cells.map((cell) => {
                    const label = `${row.region}, ${formatHour(cell.hour)}: ${callOuts(cell.demand)}, ${responders(cell.supply)} on cover${cell.short ? '. Demand outstrips supply' : ''}`
                    return (
                      <td
                        key={cell.hour}
                        title={label}
                        aria-label={label}
                        className={`h-7 min-w-6 rounded text-center tabular-nums ${
                          cell.demand === 0
                            ? cell.overnight
                              ? 'bg-surface-muted'
                              : 'bg-surface-muted/50'
                            : STEP_CLASSES[step(cell.demand)]
                        } ${cell.short ? 'font-bold ring-2 ring-accent ring-inset' : ''}`}
                      >
                        {cell.demand > 0 ? cell.demand : ''}
                      </td>
                    )
                  })}
                  <td className="pl-2 text-right text-xs text-ink-muted tabular-nums whitespace-nowrap">
                    {row.daySupply} · {row.nightSupply}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line px-4 py-3 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            Fewer
            {STEP_CLASSES.slice(1).map((c) => (
              <span key={c} className={`size-3 rounded-sm ${c}`} aria-hidden="true" />
            ))}
            more call-outs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm font-bold ring-2 ring-accent ring-inset" aria-hidden="true" />
            Call-outs outnumber responders on cover
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1 w-4 rounded-full bg-ink-subtle" aria-hidden="true" />
            Overnight, {formatHour(22)} to {formatHour(6)}
          </span>
          <span>On cover: daytime · overnight</span>
        </div>
      </div>
    </div>
  )
}
