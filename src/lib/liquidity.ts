/**
 * Liquidity: how call-out demand meets responder supply, and the KPIs that track
 * it. Supply uses the simulator's eligibility rule (matching.ts), so a responder
 * with lapsed paperwork or no cover at that hour never counts as available.
 */
import type { CallOut, Region, Responder, Timestamp } from '@/types'
import { median } from './costs'
import { formatHour, formatNumber } from './format'
import { isWithinTarget } from './geo'
import { eligibleWindow, hasCover, isEligible } from './matching'
import { HOUR_MS, hourKind, isOvernightHour, londonClock, MINUTE_MS } from './time'

/** A call-out with the region of its site, or null when the site is no longer on file. */
export interface RegionalCallOut extends CallOut {
  region: Region | null
}

const minutes = (from: Timestamp, to: Timestamp) => (to - from) / MINUTE_MS

/** Median minutes from request to a responder accepting. Null with no call-outs. */
export function medianAcceptMinutes(callOuts: readonly CallOut[]): number | null {
  if (callOuts.length === 0) return null
  return median(callOuts.map((c) => minutes(c.requestedAt, c.acceptedAt)))
}

/** Share of call-outs with a crew on site within the 75-minute target. Null with none. */
export function onTargetShare(callOuts: readonly CallOut[]): number | null {
  if (callOuts.length === 0) return null
  const onTarget = callOuts.filter((c) => isWithinTarget(minutes(c.requestedAt, c.arrivedAt)))
  return onTarget.length / callOuts.length
}

export interface MonthCount {
  /** 00:00 UTC on the first of the month. */
  month: Timestamp
  count: number
}

/** Call-outs in each calendar month from `from` up to `until`, empty months included. */
export function monthlyCounts(
  callOuts: readonly CallOut[],
  from: Timestamp,
  until: Timestamp,
): MonthCount[] {
  if (!(until > from)) throw new RangeError('until must be after from')
  const months: MonthCount[] = []
  const start = new Date(from)
  for (
    let month = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1);
    month < until;
    month = Date.UTC(new Date(month).getUTCFullYear(), new Date(month).getUTCMonth() + 1, 1)
  ) {
    months.push({ month, count: 0 })
  }
  for (const { requestedAt } of callOuts) {
    if (requestedAt < from || requestedAt >= until) continue
    const date = new Date(requestedAt)
    const month = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)
    const entry = months.find((m) => m.month === month)
    if (entry) entry.count++
  }
  return months
}

export interface Utilisation {
  /** Accepted to resolved, summed over the responders' call-outs. */
  jobHours: number
  /** Hours each responder was eligible and offered cover, summed. */
  availableHours: number
  /** Job hours ÷ available hours. Null when nobody was available. */
  share: number | null
}

/**
 * Hours on jobs ÷ hours available, for `responders` from `from` up to `until`.
 * An hour counts as available when the responder's paperwork was valid then and
 * its cover includes that kind of hour (overnight, weekend).
 */
export function utilisation(
  responders: readonly Responder[],
  callOuts: readonly CallOut[],
  from: Timestamp,
  until: Timestamp,
): Utilisation {
  if (!(until > from)) throw new RangeError('until must be after from')
  // Classify every hour once, then count each responder's hours from running totals
  const slots = Math.ceil((until - from) / HOUR_MS)
  const kinds = [
    { overnight: false, weekend: false },
    { overnight: true, weekend: false },
    { overnight: false, weekend: true },
    { overnight: true, weekend: true },
  ]
  const totals = kinds.map(() => new Array<number>(slots + 1).fill(0))
  for (let i = 0; i < slots; i++) {
    const { overnight, weekend } = hourKind(from + i * HOUR_MS)
    const kind = Number(overnight) + 2 * Number(weekend)
    totals.forEach((running, k) => {
      running[i + 1] = (running[i] ?? 0) + (k === kind ? 1 : 0)
    })
  }
  const slotAt = (t: Timestamp) => Math.min(slots, Math.max(0, Math.ceil((t - from) / HOUR_MS)))

  let availableHours = 0
  for (const responder of responders) {
    const window = eligibleWindow(responder)
    if (!window) continue
    const first = slotAt(window.from)
    const last = slotAt(window.until)
    kinds.forEach((kind, k) => {
      if (!hasCover(responder, kind)) return
      const running = totals[k] as number[]
      availableHours += (running[last] ?? 0) - (running[first] ?? 0)
    })
  }

  const ids = new Set(responders.map((r) => r.id))
  const jobHours = callOuts
    .filter((c) => ids.has(c.responderId))
    .reduce((sum, c) => sum + (c.resolvedAt - c.acceptedAt) / HOUR_MS, 0)

  return { jobHours, availableHours, share: availableHours > 0 ? jobHours / availableHours : null }
}

export interface LiquidityCell {
  hour: number
  overnight: boolean
  /** Call-outs requested in this hour of the day. */
  demand: number
  /** Responders based in the region who could take a job at this hour. */
  supply: number
  /** More call-outs than responders available. */
  short: boolean
}

export interface LiquidityRow {
  region: Region
  cells: LiquidityCell[]
  daySupply: number
  nightSupply: number
}

/**
 * Demand against supply by region and hour of the day (London time). Supply is
 * judged on a weekday, with paperwork as at `at`; demand counts every call-out
 * passed in, so it grows with the length of the period.
 */
export function liquidityGrid(
  callOuts: readonly RegionalCallOut[],
  responders: readonly Responder[],
  regions: readonly Region[],
  at: Timestamp,
): LiquidityRow[] {
  const demand = new Map<string, number>()
  for (const callOut of callOuts) {
    if (!callOut.region) continue
    const key = `${callOut.region}|${londonClock(callOut.requestedAt).hour}`
    demand.set(key, (demand.get(key) ?? 0) + 1)
  }

  return regions.map((region) => {
    const based = responders.filter((r) => r.region === region)
    const supplyAt = (overnight: boolean) =>
      based.filter((r) => isEligible(r, { at, overnight, weekend: false })).length
    const daySupply = supplyAt(false)
    const nightSupply = supplyAt(true)
    const cells = Array.from({ length: 24 }, (_, hour): LiquidityCell => {
      const overnight = isOvernightHour(hour)
      const cellDemand = demand.get(`${region}|${hour}`) ?? 0
      const supply = overnight ? nightSupply : daySupply
      return { hour, overnight, demand: cellDemand, supply, short: cellDemand > supply }
    })
    return { region, cells, daySupply, nightSupply }
  })
}

const count = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

/**
 * Up to two plain-English findings: the region where overnight demand most
 * outstrips night cover, and the single daytime hour with the biggest shortfall.
 */
export function liquidityInsights(rows: readonly LiquidityRow[]): string[] {
  const lines: string[] = []

  const nights = rows
    .map((row) => ({
      row,
      demand: row.cells.filter((c) => c.overnight).reduce((sum, c) => sum + c.demand, 0),
    }))
    .filter(({ row, demand }) => demand > row.nightSupply)
    .sort(
      (a, b) =>
        b.demand - b.row.nightSupply - (a.demand - a.row.nightSupply) ||
        a.row.nightSupply - b.row.nightSupply ||
        a.row.region.localeCompare(b.row.region),
    )
  const night = nights[0]
  if (night) {
    const supply = night.row.nightSupply
    lines.push(
      `Overnight in ${night.row.region}: ${count(night.demand, 'call-out', 'call-outs')}, ${
        supply === 0 ? 'no responder' : count(supply, 'responder', 'responders')
      } with night cover.`,
    )
  }

  const days = rows
    .flatMap((row) => row.cells.filter((c) => !c.overnight && c.short).map((c) => ({ row, c })))
    .sort(
      (a, b) =>
        b.c.demand - b.c.supply - (a.c.demand - a.c.supply) ||
        b.c.demand - a.c.demand ||
        a.row.region.localeCompare(b.row.region) ||
        a.c.hour - b.c.hour,
    )
  const day = days[0]
  if (day) {
    lines.push(
      `Daytime peak in ${day.row.region}: ${count(day.c.demand, 'call-out', 'call-outs')} at ${formatHour(day.c.hour)} for ${
        day.c.supply === 0 ? 'no responder' : count(day.c.supply, 'responder', 'responders')
      } on cover.`,
    )
  }

  if (lines.length === 0) {
    lines.push('Call-outs stay within the responders available in every region and hour.')
  }
  return lines
}
