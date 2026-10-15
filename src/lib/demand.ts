/**
 * How often sites call out and what a call-out costs, read from the call-out record.
 * Rates are per site-year of membership: a site counts only while its customer was a
 * member within the period, so a customer who joined last month doesn't dilute the
 * rate and one who has left doesn't inflate it.
 */
import type { CallOut, Customer, Timestamp } from '@/types'
import { materialsCharge, responseCharge } from './costs'
import { DAY_MS } from './time'

export const YEAR_MS = 365 * DAY_MS

export interface Period {
  from: Timestamp
  /** Exclusive. */
  to: Timestamp
}

function assertPeriod({ from, to }: Period) {
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw new RangeError(`A period needs a finite start before its end, got ${from} to ${to}`)
  }
}

/** Call-outs split by whether their site is on record for one of the customers. */
export function callOutsAtSites(
  customers: readonly Customer[],
  callOuts: readonly CallOut[],
): { matched: CallOut[]; unmatched: CallOut[] } {
  const siteIds = new Set(customers.flatMap((c) => c.sites.map((s) => s.id)))
  const matched: CallOut[] = []
  const unmatched: CallOut[] = []
  for (const callOut of callOuts) (siteIds.has(callOut.siteId) ? matched : unmatched).push(callOut)
  return { matched, unmatched }
}

export interface CallOutRate {
  customers: number
  sites: number
  /** Call-outs requested in the period at these customers' sites. */
  callOuts: number
  /** Years of membership in the period, added up across every site. */
  siteYears: number
  /** Call-outs per site per year of membership; null with no membership in the period. */
  perSiteYear: number | null
}

/**
 * How often these customers' sites called out in the period. `leftAt` holds the
 * date each cancelled customer left; their sites stop counting from then.
 */
export function callOutRate(
  customers: readonly Customer[],
  callOuts: readonly CallOut[],
  period: Period,
  leftAt: ReadonlyMap<string, Timestamp> = new Map(),
): CallOutRate {
  assertPeriod(period)
  let siteYears = 0
  for (const customer of customers) {
    const start = Math.max(customer.joinedAt, period.from)
    const end = Math.min(leftAt.get(customer.id) ?? period.to, period.to)
    if (end > start) siteYears += (customer.sites.length * (end - start)) / YEAR_MS
  }
  const { matched } = callOutsAtSites(customers, callOuts)
  const count = matched.filter(
    (c) => c.requestedAt >= period.from && c.requestedAt < period.to,
  ).length
  return {
    customers: customers.length,
    sites: customers.reduce((sum, c) => sum + c.sites.length, 0),
    callOuts: count,
    siteYears,
    perSiteYear: siteYears > 0 ? count / siteYears : null,
  }
}

export interface JobCosts {
  jobs: number
  /** Average attendance and labour per call-out: the responder's work. */
  response: number
  /** Average parts and generator hire per call-out. */
  materials: number
}

const toPence = (amount: number) => Math.round(amount * 100) / 100

/** The average call-out on record, split into the work and what it used. */
export function averageJobCost(callOuts: readonly CallOut[]): JobCosts {
  if (callOuts.length === 0) throw new RangeError('averageJobCost() needs at least one call-out')
  const mean = (charge: (c: CallOut) => number) =>
    toPence(callOuts.reduce((sum, c) => sum + charge(c), 0) / callOuts.length)
  return {
    jobs: callOuts.length,
    response: mean((c) => responseCharge(c.cost)),
    materials: mean((c) => materialsCharge(c.cost)),
  }
}
