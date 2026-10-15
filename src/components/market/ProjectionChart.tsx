import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { niceScale } from '@/lib/scale'
import { useElementWidth } from './useElementWidth'

export interface ChartSeries {
  key: string
  label: string
  values: readonly number[]
  /** Stroke and fill token classes for the line and its dot. */
  stroke: string
  fill: string
}

interface ProjectionChartProps {
  title: string
  series: readonly ChartSeries[]
  /** One label per point, e.g. the month. */
  labels: readonly string[]
  /** Which points get a label on the x-axis. */
  ticks: readonly number[]
  format: (value: number) => string
  axisFormat: (value: number) => string
}

/** Drawn at this width until the container is measured. */
const FALLBACK_WIDTH = 360
const H = 200
const FONT = 11

/**
 * Lines over the projection months, one y-axis, with a crosshair that snaps to the
 * nearest month on hover or with the arrow keys and reads out every series there.
 */
export function ProjectionChart({
  title,
  series,
  labels,
  ticks,
  format,
  axisFormat,
}: ProjectionChartProps) {
  const [at, setAt] = useState<number | null>(null)
  const [ref, measured] = useElementWidth<HTMLDivElement>()
  const W = measured ?? FALLBACK_WIDTH
  const PLOT = { left: 46, right: W - 12, top: 14, bottom: H - 26 }
  const count = labels.length
  const all = series.flatMap((s) => s.values)
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all))
  const x = (i: number) =>
    PLOT.left + (count <= 1 ? 0 : (i / (count - 1)) * (PLOT.right - PLOT.left))
  const y = (v: number) =>
    PLOT.bottom - ((v - scale.min) / (scale.max - scale.min)) * (PLOT.bottom - PLOT.top)

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const px = ((event.clientX - rect.left) / rect.width) * W
    const i = Math.round(((px - PLOT.left) / (PLOT.right - PLOT.left)) * (count - 1))
    setAt(Math.min(count - 1, Math.max(0, i)))
  }
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Partial<Record<string, number>> = {
      ArrowRight: Math.min(count - 1, (at ?? -1) + 1),
      ArrowLeft: Math.max(0, (at ?? count) - 1),
      Home: 0,
      End: count - 1,
    }
    if (event.key === 'Escape') return setAt(null)
    const next = moves[event.key]
    if (next === undefined) return
    event.preventDefault()
    setAt(next)
  }

  const shownLabel = at === null ? null : labels[at]

  return (
    <figure className="min-w-0">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium text-ink">{title}</span>
        {series.length > 1 && (
          <span className="flex flex-wrap gap-x-3 text-xs text-ink-muted">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <svg width={14} height={4} aria-hidden="true">
                  <line
                    x1={0}
                    x2={14}
                    y1={2}
                    y2={2}
                    className={s.stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </svg>
                {s.label}
              </span>
            ))}
          </span>
        )}
      </figcaption>
      <div ref={ref} className="relative mt-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          className="block max-w-full touch-pan-y overflow-visible"
          tabIndex={0}
          role="img"
          aria-label={`${title}. Use the arrow keys to read each month.`}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setAt(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setAt(null)}
        >
          {scale.ticks.map((t) => (
            <g key={t}>
              <line
                x1={PLOT.left}
                x2={PLOT.right}
                y1={y(t)}
                y2={y(t)}
                className={t === 0 ? 'stroke-ink-subtle' : 'stroke-line'}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PLOT.left - 6}
                y={y(t) + 4}
                textAnchor="end"
                fontSize={FONT}
                className="fill-ink-subtle tabular-nums"
              >
                {axisFormat(t)}
              </text>
            </g>
          ))}
          {ticks.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={H - 6}
              textAnchor={i === 0 ? 'start' : i === count - 1 ? 'end' : 'middle'}
              fontSize={FONT}
              className="fill-ink-subtle"
            >
              {labels[i]}
            </text>
          ))}
          {at !== null && (
            <line
              x1={x(at)}
              x2={x(at)}
              y1={PLOT.top}
              y2={PLOT.bottom}
              className="stroke-ink-subtle"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
            />
          )}
          {series.map((s) => (
            <polyline
              key={s.key}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              className={`fill-none ${s.stroke}`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {series.map((s) => {
            const i = at ?? count - 1
            const v = s.values[i]
            if (v === undefined) return null
            return (
              <circle
                key={s.key}
                cx={x(i)}
                cy={y(v)}
                r={4}
                className={`${s.fill} stroke-surface`}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>

        {at !== null && shownLabel !== undefined && (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${(x(at) / W) * 100}%`,
              transform: `translateX(${at > count / 2 ? 'calc(-100% - 10px)' : '10px'})`,
            }}
            aria-live="polite"
          >
            <p className="text-ink-muted">{shownLabel}</p>
            {series.map((s) => (
              <p key={s.key} className="mt-1 flex items-center gap-1.5">
                <svg width={10} height={4} aria-hidden="true">
                  <line
                    x1={0}
                    x2={10}
                    y1={2}
                    y2={2}
                    className={s.stroke}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="font-semibold text-ink tabular-nums">
                  {format(s.values[at] ?? 0)}
                </span>
                <span className="text-ink-muted">{s.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  )
}
