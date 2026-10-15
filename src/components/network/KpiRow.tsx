import { useState } from 'react'
import { StatTile } from '@/components/StatTile'
import { formatDuration, formatMonth, formatNumber, formatPercent } from '@/lib/format'
import type { MonthCount } from '@/lib/liquidity'
import type { NetworkKpis } from '@/lib/networkHealth'

interface KpiRowProps {
  kpis: NetworkKpis
  /** Tighter tiles and a shorter trend line, for the Overview. */
  compact?: boolean
}

const NONE = '—'

/** The five headline measures of network health. */
export function KpiRow({ kpis, compact = false }: KpiRowProps) {
  const { coverage, medianAccept, onTarget, callOuts, utilisation, monthly } = kpis
  const total = monthly.reduce((sum, m) => sum + m.count, 0)
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
      <StatTile
        compact={compact}
        label="Sites covered by 2+ responders"
        tip="Share of sites with at least two eligible responders within an estimated 75-minute drive, so one can be busy and the site is still covered."
        value={coverage.sites === 0 ? NONE : formatPercent(coverage.coveredShare)}
        caption={`${formatNumber(coverage.covered)} of ${formatNumber(coverage.sites)} sites`}
      />
      <StatTile
        compact={compact}
        label="Median time to accept"
        tip="Half of call-outs were accepted by a responder faster than this: how quickly the network answers before anyone sets off."
        value={medianAccept === null ? NONE : formatDuration(medianAccept)}
        caption={`Across ${formatNumber(callOuts)} call-outs`}
      />
      <StatTile
        compact={compact}
        label="On site within 75 min"
        tip="Share of call-outs where the crew arrived within the 75-minute target, measured from the request."
        value={onTarget === null ? NONE : formatPercent(onTarget)}
        caption={
          onTarget === null
            ? 'No call-outs in this view'
            : `${formatNumber(Math.round(onTarget * callOuts))} of ${formatNumber(callOuts)} call-outs`
        }
      />
      <StatTile
        compact={compact}
        label="Responder utilisation"
        tip="Hours on jobs divided by the hours responders were eligible and on cover. Emergency cover is mostly standby, so this is low; very low use risks responders drifting away."
        value={utilisation.share === null ? NONE : formatPercent(utilisation.share, 1)}
        caption={`${formatNumber(utilisation.jobHours)} job hours of ${formatNumber(utilisation.availableHours)} available`}
      />
      <div className="col-span-2 lg:col-span-1">
        <StatTile
          compact={compact}
          label="Call-outs per month"
          tip="Call-outs requested each month in this view. Faults rise in winter, when networks are cold, wet and most heavily loaded."
          value={formatNumber(total)}
          caption={total === 0 ? 'No call-outs in this view' : compact ? '' : 'in the period'}
        >
          <Sparkline months={monthly} compact={compact} />
        </StatTile>
      </div>
    </div>
  )
}

/** One series of monthly counts: a 2px line with a hover readout and a table for screen readers. */
function Sparkline({ months, compact }: { months: readonly MonthCount[]; compact: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  if (months.length < 2) return null
  const width = 200
  const height = compact ? 24 : 40
  const pad = 3
  const max = Math.max(1, ...months.map((m) => m.count))
  const x = (i: number) => pad + (i / (months.length - 1)) * (width - 2 * pad)
  const y = (count: number) => height - pad - (count / max) * (height - 2 * pad)
  const points = months.map((m, i) => `${x(i)},${y(m.count)}`).join(' ')
  const peak = months.reduce((best, m) => (m.count > best.count ? m : best))
  const shown = hover === null ? null : months[hover]

  return (
    <div className={compact ? 'mt-1' : 'mt-2'}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className={`w-full overflow-visible ${compact ? 'h-6' : 'h-10'}`}
        aria-hidden="true"
        onMouseLeave={() => setHover(null)}
      >
        <polyline
          points={points}
          fill="none"
          className="stroke-ink-muted"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {shown && hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={0}
            y2={height}
            className="stroke-line"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {months.map((m, i) => (
          <rect
            key={m.month}
            x={x(i) - width / months.length / 2}
            y={0}
            width={width / months.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      <p className="mt-1 text-xs text-ink-subtle tabular-nums" aria-hidden="true">
        {shown
          ? `${formatMonth(shown.month)}: ${formatNumber(shown.count)}`
          : `Peak ${formatMonth(peak.month)}: ${formatNumber(peak.count)}`}
      </p>
      <table className="sr-only">
        <caption>Call-outs per month</caption>
        <tbody>
          {months.map((m) => (
            <tr key={m.month}>
              <th scope="row">{formatMonth(m.month)}</th>
              <td>{m.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
