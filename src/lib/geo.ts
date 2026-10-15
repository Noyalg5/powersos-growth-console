/**
 * Distances and drive-time estimates for matching responders to sites.
 *
 * Straight-line distance is turned into an estimated drive time with a road
 * factor and an average speed. It is a planning estimate, not routing.
 */

export interface LatLng {
  lat: number
  lng: number
}

/** Mean Earth radius. */
export const EARTH_RADIUS_KM = 6371
export const KM_PER_MILE = 1.609344

/** Roads are rarely straight: road distance ≈ straight-line distance × 1.3. */
export const DEFAULT_ROAD_FACTOR = 1.3
/** Blended average for an emergency run on mixed UK roads. */
export const DEFAULT_AVERAGE_SPEED_MPH = 40
/** The public PowerSOS response target. */
export const RESPONSE_TARGET_MINUTES = 75

const toRadians = (degrees: number) => (degrees * Math.PI) / 180
const toDegrees = (radians: number) => (radians * 180) / Math.PI

function assertLatLng(point: LatLng, label: string) {
  const { lat, lng } = point
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new RangeError(`${label} latitude must be between -90 and 90, got ${lat}`)
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw new RangeError(`${label} longitude must be between -180 and 180, got ${lng}`)
  }
}

/** Great-circle distance between two points, in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  assertLatLng(a, 'from')
  assertLatLng(b, 'to')
  const dLat = toRadians(b.lat - a.lat)
  const dLng = toRadians(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2
  // min() guards against rounding just above 1 for near-antipodal points
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Great-circle distance between two points, in miles. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  return haversineKm(a, b) / KM_PER_MILE
}

/** The point reached by travelling a distance (km) on a compass bearing (degrees from north). */
export function destinationPoint(
  origin: LatLng,
  bearingDegrees: number,
  distanceKm: number,
): LatLng {
  assertLatLng(origin, 'origin')
  if (!Number.isFinite(bearingDegrees)) {
    throw new RangeError(`bearing must be finite, got ${bearingDegrees}`)
  }
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError(`distance must be a non-negative number, got ${distanceKm}`)
  }
  const angular = distanceKm / EARTH_RADIUS_KM
  const bearing = toRadians(bearingDegrees)
  const lat1 = toRadians(origin.lat)
  const lng1 = toRadians(origin.lng)
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) + Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  )
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    )
  // Normalise longitude back into [-180, 180)
  return { lat: toDegrees(lat2), lng: ((toDegrees(lng2) + 540) % 360) - 180 }
}

export interface DriveTimeOptions {
  /** Road distance ÷ straight-line distance. At least 1. */
  roadFactor?: number
  /** Average speed in miles per hour. Must be positive. */
  averageSpeedMph?: number
}

/** Estimated drive time in minutes for a straight-line distance in miles. */
export function estimateDriveMinutes(
  straightLineMiles: number,
  {
    roadFactor = DEFAULT_ROAD_FACTOR,
    averageSpeedMph = DEFAULT_AVERAGE_SPEED_MPH,
  }: DriveTimeOptions = {},
): number {
  if (!Number.isFinite(straightLineMiles) || straightLineMiles < 0) {
    throw new RangeError(`distance must be a non-negative number, got ${straightLineMiles}`)
  }
  if (!Number.isFinite(roadFactor) || roadFactor < 1) {
    throw new RangeError(`roadFactor must be at least 1, got ${roadFactor}`)
  }
  if (!Number.isFinite(averageSpeedMph) || averageSpeedMph <= 0) {
    throw new RangeError(`averageSpeedMph must be positive, got ${averageSpeedMph}`)
  }
  return ((straightLineMiles * roadFactor) / averageSpeedMph) * 60
}

/**
 * The straight-line distance, in km, that `estimateDriveMinutes` puts at exactly
 * `minutes` away: the radius of a responder's estimated reach.
 */
export function reachKm(
  minutes: number = RESPONSE_TARGET_MINUTES,
  {
    roadFactor = DEFAULT_ROAD_FACTOR,
    averageSpeedMph = DEFAULT_AVERAGE_SPEED_MPH,
  }: DriveTimeOptions = {},
): number {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`minutes must be a non-negative number, got ${minutes}`)
  }
  if (!Number.isFinite(roadFactor) || roadFactor < 1) {
    throw new RangeError(`roadFactor must be at least 1, got ${roadFactor}`)
  }
  if (!Number.isFinite(averageSpeedMph) || averageSpeedMph <= 0) {
    throw new RangeError(`averageSpeedMph must be positive, got ${averageSpeedMph}`)
  }
  return ((minutes / 60) * averageSpeedMph * KM_PER_MILE) / roadFactor
}

/**
 * True when a response time meets the target (inclusive). Infinity, meaning
 * nobody can reach the site, is allowed and never meets it.
 */
export function isWithinTarget(minutes: number, target: number = RESPONSE_TARGET_MINUTES): boolean {
  if (Number.isNaN(minutes) || minutes < 0) {
    throw new RangeError(`minutes must be a non-negative number, got ${minutes}`)
  }
  if (!Number.isFinite(target) || target <= 0) {
    throw new RangeError(`target must be a positive number, got ${target}`)
  }
  return minutes <= target
}
