import { callOutCharge, labourCharge } from '@/lib/costs'
import { estimateDriveMinutes, haversineMiles } from '@/lib/geo'
import type { Rng } from '@/lib/rng'
import { DAY_MS, isOvernight, isWeekend, londonClock, MINUTE_MS } from '@/lib/time'
import type { CallOut, Customer, FaultType, Responder, Site, Timestamp } from '@/types'
import { clamp, makeId, money, roundTo } from './helpers'

export const CALL_OUT_COUNT = 400

interface FaultProfile {
  weight: number
  /** Time on site to make safe and restore, in minutes. */
  repairMinutes: [min: number, max: number]
  /** Parts cost, in pounds. */
  parts: [min: number, max: number]
}

export const FAULT_PROFILES: Record<FaultType, FaultProfile> = {
  'switchgear-trip': { weight: 20, repairMinutes: [45, 180], parts: [0, 800] },
  cable: { weight: 18, repairMinutes: [180, 480], parts: [400, 3500] },
  rmu: { weight: 14, repairMinutes: [120, 360], parts: [300, 6000] },
  protection: { weight: 12, repairMinutes: [60, 180], parts: [150, 1500] },
  transformer: { weight: 10, repairMinutes: [180, 600], parts: [500, 12000] },
  'earth-fault': { weight: 10, repairMinutes: [90, 300], parts: [100, 2000] },
  generator: { weight: 8, repairMinutes: [60, 240], parts: [100, 1800] },
  'loss-of-supply': { weight: 8, repairMinutes: [30, 120], parts: [0, 0] },
}

/** London hour → relative chance of a fault being reported. */
const HOUR_WEIGHTS = [
  0.45, 0.45, 0.45, 0.45, 0.45, 0.5, 0.6, 0.9, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2, 1.2,
  1.0, 0.8, 0.8, 0.8, 0.55, 0.5,
]
const MAX_HOUR_WEIGHT = Math.max(...HOUR_WEIGHTS)

/** Faults peak in mid-January (cold, wet, peak load) and bottom out in mid-July. */
function seasonWeight(timestamp: Timestamp): number {
  const yearStart = Date.UTC(new Date(timestamp).getUTCFullYear(), 0, 1)
  const dayOfYear = (timestamp - yearStart) / DAY_MS
  return 1 + 0.55 * Math.cos((2 * Math.PI * (dayOfYear - 15)) / 365.25)
}

/** Split `total` in proportion to `weights`, using largest remainders so the parts add up. */
function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / sum) * total)
  const parts = exact.map(Math.floor)
  const byRemainder = exact.map((x, i) => ({ i, r: x - Math.floor(x) })).sort((a, b) => b.r - a.r)
  const shortfall = total - parts.reduce((a, b) => a + b, 0)
  for (let k = 0; k < shortfall; k++) {
    const { i } = byRemainder[k] as { i: number }
    parts[i] = (parts[i] ?? 0) + 1
  }
  return parts
}

/**
 * Request times over the 12 months to `asOf`. Each calendar month gets a fixed share
 * by season, so the winter peak is always visible; within a month, times follow the
 * hour of day and run a little lighter at weekends.
 */
function sampleRequestTimes(rng: Rng, asOf: Timestamp, count: number): Timestamp[] {
  const start = asOf - 365 * DAY_MS
  // Stop a day short so every job is resolved by `asOf`
  const end = asOf - DAY_MS

  const months: { from: number; to: number }[] = []
  for (let from = start; from < end;) {
    const date = new Date(from)
    const to = Math.min(end, Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
    months.push({ from, to })
    from = to
  }
  const quotas = apportion(
    count,
    months.map(({ from, to }) => ((to - from) / DAY_MS) * seasonWeight((from + to) / 2)),
  )

  const times: Timestamp[] = []
  months.forEach(({ from, to }, i) => {
    for (let n = 0; n < (quotas[i] ?? 0);) {
      const t = Math.floor(rng.float(from, to) / MINUTE_MS) * MINUTE_MS
      const weight = (HOUR_WEIGHTS[londonClock(t).hour] ?? 1) * (isWeekend(t) ? 0.85 : 1)
      if (rng.next() * MAX_HOUR_WEIGHT < weight) {
        times.push(t)
        n++
      }
    }
  })
  return times.sort((a, b) => a - b)
}

/** Older, bigger and oil-filled installations fault more often. */
function siteWeight(site: Site): number {
  const hasOil = site.equipment.some(
    (item) => (item.kind === 'rmu' || item.kind === 'switchgear') && item.insulation === 'oil',
  )
  return 1 + 0.25 * site.equipment.length + (hasOil ? 0.8 : 0)
}

interface RequestContext {
  at: Timestamp
  overnight: boolean
  weekend: boolean
}

function canTake(responder: Responder, { at, overnight, weekend }: RequestContext): boolean {
  if (responder.joinedAt > at) return false
  // Suspended once authorisation or insurance lapses
  if (responder.authorisationExpiry !== null && responder.authorisationExpiry <= at) return false
  if (responder.insuranceExpiry <= at) return false
  if (overnight && !responder.availability.overnight) return false
  if (weekend && !responder.availability.weekends) return false
  return true
}

/** Multiplier on the estimated drive time for traffic at that hour. */
function trafficFactor(rng: Rng, { at, overnight, weekend }: RequestContext): number {
  if (overnight) return rng.float(0.75, 0.9)
  const { hour } = londonClock(at)
  const rushHour = !weekend && ((hour >= 7 && hour < 9) || (hour >= 16 && hour < 18))
  return rushHour ? rng.float(1.15, 1.4) : rng.float(0.9, 1.15)
}

export interface CallOutOptions {
  rng: Rng
  customers: readonly Customer[]
  responders: readonly Responder[]
  asOf: Timestamp
}

export function generateCallOuts({ rng, customers, responders, asOf }: CallOutOptions): CallOut[] {
  const sitesWithJoinDate = customers.flatMap((customer) =>
    customer.sites.map((site) => ({ site, joinedAt: customer.joinedAt })),
  )
  const faultWeights = (Object.keys(FAULT_PROFILES) as FaultType[]).map((fault) => ({
    value: fault,
    weight: FAULT_PROFILES[fault].weight,
  }))

  return sampleRequestTimes(rng, asOf, CALL_OUT_COUNT).map((requestedAt, index): CallOut => {
    const eligibleSites = sitesWithJoinDate.filter(({ joinedAt }) => joinedAt <= requestedAt)
    const site = rng.weighted(
      eligibleSites.map(({ site }) => ({ value: site, weight: siteWeight(site) })),
    )

    const context = {
      at: requestedAt,
      overnight: isOvernight(requestedAt),
      weekend: isWeekend(requestedAt),
    }

    // The customer sees the responders who could be there soonest and picks by ETA,
    // by rating, or on their own judgement
    const ranked = responders
      .filter((responder) => canTake(responder, context))
      .map((responder) => {
        const miles = haversineMiles(responder, site)
        return { responder, miles, minutes: estimateDriveMinutes(miles) }
      })
      .sort((a, b) => a.minutes - b.minutes)
    const fastest = ranked[0]
    if (!fastest) throw new Error(`No responder available at ${requestedAt}`)
    const shortlist = ranked.filter((r) => r.minutes <= fastest.minutes + 20).slice(0, 4)
    const choice = rng.next()
    const chosen =
      choice < 0.55
        ? fastest
        : choice < 0.85
          ? shortlist.reduce((best, r) => (r.responder.rating > best.responder.rating ? r : best))
          : rng.pick(shortlist)
    const { responder, miles, minutes } = chosen

    // Time to accept, mobilise and drive
    let matchMinutes = clamp(rng.normal(4, 2), 1, 12) * (context.overnight ? 1.5 : 1)
    if (rng.chance(0.04)) matchMinutes = rng.float(15, 35)
    const mobiliseMinutes = context.overnight ? rng.float(10, 25) : rng.float(5, 15)
    const driveMinutes = minutes * trafficFactor(rng, context)

    const faultType = rng.weighted(faultWeights)
    const fault = FAULT_PROFILES[faultType]
    const repairMinutes = rng.float(...fault.repairMinutes)

    const toMinute = (t: number) => Math.round(t / MINUTE_MS) * MINUTE_MS
    const acceptedAt = toMinute(requestedAt + matchMinutes * MINUTE_MS)
    const arrivedAt = toMinute(acceptedAt + (mobiliseMinutes + driveMinutes) * MINUTE_MS)
    const resolvedAt = toMinute(arrivedAt + repairMinutes * MINUTE_MS)

    const outOfHours = context.overnight || context.weekend
    const hasGenerator = site.equipment.some((item) => item.kind === 'generator')
    const needsHire =
      (!hasGenerator && repairMinutes > 180) || (faultType === 'generator' && repairMinutes > 120)

    // Ratings follow the responder's average, marked down for missing the 75-minute target
    const responseMinutes = (arrivedAt - requestedAt) / MINUTE_MS
    const adjustment =
      responseMinutes > 90 ? -1 : responseMinutes > 75 ? -0.5 : responseMinutes < 45 ? 0.3 : 0
    const rating = clamp(Math.round(rng.normal(responder.rating + adjustment, 0.5)), 1, 5)

    return {
      id: makeId('CO', index + 1, 4),
      siteId: site.id,
      customerId: site.customerId,
      responderId: responder.id,
      faultType,
      requestedAt,
      acceptedAt,
      arrivedAt,
      resolvedAt,
      distanceMiles: roundTo(miles, 1),
      cost: {
        callOutFee: callOutCharge(responder.rates, outOfHours),
        labour: labourCharge(responder.rates, repairMinutes, outOfHours),
        parts: money(rng.float(...fault.parts)),
        generatorHire: needsHire ? rng.int(45, 160) * 10 : 0,
      },
      rating,
    }
  })
}
