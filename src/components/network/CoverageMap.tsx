import 'leaflet/dist/leaflet.css'
import { latLngBounds } from 'leaflet'
import { useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Pane,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet'
import {
  SECTOR_FAMILIES,
  sectorFamily,
  sectorLabel,
  SUPPLIER_CATEGORY_LABELS,
  type SectorFamilyId,
} from '@/data'
import type { CoverageStatus, SiteCoverage } from '@/lib/coverage'
import { formatDuration, formatNumber } from '@/lib/format'
import { reachKm, RESPONSE_TARGET_MINUTES } from '@/lib/geo'
import { eligibilityExclusions, type CoverContext } from '@/lib/matching'
import type { Customer, LatLng, Responder, Supplier } from '@/types'

const STATUS_LABELS: Record<CoverageStatus, string> = {
  covered: 'Covered: 2 or more eligible responders',
  thin: 'Thin: 1 eligible responder',
  uncovered: 'Uncovered: no eligible responder',
}

const STATUS_SHORT: Record<CoverageStatus, string> = {
  covered: 'Covered',
  thin: 'Thin',
  uncovered: 'Uncovered',
}

type LayerId = 'sites' | 'responders' | 'suppliers' | 'reach'

const LAYERS: { id: LayerId; label: string }[] = [
  { id: 'sites', label: 'Customer sites' },
  { id: 'responders', label: 'Responder bases' },
  { id: 'suppliers', label: 'Supplier depots' },
  { id: 'reach', label: '75-minute reach' },
]

/** The middle of mainland Great Britain, for before the first fit. */
const GB_CENTRE: [number, number] = [54.4, -3]

interface CoverageMapProps {
  coverage: readonly SiteCoverage[]
  customers: readonly Customer[]
  responders: readonly Responder[]
  suppliers: readonly Supplier[]
  context: CoverContext
}

/**
 * Zoom to the sites shown. The effect depends on the corners of their bounding box
 * as plain numbers, so it refits when the filters change the extent and leaves the
 * viewer's own panning and zooming alone otherwise.
 */
function FitToSites({ points }: { points: readonly LatLng[] }) {
  const map = useMap()
  const lats = points.map((p) => p.lat)
  const lngs = points.map((p) => p.lng)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  useEffect(() => {
    if (!Number.isFinite(south)) return
    map.fitBounds(
      latLngBounds([
        [south, west],
        [north, east],
      ]),
      { padding: [16, 16], maxZoom: 9 },
    )
  }, [map, south, west, north, east])
  return null
}

export function CoverageMap({
  coverage,
  customers,
  responders,
  suppliers,
  context,
}: CoverageMapProps) {
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({
    sites: true,
    responders: true,
    suppliers: false,
    reach: true,
  })
  const customerOf = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers])
  const responderStatus = useMemo(
    () =>
      responders.map((responder) => ({
        responder,
        exclusions: eligibilityExclusions(responder, context),
      })),
    [responders, context],
  )
  const reachMetres = reachKm() * 1000
  const points = coverage.map((c) => c.site)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span id="layers-label" className="mr-1 text-xs text-ink-subtle">
          Layers
        </span>
        <div role="group" aria-labelledby="layers-label" className="flex flex-wrap gap-2">
          {LAYERS.map((layer) => (
            <button
              key={layer.id}
              type="button"
              aria-pressed={layers[layer.id]}
              onClick={() => setLayers((l) => ({ ...l, [layer.id]: !l[layer.id] }))}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                layers[layer.id]
                  ? 'border-accent bg-accent-soft text-ink'
                  : 'border-line bg-surface text-ink-subtle hover:text-ink'
              }`}
            >
              {layer.label}
            </button>
          ))}
        </div>
      </div>

      <div className="coverage-map mt-3 h-[24rem] overflow-hidden rounded-xl border border-line sm:h-[30rem] lg:h-[40rem]">
        <MapContainer
          center={GB_CENTRE}
          zoom={6}
          minZoom={5}
          scrollWheelZoom={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={18}
          />
          <FitToSites points={points} />

          {/* Popup text uses divs: leaflet.css puts large margins on popup paragraphs */}
          <Pane name="reach" style={{ zIndex: 410 }}>
            {layers.reach &&
              responderStatus
                .filter((r) => r.exclusions.length === 0)
                .map(({ responder }) => (
                  <Circle
                    key={responder.id}
                    center={[responder.lat, responder.lng]}
                    radius={reachMetres}
                    className="map-reach"
                    interactive={false}
                  />
                ))}
          </Pane>

          <Pane name="depots" style={{ zIndex: 420 }}>
            {layers.suppliers &&
              suppliers.map((supplier) => (
                <CircleMarker
                  key={supplier.id}
                  center={[supplier.lat, supplier.lng]}
                  radius={5}
                  className="map-supplier"
                >
                  <Popup>
                    <div className="font-semibold">{supplier.name}</div>
                    <div className="text-ink-muted">
                      {SUPPLIER_CATEGORY_LABELS[supplier.category]} · {supplier.town}
                    </div>
                    <div className="mt-1 text-ink-muted">
                      {supplier.emergencyLine
                        ? 'Takes emergency orders around the clock'
                        : 'Trading hours only'}
                    </div>
                    <div className="mt-1 text-[11px] text-ink-subtle">Supplier: working definition</div>
                  </Popup>
                </CircleMarker>
              ))}
            {layers.responders &&
              responderStatus.map(({ responder, exclusions }) => (
                <CircleMarker
                  key={`${responder.id}-${exclusions.length === 0}`}
                  center={[responder.lat, responder.lng]}
                  radius={6}
                  className={`map-responder ${exclusions.length > 0 ? 'is-ineligible' : ''}`}
                >
                  <Popup>
                    <div className="font-semibold">{responder.name}</div>
                    <div className="text-ink-muted">
                      {responder.town} · {formatNumber(responder.rating, 1)} rating ·{' '}
                      {responder.availability.onCallEngineers} on call
                    </div>
                    {exclusions.length === 0 ? (
                      <div className="mt-1 text-ink">Eligible: counts towards cover</div>
                    ) : (
                      <div className="mt-1 text-ink">
                        Not counted: {exclusions.map((e) => e.label).join('; ')}
                      </div>
                    )}
                  </Popup>
                </CircleMarker>
              ))}
          </Pane>

          <Pane name="sites" style={{ zIndex: 430 }}>
            {layers.sites &&
              coverage.map(({ site, status, nearest }) => {
                const customer = customerOf.get(site.customerId)
                const family = customer ? sectorFamily(customer.sector) : 'public'
                return (
                  <CircleMarker
                    key={`${site.id}-${status}-${family}`}
                    center={[site.lat, site.lng]}
                    radius={7}
                    className={`map-site family-${family} coverage-${status}`}
                  >
                    <Popup>
                      <div className="font-semibold">{site.name}</div>
                      <div className="text-ink-muted">
                        {customer?.name}
                        {customer ? ` · ${sectorLabel(customer.sector)}` : ''}
                      </div>
                      <div className="mt-1 text-ink-muted">
                        Criticality {site.criticality} of 5 ·{' '}
                        <span className="font-medium text-ink">{STATUS_SHORT[status]}</span>
                      </div>
                      <div className="mt-2 text-[11px] text-ink-subtle">
                        Nearest eligible responders (estimated drive)
                      </div>
                      {nearest.length === 0 ? (
                        <div className="text-ink-muted">None eligible at this hour</div>
                      ) : (
                        <ol className="mt-0.5 space-y-0.5">
                          {nearest.map(({ responder, minutes }) => (
                            <li key={responder.id} className="flex justify-between gap-3">
                              <span className="min-w-0 truncate">{responder.name}</span>
                              <span
                                className={`shrink-0 tabular-nums ${minutes > RESPONSE_TARGET_MINUTES ? 'text-danger-ink' : 'text-ink'}`}
                              >
                                {formatDuration(minutes)}
                              </span>
                            </li>
                          ))}
                        </ol>
                      )}
                    </Popup>
                  </CircleMarker>
                )
              })}
          </Pane>
        </MapContainer>
      </div>

      <MapLegend />
    </div>
  )
}

const FAMILY_CLASS: Record<SectorFamilyId, string> = {
  critical: 'family-critical',
  industry: 'family-industry',
  public: 'family-public',
}

/** A legend swatch drawn with the same classes as the map marks. */
function Swatch({ className, r = 6 }: { className: string; r?: number }) {
  return (
    <svg viewBox="0 0 18 18" width={18} height={18} aria-hidden="true" className="shrink-0">
      <circle cx="9" cy="9" r={r} className={className} />
    </svg>
  )
}

function MapLegend() {
  return (
    <div className="mt-3 grid gap-x-8 gap-y-3 text-xs text-ink-muted sm:grid-cols-2 lg:grid-cols-3">
      <div>
        <p className="mb-1.5 font-medium text-ink">Sites by sector family</p>
        <ul className="space-y-1">
          {SECTOR_FAMILIES.map((family) => (
            <li key={family.id} className="flex items-start gap-2">
              <Swatch className={`map-site coverage-covered ${FAMILY_CLASS[family.id]}`} />
              <span>
                <span className="text-ink">{family.label}</span>:{' '}
                {family.sectors.map((s) => sectorLabel(s).toLowerCase()).join(', ')}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1.5 font-medium text-ink">Coverage within 75 minutes</p>
        <ul className="space-y-1">
          {(['covered', 'thin', 'uncovered'] as const).map((status) => (
            <li key={status} className="flex items-center gap-2">
              <Swatch className={`map-site family-critical coverage-${status}`} />
              {STATUS_LABELS[status]}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1.5 font-medium text-ink">Network</p>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <Swatch className="map-responder" r={5} />
            Responder base, eligible
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="map-responder is-ineligible" r={5} />
            Responder base, not eligible (paperwork or cover)
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="map-supplier" r={4} />
            Supplier depot (working definition)
          </li>
          <li className="flex items-center gap-2">
            <Swatch className="map-reach" r={8} />
            Estimated reach — straight-line distance × road factor
          </li>
        </ul>
      </div>
    </div>
  )
}
