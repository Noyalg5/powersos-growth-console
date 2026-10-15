/**
 * The Network health filters: sector, region, date range and the hour cover is
 * judged at. They live in the URL so a view can be shared; this module reads and
 * writes them, falling back to defaults for anything missing or invalid, and
 * narrows the datasets to match.
 */
import type { CallOut, Customer, Region, Responder, SectorId, Site, Timestamp } from '@/types'
import type { RegionalCallOut } from './liquidity'
import type { CoverContext } from './matching'
import { DAY_MS, MINUTE_MS } from './time'

export type CoverMode = 'day' | 'night' | 'weekend'

export const COVER_MODES: Record<CoverMode, { label: string; overnight: boolean; weekend: boolean }> =
  {
    day: { label: 'Weekday daytime', overnight: false, weekend: false },
    night: { label: 'Overnight', overnight: true, weekend: false },
    weekend: { label: 'Weekend daytime', overnight: false, weekend: true },
  }

export interface NetworkFilters {
  sector: SectorId | null
  region: Region | null
  /** First day of the range, 00:00 UTC. */
  from: Timestamp
  /** Last day of the range, inclusive, 00:00 UTC. */
  to: Timestamp
  cover: CoverMode
}

/** The first and last days the data covers, 00:00 UTC. */
export interface DateBounds {
  min: Timestamp
  max: Timestamp
}

export interface FilterOptions {
  sectors: readonly SectorId[]
  regions: readonly Region[]
}

/** The twelve months the data runs for, to the data date: first and last days, 00:00 UTC. */
export function dataBounds(asOf: Timestamp): DateBounds {
  const last = asOf - (asOf % DAY_MS)
  return { min: last - 365 * DAY_MS, max: last }
}

export function defaultFilters(bounds: DateBounds): NetworkFilters {
  return { sector: null, region: null, from: bounds.min, to: bounds.max, cover: 'day' }
}

/** 00:00 UTC on a day → "2026-10-14". */
export function toIsoDate(day: Timestamp): string {
  return new Date(day).toISOString().slice(0, 10)
}

/** "2026-10-14" → 00:00 UTC that day. Null for anything else, including 2026-02-30. */
export function parseIsoDate(text: string | null): Timestamp | null {
  const match = text ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(text) : null
  if (!match) return null
  const [, y, m, d] = match.map(Number) as [number, number, number, number]
  const day = Date.UTC(y, m - 1, d)
  return toIsoDate(day) === text ? day : null
}

const clampDay = (day: Timestamp, { min, max }: DateBounds) => Math.min(max, Math.max(min, day))

/** Filters from the URL. Anything missing or invalid falls back to its default. */
export function parseFilters(
  params: URLSearchParams,
  bounds: DateBounds,
  options: FilterOptions,
): NetworkFilters {
  const defaults = defaultFilters(bounds)
  const sector = options.sectors.find((s) => s === params.get('sector')) ?? null
  const region = options.regions.find((r) => r === params.get('region')) ?? null
  const cover = (Object.keys(COVER_MODES) as CoverMode[]).find((c) => c === params.get('cover'))
  let from = clampDay(parseIsoDate(params.get('from')) ?? defaults.from, bounds)
  let to = clampDay(parseIsoDate(params.get('to')) ?? defaults.to, bounds)
  if (from > to) [from, to] = [to, from]
  return { sector, region, from, to, cover: cover ?? defaults.cover }
}

/** The URL query for some filters, leaving out anything at its default. */
export function filtersToParams(filters: NetworkFilters, bounds: DateBounds): URLSearchParams {
  const defaults = defaultFilters(bounds)
  const params = new URLSearchParams()
  if (filters.sector) params.set('sector', filters.sector)
  if (filters.region) params.set('region', filters.region)
  if (filters.from !== defaults.from) params.set('from', toIsoDate(filters.from))
  if (filters.to !== defaults.to) params.set('to', toIsoDate(filters.to))
  if (filters.cover !== defaults.cover) params.set('cover', filters.cover)
  return params
}

/** The end of the range, exclusive: 00:00 UTC the day after `to`. */
export function rangeUntil(filters: NetworkFilters): Timestamp {
  return filters.to + DAY_MS
}

/**
 * Coverage is judged as at the end of the range (or the data date, if earlier),
 * for the kind of hour chosen.
 */
export function coverContextFor(filters: NetworkFilters, asOf: Timestamp): CoverContext {
  const { overnight, weekend } = COVER_MODES[filters.cover]
  return { at: Math.min(rangeUntil(filters) - MINUTE_MS, asOf), overnight, weekend }
}

export interface NetworkData {
  customers: readonly Customer[]
  sites: readonly Site[]
  responders: readonly Responder[]
  callOuts: readonly CallOut[]
}

export interface ScopedNetwork {
  /** Sites in the chosen sector and region. */
  sites: Site[]
  /** Call-outs in the range, sector and region, with their site's region. */
  callOuts: RegionalCallOut[]
  /** Responders based in the chosen region. Coverage still counts every responder. */
  responders: Responder[]
}

/** Narrow the data to the filters. */
export function scopeNetwork(filters: NetworkFilters, data: NetworkData): ScopedNetwork {
  const sectorOf = new Map(data.customers.map((c) => [c.id, c.sector]))
  const regionOf = new Map(data.sites.map((s) => [s.id, s.region]))
  const inSector = (customerId: string) =>
    filters.sector === null || sectorOf.get(customerId) === filters.sector
  const inRegion = (region: Region | null) => filters.region === null || region === filters.region
  const until = rangeUntil(filters)

  return {
    sites: data.sites.filter((s) => inSector(s.customerId) && inRegion(s.region)),
    callOuts: data.callOuts
      .map((c): RegionalCallOut => ({ ...c, region: regionOf.get(c.siteId) ?? null }))
      .filter(
        (c) =>
          c.requestedAt >= filters.from &&
          c.requestedAt < until &&
          inSector(c.customerId) &&
          inRegion(c.region),
      ),
    responders: data.responders.filter((r) => inRegion(r.region)),
  }
}
