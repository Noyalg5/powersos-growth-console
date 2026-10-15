/**
 * Call-out billing and cost prediction. The billing rules are the ones every
 * synthetic call-out is invoiced under, so a simulated job is priced the same way
 * as the jobs on record, and predictions are read from that record.
 */
import type { CallOut, CallOutRates, CostBreakdown, FaultType } from '@/types'

/** HV switching is never done alone: every attendance is a two-person crew. */
export const CREW_SIZE = 2

const toPence = (amount: number) => Math.round(amount * 100) / 100

function assertMinutes(minutes: number) {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`minutes must be a non-negative number, got ${minutes}`)
  }
}

/** Time on site is billed in half hours, with a minimum of one hour. */
export function billableHours(minutesOnSite: number): number {
  assertMinutes(minutesOnSite)
  return Math.max(1, Math.ceil((minutesOnSite / 60) * 2) / 2)
}

/** Fixed fee per attendance, with the out-of-hours multiplier when it applies. */
export function callOutCharge(rates: CallOutRates, outOfHours: boolean): number {
  return toPence(rates.callOutFee * (outOfHours ? rates.outOfHoursMultiplier : 1))
}

/** Billable hours for the whole crew at the responder's hourly rate. */
export function labourCharge(
  rates: CallOutRates,
  minutesOnSite: number,
  outOfHours: boolean,
): number {
  const multiplier = outOfHours ? rates.outOfHoursMultiplier : 1
  return toPence(billableHours(minutesOnSite) * rates.hourlyRate * CREW_SIZE * multiplier)
}

/** Everything on the invoice, to the penny. */
export function costTotal(cost: CostBreakdown): number {
  return toPence(cost.callOutFee + cost.labour + cost.parts + cost.generatorHire)
}

/** The responder's share of an invoice: attendance and labour. */
export function responseCharge(cost: CostBreakdown): number {
  return toPence(cost.callOutFee + cost.labour)
}

/** What the job used rather than the work: parts and generator hire. */
export function materialsCharge(cost: CostBreakdown): number {
  return toPence(cost.parts + cost.generatorHire)
}

/** Middle value, or the mean of the two middle values. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new RangeError('median() needs at least one value')
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] as number
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] as number) + upper) / 2
}

/** What past call-outs for one kind of fault took and cost. */
export interface FaultHistory {
  faultType: FaultType
  jobs: number
  /** Minutes from arrival on site to resolution. */
  medianRepairMinutes: number
  longestRepairMinutes: number
  medianParts: number
  largestParts: number
}

export function faultHistory(callOuts: readonly CallOut[], faultType: FaultType): FaultHistory {
  const jobs = callOuts.filter((c) => c.faultType === faultType)
  if (jobs.length === 0) throw new RangeError(`No ${faultType} call-outs on record`)
  const repairs = jobs.map((c) => (c.resolvedAt - c.arrivedAt) / 60_000)
  const parts = jobs.map((c) => c.cost.parts)
  return {
    faultType,
    jobs: jobs.length,
    medianRepairMinutes: Math.round(median(repairs)),
    longestRepairMinutes: Math.round(Math.max(...repairs)),
    medianParts: toPence(median(parts)),
    largestParts: Math.max(...parts),
  }
}

/**
 * Median generator hire charge on record. Every hire on record was for a job of
 * under a day, so it doubles as a day rate.
 */
export function hireDayRate(callOuts: readonly CallOut[]): number {
  const charges = callOuts.map((c) => c.cost.generatorHire).filter((charge) => charge > 0)
  if (charges.length === 0) throw new RangeError('No generator hire on record')
  return toPence(median(charges))
}
