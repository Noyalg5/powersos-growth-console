import { useState } from 'react'
import { formatNumber } from '@/lib/format'
import {
  AXIS_LABELS,
  formatScore,
  MIDPOINT,
  QUADRANTS,
  SCORE_MAX,
  SCORE_MIN,
  type Quadrant,
  type SectorEvidence,
  type SectorResult,
} from '@/lib/sectorScoring'
import type { SectorId } from '@/types'

interface PriorityMatrixProps {
  results: readonly SectorResult[]
  evidence: Readonly<Record<SectorId, SectorEvidence>>
  leader: SectorId | null
}

const W = 400
const H = 388
const PLOT = { left: 44, right: W - 12, top: 26, bottom: H - 46 }
/** Room inside the frame so bubbles on the edge of the scale aren't cut off. */
const PAD = 22
const R_MIN = 6
const R_MAX = 20
const FONT = 11
/** Rough width of one character of the label font, for keeping labels apart. */
const CHAR_WIDTH = 6.1

const SHORT: Partial<Record<SectorId, string>> = {
  power: 'Power',
  telecoms: 'Telecoms & data centres',
}

const span = SCORE_MAX - SCORE_MIN
const x = (v: number) =>
  PLOT.left + PAD + ((v - SCORE_MIN) / span) * (PLOT.right - PLOT.left - 2 * PAD)
const y = (v: number) =>
  PLOT.bottom - PAD - ((v - SCORE_MIN) / span) * (PLOT.bottom - PLOT.top - 2 * PAD)
const TICKS = Array.from({ length: span + 1 }, (_, i) => SCORE_MIN + i)

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Bubble {
  result: SectorResult
  label: string
  cx: number
  cy: number
  r: number
  sites: number
}

interface Placed {
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) *
  Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0))

/**
 * Each label goes beside its bubble on whichever side is clearest of other labels,
 * other bubbles and the frame, the leader first so it gets the best spot.
 */
function placeLabels(bubbles: readonly Bubble[]): Map<SectorId, Placed> {
  const placed = new Map<SectorId, Placed>()
  const taken: Box[] = []
  const frame: Box = { x0: PLOT.left, y0: PLOT.top, x1: PLOT.right, y1: PLOT.bottom }
  for (const b of bubbles) {
    const w = b.label.length * CHAR_WIDTH
    const h = FONT + 2
    const options: (Placed & { box: Box })[] = [
      { x: b.cx + b.r + 4, y: b.cy + 4, anchor: 'start' },
      { x: b.cx - b.r - 4, y: b.cy + 4, anchor: 'end' },
      { x: b.cx, y: b.cy - b.r - 5, anchor: 'middle' },
      { x: b.cx, y: b.cy + b.r + FONT + 3, anchor: 'middle' },
    ].map((o) => {
      const x0 = o.anchor === 'start' ? o.x : o.anchor === 'end' ? o.x - w : o.x - w / 2
      return {
        ...o,
        anchor: o.anchor as Placed['anchor'],
        box: { x0, y0: o.y - FONT, x1: x0 + w, y1: o.y - FONT + h },
      }
    })
    const others = bubbles
      .filter((o) => o !== b)
      .map((o) => ({ x0: o.cx - o.r, y0: o.cy - o.r, x1: o.cx + o.r, y1: o.cy + o.r }))
    const cost = (box: Box) => {
      const outside = (box.x1 - box.x0) * (box.y1 - box.y0) - overlap(box, frame)
      return (
        outside * 4 +
        taken.reduce((sum, t) => sum + overlap(box, t) * 2, 0) +
        others.reduce((sum, o) => sum + overlap(box, o), 0)
      )
    }
    const best = options.reduce((a, c) => (cost(c.box) < cost(a.box) ? c : a))
    taken.push(best.box)
    placed.set(b.result.sector, { x: best.x, y: best.y, anchor: best.anchor })
  }
  return placed
}

const QUADRANT_CORNERS: { quadrant: Quadrant; x: number; y: number; anchor: 'start' | 'end' }[] = [
  // Above the frame: sectors at the top of the scale would cover labels inside it
  { quadrant: 'build-access', x: PLOT.left, y: PLOT.top - 8, anchor: 'start' },
  { quadrant: 'prioritise', x: PLOT.right, y: PLOT.top - 8, anchor: 'end' },
  { quadrant: 'deprioritise', x: PLOT.left + 8, y: PLOT.bottom - 8, anchor: 'start' },
  { quadrant: 'opportunistic', x: PLOT.right - 8, y: PLOT.bottom - 8, anchor: 'end' },
]

const sites = (n: number) => `${formatNumber(n)} ${n === 1 ? 'site' : 'sites'}`

/** The 2×2: market attractiveness against ability to win, bubbles sized by sites on record. */
export function PriorityMatrix({ results, evidence, leader }: PriorityMatrixProps) {
  const [active, setActive] = useState<SectorId | null>(null)
  const placeable = results.filter(
    (r): r is SectorResult & { attractiveness: number; ability: number } =>
      r.attractiveness !== null && r.ability !== null,
  )

  if (placeable.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
        Give at least one criterion on each side some weight to place the sectors on the matrix.
      </p>
    )
  }

  const maxSites = Math.max(1, ...placeable.map((r) => evidence[r.sector].sites))
  const bubbles: Bubble[] = placeable.map((result) => {
    const count = evidence[result.sector].sites
    return {
      result,
      label: SHORT[result.sector] ?? result.label,
      cx: x(result.ability),
      cy: y(result.attractiveness),
      r: R_MIN + (R_MAX - R_MIN) * Math.sqrt(count / maxSites),
      sites: count,
    }
  })
  const labels = placeLabels(bubbles)
  // Biggest at the back, so small bubbles are never hidden behind large ones
  const drawOrder = [...bubbles].sort((a, b) => b.r - a.r)
  const shown = bubbles.find((b) => b.result.sector === active)
  const mid = { x: x(MIDPOINT), y: y(MIDPOINT) }

  return (
    <figure className="rounded-xl border border-line bg-surface p-3 sm:p-4">
      <div className="relative mx-auto max-w-[30rem]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="group"
          aria-label="Sectors by market attractiveness and ability to win, sized by sites on record"
        >
          <rect
            x={mid.x}
            y={PLOT.top}
            width={PLOT.right - mid.x}
            height={mid.y - PLOT.top}
            className="fill-accent-soft"
          />
          {TICKS.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={PLOT.top}
                y2={PLOT.bottom}
                className={t === MIDPOINT ? 'stroke-ink-subtle' : 'stroke-line'}
                strokeWidth={1}
              />
              <line
                x1={PLOT.left}
                x2={PLOT.right}
                y1={y(t)}
                y2={y(t)}
                className={t === MIDPOINT ? 'stroke-ink-subtle' : 'stroke-line'}
                strokeWidth={1}
              />
              <text
                x={x(t)}
                y={PLOT.bottom + 15}
                textAnchor="middle"
                className="fill-ink-subtle tabular-nums"
                fontSize={FONT}
              >
                {t}
              </text>
              <text
                x={PLOT.left - 8}
                y={y(t) + 4}
                textAnchor="end"
                className="fill-ink-subtle tabular-nums"
                fontSize={FONT}
              >
                {t}
              </text>
            </g>
          ))}
          <rect
            x={PLOT.left}
            y={PLOT.top}
            width={PLOT.right - PLOT.left}
            height={PLOT.bottom - PLOT.top}
            className="fill-none stroke-line"
            strokeWidth={1}
          />
          {QUADRANT_CORNERS.map((q) => (
            <text
              key={q.quadrant}
              x={q.x}
              y={q.y}
              textAnchor={q.anchor}
              fontSize={10}
              fontWeight={600}
              letterSpacing="0.06em"
              className={q.quadrant === 'prioritise' ? 'fill-accent-ink' : 'fill-ink-subtle'}
            >
              {QUADRANTS[q.quadrant].label.toUpperCase()}
            </text>
          ))}
          <text
            x={(PLOT.left + PLOT.right) / 2}
            y={H - 8}
            textAnchor="middle"
            fontSize={FONT}
            className="fill-ink-muted"
          >
            {AXIS_LABELS.ability} →
          </text>
          <text
            x={-(PLOT.top + PLOT.bottom) / 2}
            y={12}
            transform="rotate(-90)"
            textAnchor="middle"
            fontSize={FONT}
            className="fill-ink-muted"
          >
            {AXIS_LABELS.attractiveness} →
          </text>

          {drawOrder.map((b) => {
            const isLeader = b.result.sector === leader
            const isActive = b.result.sector === active
            return (
              <g
                key={b.result.sector}
                tabIndex={0}
                role="img"
                aria-label={`${b.result.label}: market attractiveness ${formatScore(b.result.attractiveness ?? 0)}, ability to win ${formatScore(b.result.ability ?? 0)}, ${sites(b.sites)} on record${isLeader ? ', go first' : ''}`}
                onPointerEnter={() => setActive(b.result.sector)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(b.result.sector)}
                onBlur={() => setActive(null)}
                className="group cursor-default outline-none"
              >
                <circle cx={b.cx} cy={b.cy} r={Math.max(b.r, 12)} fill="transparent" />
                {/* The focus ring: an SVG group can't show the usual outline */}
                <circle
                  cx={b.cx}
                  cy={b.cy}
                  r={b.r + 4}
                  className="fill-none stroke-accent opacity-0 group-focus-visible:opacity-100"
                  strokeWidth={2}
                />
                <circle
                  cx={b.cx}
                  cy={b.cy}
                  r={b.r}
                  className={`${isLeader ? 'fill-accent' : 'fill-viz-1'} ${isActive ? 'stroke-ink' : 'stroke-surface'}`}
                  fillOpacity={isLeader ? 0.9 : 0.6}
                  strokeWidth={2}
                />
              </g>
            )
          })}
          {bubbles.map((b) => {
            const at = labels.get(b.result.sector)
            if (!at) return null
            return (
              <text
                key={b.result.sector}
                x={at.x}
                y={at.y}
                textAnchor={at.anchor}
                fontSize={FONT}
                fontWeight={b.result.sector === leader ? 600 : 400}
                className="pointer-events-none fill-ink"
                aria-hidden="true"
              >
                {b.label}
              </text>
            )
          })}
        </svg>

        {shown && (
          <div
            className="pointer-events-none absolute z-10 w-48 -translate-x-1/2 rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg"
            style={{
              left: `${Math.min(80, Math.max(20, (shown.cx / W) * 100))}%`,
              top: `${((shown.cy + shown.r + 8) / H) * 100}%`,
            }}
            aria-hidden="true"
          >
            <p className="text-sm font-semibold text-ink tabular-nums">
              {formatScore(shown.result.score)}{' '}
              <span className="text-xs font-normal text-ink-muted">of 5 overall</span>
            </p>
            <p className="text-ink-muted">{shown.result.label}</p>
            <dl className="mt-1.5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-ink-muted">
              <dt>{AXIS_LABELS.attractiveness}</dt>
              <dd className="text-right text-ink tabular-nums">
                {formatScore(shown.result.attractiveness ?? 0)}
              </dd>
              <dt>{AXIS_LABELS.ability}</dt>
              <dd className="text-right text-ink tabular-nums">
                {formatScore(shown.result.ability ?? 0)}
              </dd>
              <dt>Sites on record</dt>
              <dd className="text-right text-ink tabular-nums">{formatNumber(shown.sites)}</dd>
            </dl>
          </div>
        )}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-accent" aria-hidden="true" />
          Go first
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-viz-1 opacity-60" aria-hidden="true" />
          Other sectors
        </span>
        <span className="flex items-center gap-1.5">
          <svg viewBox="0 0 34 20" width={34} height={20} aria-hidden="true">
            <circle cx={7} cy={13} r={R_MIN * 0.6} className="fill-none stroke-ink-subtle" />
            <circle cx={24} cy={10} r={R_MAX * 0.45} className="fill-none stroke-ink-subtle" />
          </svg>
          Bubble size: sites on record (synthetic)
        </span>
        <span className="basis-full text-ink-subtle">
          Each axis is the weighted average of its three criteria. The lines cross at {MIDPOINT},
          the middle of the scale; the tinted corner is where to prioritise.
        </span>
      </figcaption>
    </figure>
  )
}
