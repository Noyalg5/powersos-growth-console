import type { CoverageStatus } from '@/lib/coverage'
import type { LatLng } from '@/lib/geo'
import { MAINLAND_OUTLINE } from '@/lib/mainland'
import type { ProposalSite } from '@/lib/proposal'

interface SiteMapProps {
  sites: readonly ProposalSite[]
  /** Eligible responder bases within reach of the sites. */
  responders: readonly LatLng[]
  /** Read by screen readers. */
  label: string
}

interface Box {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

const WIDTH = 240
const HEIGHT = 280
/** The smallest area shown, in degrees of latitude: about 90 km. */
const MIN_SPAN = 0.8
/** A map this tall or more already shows most of the country, so it needs no locator. */
const LOCATOR_UP_TO_SPAN = 4

const GREAT_BRITAIN: Box = {
  minLat: Math.min(...MAINLAND_OUTLINE.map(([lat]) => lat)),
  maxLat: Math.max(...MAINLAND_OUTLINE.map(([lat]) => lat)),
  minLng: Math.min(...MAINLAND_OUTLINE.map(([, lng]) => lng)),
  maxLng: Math.max(...MAINLAND_OUTLINE.map(([, lng]) => lng)),
}

/** A degree of longitude is shorter than a degree of latitude this far north. */
const lngScale = (box: Box) => Math.cos((((box.minLat + box.maxLat) / 2) * Math.PI) / 180)

/** The sites' bounding box, padded and never smaller than MIN_SPAN. */
function frame(points: readonly LatLng[]): Box {
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
  const k = Math.cos((midLat * Math.PI) / 180)
  // Match the map's shape so the padding is even on every side
  const latSpan = Math.max(MIN_SPAN, (Math.max(...lats) - Math.min(...lats)) * 1.4)
  const lngSpan = Math.max(
    ((latSpan * WIDTH) / HEIGHT) / k,
    (Math.max(...lngs) - Math.min(...lngs)) * 1.4,
  )
  return {
    minLat: midLat - latSpan / 2,
    maxLat: midLat + latSpan / 2,
    minLng: midLng - lngSpan / 2,
    maxLng: midLng + lngSpan / 2,
  }
}

/** Fits a box into width × height, keeping its shape, centred. */
function projector(box: Box, width: number, height: number) {
  const k = lngScale(box)
  const spanX = (box.maxLng - box.minLng) * k
  const spanY = box.maxLat - box.minLat
  const scale = Math.min(width / spanX, height / spanY)
  const offsetX = (width - spanX * scale) / 2
  const offsetY = (height - spanY * scale) / 2
  return ({ lat, lng }: LatLng) => ({
    x: offsetX + (lng - box.minLng) * k * scale,
    y: offsetY + (box.maxLat - lat) * scale,
  })
}

function outlinePath(project: (p: LatLng) => { x: number; y: number }): string {
  return (
    MAINLAND_OUTLINE.map(([lat, lng], i) => {
      const { x, y } = project({ lat, lng })
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join('') + 'Z'
  )
}

const MARKS: Record<CoverageStatus, { circle: string; text: string; label: string }> = {
  covered: {
    circle: 'fill-ink stroke-surface',
    text: 'fill-surface',
    label: 'Covered: 2 or more responders within reach',
  },
  thin: { circle: 'fill-surface stroke-ink', text: 'fill-ink', label: 'Thin: 1 responder within reach' },
  uncovered: {
    circle: 'fill-surface stroke-danger [stroke-dasharray:2_1.5]',
    text: 'fill-danger-ink',
    label: 'Uncovered: none within reach',
  },
}

function SiteMark({ status, small = false }: { status: CoverageStatus; small?: boolean }) {
  const r = small ? 5 : 7
  return <circle r={r} strokeWidth={1.5} className={MARKS[status].circle} />
}

/**
 * The lead's sites on a simple outline of mainland Great Britain, numbered to match the
 * cover table, with the responders that can reach them. Drawn as SVG so it prints cleanly.
 */
export function SiteMap({ sites, responders, label }: SiteMapProps) {
  const box = frame(sites.map((s) => s.site))
  const project = projector(box, WIDTH, HEIGHT)
  const insetProject = projector(GREAT_BRITAIN, 56, 96)
  const corner = (lat: number, lng: number) => insetProject({ lat, lng })
  const topLeft = corner(box.maxLat, box.minLng)
  const bottomRight = corner(box.minLat, box.maxLng)
  const statuses = new Set(sites.map((s) => s.status))
  const showLocator = box.maxLat - box.minLat < LOCATOR_UP_TO_SPAN

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={label}
        className="w-full rounded-lg border border-line"
      >
        {/* The sea is drawn rather than a background, so it prints */}
        <rect width={WIDTH} height={HEIGHT} className="fill-surface-muted" />
        <path d={outlinePath(project)} className="fill-surface stroke-line" strokeWidth={1} />
        {responders.map((r, i) => {
          const { x, y } = project(r)
          return (
            <rect
              key={i}
              x={x - 2.5}
              y={y - 2.5}
              width={5}
              height={5}
              className="fill-ink-subtle"
              transform={`rotate(45 ${x} ${y})`}
            />
          )
        })}
        {sites.map((s) => {
          const { x, y } = project(s.site)
          return (
            <g key={s.site.id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <SiteMark status={s.status} />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className={`text-[8px] font-semibold ${MARKS[s.status].text}`}
              >
                {s.number}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="mt-2 flex items-start gap-3">
        <ul className="flex-1 space-y-1 text-[11px] leading-snug text-ink-muted">
          {(['covered', 'thin', 'uncovered'] as const)
            .filter((status) => statuses.has(status))
            .map((status) => (
              <li key={status} className="flex items-center gap-1.5">
                <svg viewBox="-7 -7 14 14" width={12} height={12} aria-hidden="true">
                  <SiteMark status={status} small />
                </svg>
                {MARKS[status].label}
              </li>
            ))}
          <li className="flex items-center gap-1.5">
            <svg viewBox="-6 -6 12 12" width={12} height={12} aria-hidden="true">
              <rect x={-2.5} y={-2.5} width={5} height={5} transform="rotate(45)" className="fill-ink-subtle" />
            </svg>
            Responder base within reach
          </li>
        </ul>
        {showLocator && (
          <svg viewBox="0 0 56 96" width={42} height={72} aria-hidden="true" className="shrink-0">
            <path d={outlinePath(insetProject)} className="fill-surface-muted stroke-line" strokeWidth={1} />
            <rect
              x={topLeft.x}
              y={topLeft.y}
              width={Math.max(2, bottomRight.x - topLeft.x)}
              height={Math.max(2, bottomRight.y - topLeft.y)}
              className="fill-none stroke-accent"
              strokeWidth={1.25}
            />
          </svg>
        )}
      </figcaption>
    </figure>
  )
}
