/** Shared building blocks for the dataset generators. */
import { destinationPoint, haversineKm, type LatLng } from '@/lib/geo'
import type { Rng } from '@/lib/rng'
import { DAY_MS } from '@/lib/time'
import type { Contact, Timestamp, Town } from '@/types'
import { FIRST_NAMES, SURNAMES } from './names'
import type { TownName } from './towns'

/** Relative weights by town name. */
export type TownWeights = Partial<Record<TownName, number>>

/** `CUS-007`. */
export function makeId(prefix: string, n: number, width = 3): string {
  return `${prefix}-${String(n).padStart(width, '0')}`
}

/** Round to the nearest penny. */
export function money(amount: number): number {
  return Math.round(amount * 100) / 100
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** 00:00 UTC on the day `days` after `from` (negative for before), for date-only fields. */
export function daysFrom(from: Timestamp, days: number): Timestamp {
  const at = from + days * DAY_MS
  return at - (at % DAY_MS)
}

/** A random point near a town: uniform over its spread disc, kept on land for coastal towns. */
export function placeNear(rng: Rng, town: Town, minKm = 0.5): LatLng {
  let bearing: number
  if (town.landBearings) {
    const [from, to] = town.landBearings
    const span = (to - from + 360) % 360
    bearing = (from + rng.float(0, span)) % 360
  } else {
    bearing = rng.float(0, 360)
  }
  // sqrt() spreads points evenly over the disc instead of bunching at the centre
  const distance = minKm + (town.spreadKm - minKm) * Math.sqrt(rng.next())
  const point = destinationPoint(town, bearing, distance)
  // 4 decimal places is about 10 m: plenty for a demo map
  return { lat: roundTo(point.lat, 4), lng: roundTo(point.lng, 4) }
}

/** Towns ordered from nearest to furthest. */
export function townsByDistance(from: LatLng, towns: readonly Town[]): Town[] {
  return [...towns].sort((a, b) => haversineKm(from, a) - haversineKm(from, b))
}

/** Pick a town in proportion to its weight. Towns missing from `weights` get `fallback`. */
export function pickTown(
  rng: Rng,
  towns: readonly Town[],
  weights: TownWeights,
  fallback = 1,
): Town {
  return rng.weighted(
    towns.map((town) => ({ value: town, weight: weights[town.name as TownName] ?? fallback })),
  )
}

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(SURNAMES)}`
}

/** A mobile number from Ofcom's range reserved for drama, so it can never reach a real person. */
export function fictionalPhone(rng: Rng): string {
  return `07700 900${String(rng.int(0, 999)).padStart(3, '0')}`
}

export function makeContact(rng: Rng, role: string): Contact {
  return { name: personName(rng), role, phone: fictionalPhone(rng) }
}
