import { describe, expect, it } from 'vitest'
import {
  destinationPoint,
  estimateDriveMinutes,
  haversineKm,
  haversineMiles,
  isWithinTarget,
  KM_PER_MILE,
  reachKm,
  RESPONSE_TARGET_MINUTES,
} from './geo'

const london = { lat: 51.5074, lng: -0.1278 }
const edinburgh = { lat: 55.9533, lng: -3.1883 }
const manchester = { lat: 53.4808, lng: -2.2426 }
const birmingham = { lat: 52.4862, lng: -1.8904 }
const glasgow = { lat: 55.8642, lng: -4.2518 }
const landsEnd = { lat: 50.0657, lng: -5.7132 }
const johnOGroats = { lat: 58.6373, lng: -3.0689 }

/** Within 1% of a published straight-line distance. */
const expectNear = (actual: number, published: number) => {
  expect(Math.abs(actual - published) / published).toBeLessThan(0.01)
}

describe('haversine distance', () => {
  it.each([
    ['London', 'Edinburgh', london, edinburgh, 534, 332],
    ['London', 'Manchester', london, manchester, 262, 163],
    ['London', 'Birmingham', london, birmingham, 163, 101],
    ['Glasgow', 'Edinburgh', glasgow, edinburgh, 67, 42],
    ["Land's End", "John o' Groats", landsEnd, johnOGroats, 970, 603],
  ])('%s to %s matches the published distance', (_from, _to, a, b, km, miles) => {
    expectNear(haversineKm(a, b), km)
    expectNear(haversineMiles(a, b), miles)
  })

  it('is zero for the same point and symmetric', () => {
    expect(haversineKm(london, london)).toBe(0)
    expect(haversineKm(london, edinburgh)).toBeCloseTo(haversineKm(edinburgh, london), 9)
  })

  it('handles antipodal points and the date line', () => {
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 0, lng: 180 })).toBeCloseTo(Math.PI * 6371, 6)
    expect(haversineKm({ lat: 0, lng: 179.5 }, { lat: 0, lng: -179.5 })).toBeCloseTo(111.19, 1)
  })

  it('rejects coordinates that are out of range or not numbers', () => {
    expect(() => haversineKm({ lat: 91, lng: 0 }, london)).toThrow(RangeError)
    expect(() => haversineKm(london, { lat: 0, lng: -181 })).toThrow(RangeError)
    expect(() => haversineKm({ lat: Number.NaN, lng: 0 }, london)).toThrow(RangeError)
  })
})

describe('destinationPoint', () => {
  it('moves one degree of latitude in about 111 km north', () => {
    const point = destinationPoint(london, 0, 111.19)
    expect(point.lat).toBeCloseTo(52.5074, 3)
    expect(point.lng).toBeCloseTo(london.lng, 6)
  })

  it('lands the requested distance away on any bearing', () => {
    for (const bearing of [0, 45, 135, 200, 315]) {
      expect(haversineKm(manchester, destinationPoint(manchester, bearing, 12))).toBeCloseTo(12, 6)
    }
  })

  it('wraps longitude across the date line', () => {
    expect(destinationPoint({ lat: 0, lng: 179.5 }, 90, 111.19).lng).toBeCloseTo(-179.5, 3)
  })

  it('returns the origin for zero distance and rejects bad input', () => {
    const same = destinationPoint(glasgow, 90, 0)
    expect(same.lat).toBeCloseTo(glasgow.lat, 9)
    expect(same.lng).toBeCloseTo(glasgow.lng, 9)
    expect(() => destinationPoint(glasgow, 90, -1)).toThrow(RangeError)
    expect(() => destinationPoint(glasgow, Number.NaN, 1)).toThrow(RangeError)
  })
})

describe('estimateDriveMinutes', () => {
  it('applies a 1.3 road factor at 40 mph by default', () => {
    // 40 miles × 1.3 = 52 road miles at 40 mph = 78 minutes
    expect(estimateDriveMinutes(40)).toBeCloseTo(78, 9)
    expect(estimateDriveMinutes(0)).toBe(0)
  })

  it('takes a custom road factor and speed', () => {
    expect(estimateDriveMinutes(30, { roadFactor: 1, averageSpeedMph: 60 })).toBeCloseTo(30, 9)
    expect(estimateDriveMinutes(30, { averageSpeedMph: 30 })).toBeCloseTo(78, 9)
  })

  it('puts Glasgow to Edinburgh just outside the 75-minute target', () => {
    const minutes = estimateDriveMinutes(haversineMiles(glasgow, edinburgh))
    expect(minutes).toBeGreaterThan(80)
    expect(minutes).toBeLessThan(83)
  })

  it('rejects unusable input', () => {
    expect(() => estimateDriveMinutes(-1)).toThrow(RangeError)
    expect(() => estimateDriveMinutes(Number.POSITIVE_INFINITY)).toThrow(RangeError)
    expect(() => estimateDriveMinutes(10, { roadFactor: 0.9 })).toThrow(RangeError)
    expect(() => estimateDriveMinutes(10, { averageSpeedMph: 0 })).toThrow(RangeError)
  })
})

describe('reachKm', () => {
  it('puts 75 minutes about 62 km away in a straight line', () => {
    // 75 min at 40 mph = 50 road miles ÷ 1.3 = 38.5 straight-line miles
    expect(reachKm()).toBeCloseTo((50 / 1.3) * KM_PER_MILE, 9)
    expect(reachKm()).toBeCloseTo(61.9, 1)
  })

  it('is the inverse of estimateDriveMinutes', () => {
    for (const minutes of [0, 20, 75, 140]) {
      expect(estimateDriveMinutes(reachKm(minutes) / KM_PER_MILE)).toBeCloseTo(minutes, 9)
    }
    expect(reachKm(60, { roadFactor: 1, averageSpeedMph: 30 })).toBeCloseTo(30 * KM_PER_MILE, 9)
  })

  it('rejects unusable input', () => {
    expect(() => reachKm(-1)).toThrow(RangeError)
    expect(() => reachKm(30, { roadFactor: 0.5 })).toThrow(RangeError)
    expect(() => reachKm(30, { averageSpeedMph: 0 })).toThrow(RangeError)
  })
})

describe('isWithinTarget', () => {
  it('uses the 75-minute target by default, inclusive', () => {
    expect(RESPONSE_TARGET_MINUTES).toBe(75)
    expect(isWithinTarget(0)).toBe(true)
    expect(isWithinTarget(75)).toBe(true)
    expect(isWithinTarget(75.1)).toBe(false)
  })

  it('takes a custom target', () => {
    expect(isWithinTarget(55, 60)).toBe(true)
    expect(isWithinTarget(65, 60)).toBe(false)
  })

  it('treats an unreachable site as missing the target', () => {
    expect(isWithinTarget(Number.POSITIVE_INFINITY)).toBe(false)
  })

  it('rejects unusable input', () => {
    expect(() => isWithinTarget(-5)).toThrow(RangeError)
    expect(() => isWithinTarget(Number.NaN)).toThrow(RangeError)
    expect(() => isWithinTarget(30, 0)).toThrow(RangeError)
  })
})
