/**
 * Pricing sandbox: a what-if model of membership pricing. PowerSOS has not published
 * its pricing, so every input is an assumption or a default read from the synthetic
 * data, and every output is illustrative.
 *
 * The model:
 * - A member pays a monthly fee per site that includes a number of call-outs a year,
 *   or unlimited call-outs. Any beyond the allowance cost the pay-per-call-out price.
 * - A call-out here means the emergency response: attendance and labour. Parts and
 *   generator hire are paid for whichever way the customer buys the response, so they
 *   are left out of the customer comparison. Suppliers pay the platform a margin on them.
 * - Responders get their payout share of the pay-per-call-out price for every call-out,
 *   whether it is included in a membership or charged.
 * - Every site has the average number of call-outs. Real sites vary, so charges beyond
 *   the allowance come out lower than they would when a few sites call out often.
 */
import { formatGBP, formatList, formatNumber } from './format'

export interface Tier {
  id: string
  name: string
  /** Pounds per site per month. */
  pricePerSite: number
  /** Call-outs included per site a year; null for unlimited. */
  allowance: number | null
  customers: number
}

export interface PricingInputs {
  /** One to three membership tiers. */
  tiers: Tier[]
  /** Pounds per call-out beyond a tier's allowance. */
  payPerCallOut: number
  /** Pounds a call-out's attendance and labour cost a customer without PowerSOS. */
  adHocCost: number
  /** Pounds of parts and generator hire per call-out. */
  materialsPerCallOut: number
  /** Share of the pay-per-call-out price paid to the responder, 0–1. */
  responderPayout: number
  /** Share of parts and hire that suppliers pay the platform, 0–1. */
  supplierMargin: number
  sitesPerCustomer: number
  /** Call-outs per site per year. */
  callOutsPerSite: number
  /** New customers a month. */
  newCustomers: number
  /** Share of customers who leave each month, 0–1. */
  monthlyChurn: number
}

export type NumericInput = Exclude<keyof PricingInputs, 'tiers'>
export type TierNumber = 'pricePerSite' | 'allowance' | 'customers'

export interface Limit {
  min: number
  max: number
}

/** The range each input may take. Shares run 0–1 here and show as 0–100%. */
export const LIMITS: Record<NumericInput | TierNumber, Limit> = {
  pricePerSite: { min: 0, max: 10_000 },
  allowance: { min: 0, max: 100 },
  customers: { min: 0, max: 100_000 },
  payPerCallOut: { min: 0, max: 100_000 },
  adHocCost: { min: 0, max: 100_000 },
  materialsPerCallOut: { min: 0, max: 100_000 },
  responderPayout: { min: 0, max: 1 },
  supplierMargin: { min: 0, max: 1 },
  sitesPerCustomer: { min: 0, max: 1_000 },
  callOutsPerSite: { min: 0, max: 100 },
  newCustomers: { min: 0, max: 10_000 },
  monthlyChurn: { min: 0, max: 1 },
}

export const MAX_TIERS = 3
export const TIER_NAME_MAX_LENGTH = 24
export const PROJECTION_MONTHS = 24

const within = (value: number, { min, max }: Limit) =>
  Number.isFinite(value) && value >= min && value <= max

function assertInputs(inputs: PricingInputs) {
  if (inputs.tiers.length < 1 || inputs.tiers.length > MAX_TIERS) {
    throw new RangeError(`The model needs 1 to ${MAX_TIERS} tiers, got ${inputs.tiers.length}`)
  }
  for (const key of Object.keys(LIMITS) as (NumericInput | TierNumber)[]) {
    if (key === 'pricePerSite' || key === 'allowance' || key === 'customers') continue
    if (!within(inputs[key], LIMITS[key])) {
      throw new RangeError(
        `${key} must be from ${LIMITS[key].min} to ${LIMITS[key].max}, got ${inputs[key]}`,
      )
    }
  }
  for (const tier of inputs.tiers) assertTier(tier)
}

function assertTier(tier: Tier) {
  for (const key of ['pricePerSite', 'customers'] as const) {
    if (!within(tier[key], LIMITS[key])) {
      throw new RangeError(
        `${tier.name}: ${key} must be from ${LIMITS[key].min} to ${LIMITS[key].max}, got ${tier[key]}`,
      )
    }
  }
  if (tier.allowance !== null && !within(tier.allowance, LIMITS.allowance)) {
    throw new RangeError(
      `${tier.name}: allowance must be from 0 to ${LIMITS.allowance.max} or unlimited, got ${tier.allowance}`,
    )
  }
}

/** Call-outs a year beyond the allowance, at a given number of call-outs a site. */
function beyondAllowance(tier: Tier, callOuts: number): number {
  return tier.allowance === null ? 0 : Math.max(0, callOuts - tier.allowance)
}

/** What a member pays per site a year: twelve monthly fees plus call-outs beyond the allowance. */
export function memberCostPerSite(tier: Tier, callOuts: number, payPerCallOut: number): number {
  assertTier(tier)
  if (!within(callOuts, LIMITS.callOutsPerSite) || !within(payPerCallOut, LIMITS.payPerCallOut)) {
    throw new RangeError(
      `Call-outs and price must be non-negative, got ${callOuts} and ${payPerCallOut}`,
    )
  }
  return 12 * tier.pricePerSite + beyondAllowance(tier, callOuts) * payPerCallOut
}

/**
 * Call-outs per site a year at which a membership costs the same as paying ad hoc, or
 * null if it never does. Within the allowance it is 12 × price ÷ ad-hoc cost. Beyond it,
 * each extra call-out saves the ad-hoc cost less the pay-per-call-out price, so it is
 * (12 × price − allowance × pay-per-call-out) ÷ (ad-hoc cost − pay-per-call-out).
 */
export function breakEvenCallOuts(
  tier: Tier,
  payPerCallOut: number,
  adHocCost: number,
): number | null {
  assertTier(tier)
  if (!within(payPerCallOut, LIMITS.payPerCallOut) || !within(adHocCost, LIMITS.adHocCost)) {
    throw new RangeError(`Prices must be non-negative, got ${payPerCallOut} and ${adHocCost}`)
  }
  const yearly = 12 * tier.pricePerSite
  if (yearly === 0) return 0
  if (adHocCost === 0) return null
  const withinAllowance = yearly / adHocCost
  if (tier.allowance === null || withinAllowance <= tier.allowance) return withinAllowance
  if (adHocCost <= payPerCallOut) return null
  return (yearly - tier.allowance * payPerCallOut) / (adHocCost - payPerCallOut)
}

export interface TierResult {
  tier: Tier
  sites: number
  /** Everything below is per month unless it says otherwise. */
  membership: number
  callOuts: number
  /** Call-outs beyond the allowance, charged at the pay-per-call-out price. */
  charged: number
  callOutCharges: number
  supplierIncome: number
  revenue: number
  responderEarnings: number
  take: number
  /** For the customer, per site a year at the average number of call-outs. */
  memberCost: number
  adHocCost: number
  /** Ad hoc less membership: negative when the membership costs more. */
  saving: number
  breakEven: number | null
}

function tierResult(tier: Tier, inputs: PricingInputs): TierResult {
  const sites = tier.customers * inputs.sitesPerCustomer
  const callOuts = (sites * inputs.callOutsPerSite) / 12
  const charged = (sites * beyondAllowance(tier, inputs.callOutsPerSite)) / 12
  const membership = sites * tier.pricePerSite
  const callOutCharges = charged * inputs.payPerCallOut
  const supplierIncome = callOuts * inputs.materialsPerCallOut * inputs.supplierMargin
  const revenue = membership + callOutCharges + supplierIncome
  const responderEarnings = callOuts * inputs.payPerCallOut * inputs.responderPayout
  const memberCost = memberCostPerSite(tier, inputs.callOutsPerSite, inputs.payPerCallOut)
  const adHocCost = inputs.callOutsPerSite * inputs.adHocCost
  return {
    tier,
    sites,
    membership,
    callOuts,
    charged,
    callOutCharges,
    supplierIncome,
    revenue,
    responderEarnings,
    take: revenue - responderEarnings,
    memberCost,
    adHocCost,
    saving: adHocCost - memberCost,
    breakEven: breakEvenCallOuts(tier, inputs.payPerCallOut, inputs.adHocCost),
  }
}

export interface PricingResult {
  tiers: TierResult[]
  customers: number
  sites: number
  /** Monthly recurring revenue: membership fees alone. */
  mrr: number
  callOutCharges: number
  supplierIncome: number
  /** Membership, call-out charges and supplier margin. */
  revenue: number
  responderEarnings: number
  /** Revenue less responder earnings: what the platform keeps. */
  take: number
  callOuts: number
  /** What a responder is paid for one call-out. */
  payoutPerCallOut: number
}

const sum = (results: readonly TierResult[], key: keyof Omit<TierResult, 'tier' | 'breakEven'>) =>
  results.reduce((total, r) => total + r[key], 0)

/** A month of the model at today's customers. */
export function priceModel(inputs: PricingInputs): PricingResult {
  assertInputs(inputs)
  const tiers = inputs.tiers.map((tier) => tierResult(tier, inputs))
  return {
    tiers,
    customers: inputs.tiers.reduce((total, t) => total + t.customers, 0),
    sites: sum(tiers, 'sites'),
    mrr: sum(tiers, 'membership'),
    callOutCharges: sum(tiers, 'callOutCharges'),
    supplierIncome: sum(tiers, 'supplierIncome'),
    revenue: sum(tiers, 'revenue'),
    responderEarnings: sum(tiers, 'responderEarnings'),
    take: sum(tiers, 'take'),
    callOuts: sum(tiers, 'callOuts'),
    payoutPerCallOut: inputs.payPerCallOut * inputs.responderPayout,
  }
}

const callOutCount = (n: number) => `${formatNumber(n, 1)} ${n === 1 ? 'call-out' : 'call-outs'}`

/**
 * Which tiers cost a member less than paying ad hoc at the average number of call-outs,
 * and from how many call-outs the others start to pay for themselves.
 */
export function breakEvenSentence(result: PricingResult, callOutsPerSite: number): string {
  const at = `At ${callOutCount(callOutsPerSite)} per site a year`
  const cheaper = result.tiers.filter((t) => t.saving > 0)
  const dearer = result.tiers.filter((t) => t.saving < 0)
  const level = result.tiers.filter((t) => t.saving === 0)
  const names = (tiers: readonly TierResult[]) => formatList(tiers.map((t) => t.tier.name))
  const more = (t: TierResult) => `${formatGBP(-t.saving, { pence: false })} more per site a year`
  const from = (t: TierResult) =>
    t.breakEven === null
      ? 'never pays for itself, because a charged call-out costs as much as one ad hoc'
      : `pays for itself only from ${callOutCount(t.breakEven)}`

  if (cheaper.length === 0) {
    if (dearer.length === 0) return `${at}, every tier costs the same as paying ad hoc.`
    const closest = dearer.reduce((a, b) => (b.saving > a.saving ? b : a))
    return `${at}, no tier costs a member less than paying ad hoc: ${closest.tier.name} comes closest at ${more(closest)}, and ${from(closest)}.`
  }
  const clauses = [
    `${names(cheaper)} ${cheaper.length === 1 ? 'costs' : 'cost'} a member less than paying ad hoc`,
    ...(level.length > 0
      ? [`${names(level)} ${level.length === 1 ? 'costs' : 'cost'} the same`]
      : []),
    ...dearer.map((t) => `${t.tier.name} costs ${more(t)} and ${from(t)}`),
  ]
  return `${at}, ${clauses.join('; ')}.`
}

export interface ProjectionMonth {
  /** 0 is today. */
  month: number
  customers: number
  mrr: number
  revenue: number
  take: number
}

/**
 * Customers and revenue month by month. Each month every tier loses its churn share
 * and gains new customers, who join in the same mix as today's customers (or evenly
 * across the tiers when there are none yet). Customers are expected values, so they
 * can be fractional.
 */
export function projectGrowth(
  inputs: PricingInputs,
  months = PROJECTION_MONTHS,
): ProjectionMonth[] {
  assertInputs(inputs)
  if (!Number.isInteger(months) || months < 0) {
    throw new RangeError(`months must be a whole number of 0 or more, got ${months}`)
  }
  const starting = inputs.tiers.reduce((total, t) => total + t.customers, 0)
  const mix = inputs.tiers.map((t) =>
    starting === 0 ? 1 / inputs.tiers.length : t.customers / starting,
  )
  // What one customer on each tier brings in a month
  const unit = inputs.tiers.map((tier) => tierResult({ ...tier, customers: 1 }, inputs))

  let customers = inputs.tiers.map((t) => t.customers)
  const points: ProjectionMonth[] = []
  for (let month = 0; month <= months; month++) {
    if (month > 0) {
      customers = customers.map(
        (c, i) => c * (1 - inputs.monthlyChurn) + inputs.newCustomers * (mix[i] ?? 0),
      )
    }
    const total = (key: 'membership' | 'revenue' | 'take') =>
      customers.reduce((acc, c, i) => acc + c * (unit[i]?.[key] ?? 0), 0)
    points.push({
      month,
      customers: customers.reduce((acc, c) => acc + c, 0),
      mrr: total('membership'),
      revenue: total('revenue'),
      take: total('take'),
    })
  }
  return points
}

/** What the synthetic data says, for the inputs that can be read from it. */
export interface PricingEvidence {
  /** Customers live today. */
  liveCustomers: number
  sitesPerCustomer: number
  /** Call-outs per site per year of membership. */
  callOutsPerSite: number
  /** Average attendance and labour per call-out. */
  responseCost: number
  /** Average parts and generator hire per call-out. */
  materialsCost: number
  /** New customers a month over the last year. */
  newCustomers: number
  monthlyChurn: number
}

/** Assumed tiers. Today's customers are split across them in these shares. */
export const DEFAULT_TIERS: readonly (Omit<Tier, 'customers'> & { share: number })[] = [
  { id: 'essentials', name: 'Essentials', pricePerSite: 95, allowance: 1, share: 0.4 },
  { id: 'standard', name: 'Standard', pricePerSite: 265, allowance: 3, share: 0.4 },
  { id: 'unlimited', name: 'Unlimited', pricePerSite: 325, allowance: null, share: 0.2 },
]

/** Assumptions with nothing in the synthetic data to read them from. */
export const DEFAULT_ASSUMPTIONS = {
  payPerCallOut: 1_350,
  responderPayout: 0.85,
  supplierMargin: 0.1,
} as const

/** Whole numbers that add up to `total`, in proportion to `shares`, by largest remainder. */
function apportion(total: number, shares: readonly number[]): number[] {
  const exact = shares.map((s) => s * total)
  const parts = exact.map(Math.floor)
  const order = exact
    .map((x, i) => ({ i, remainder: x - Math.floor(x) }))
    .sort((a, b) => b.remainder - a.remainder)
  let left = total - parts.reduce((acc, p) => acc + p, 0)
  for (const { i } of order) {
    if (left <= 0) break
    parts[i] = (parts[i] ?? 0) + 1
    left--
  }
  return parts
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step
/** Rounded to the step an input moves in, without floating-point tails. */
const tidy = (value: number, step: number) => Number(roundTo(value, step).toFixed(6))

export function defaultPricingInputs(evidence: PricingEvidence): PricingInputs {
  const split = apportion(
    Math.round(evidence.liveCustomers),
    DEFAULT_TIERS.map((t) => t.share),
  )
  return {
    tiers: DEFAULT_TIERS.map(({ share: _share, ...tier }, i) => ({
      ...tier,
      customers: split[i] ?? 0,
    })),
    ...DEFAULT_ASSUMPTIONS,
    adHocCost: Math.round(evidence.responseCost),
    materialsPerCallOut: Math.round(evidence.materialsCost),
    sitesPerCustomer: tidy(evidence.sitesPerCustomer, 0.1),
    callOutsPerSite: tidy(evidence.callOutsPerSite, 0.1),
    newCustomers: tidy(evidence.newCustomers, 0.1),
    monthlyChurn: tidy(evidence.monthlyChurn, 0.001),
  }
}

/** A tier to add: a copy of the last one with nobody on it yet. */
export function nextTier(tiers: readonly Tier[]): Tier | null {
  if (tiers.length >= MAX_TIERS) return null
  const last = tiers[tiers.length - 1]
  let n = tiers.length + 1
  while (tiers.some((t) => t.id === `tier-${n}`)) n++
  return {
    id: `tier-${n}`,
    name: `Tier ${tiers.length + 1}`,
    pricePerSite: last?.pricePerSite ?? 0,
    allowance: last?.allowance ?? 0,
    customers: 0,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const validNumber = (value: unknown, limit: Limit): value is number =>
  typeof value === 'number' && within(value, limit)

function restoreTier(raw: unknown, fallback: Tier | undefined, index: number): Tier | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || raw.id === '') return null
  const name =
    typeof raw.name === 'string' && raw.name.trim() !== ''
      ? raw.name.slice(0, TIER_NAME_MAX_LENGTH)
      : (fallback?.name ?? `Tier ${index + 1}`)
  const number = (key: 'pricePerSite' | 'customers') =>
    validNumber(raw[key], LIMITS[key]) ? raw[key] : (fallback?.[key] ?? 0)
  const saved = raw.allowance
  const allowance =
    saved === null
      ? null
      : validNumber(saved, LIMITS.allowance)
        ? saved
        : (fallback?.allowance ?? null)
  return {
    id: raw.id,
    name,
    pricePerSite: number('pricePerSite'),
    allowance,
    customers: number('customers'),
  }
}

/** Saved inputs, checked field by field; anything invalid falls back to its default. */
export function restorePricingInputs(raw: unknown, defaults: PricingInputs): PricingInputs {
  if (!isRecord(raw)) return defaults
  const savedTiers = Array.isArray(raw.tiers) ? raw.tiers : []
  const tiers = savedTiers.slice(0, MAX_TIERS).map((t, i) =>
    restoreTier(
      t,
      defaults.tiers.find((d) => isRecord(t) && d.id === t.id),
      i,
    ),
  )
  const valid =
    tiers.every((t) => t !== null) && new Set(tiers.map((t) => t?.id)).size === tiers.length
  const restored = {
    ...defaults,
    tiers: tiers.length > 0 && valid ? (tiers as Tier[]) : defaults.tiers,
  }
  for (const key of Object.keys(defaults) as (keyof PricingInputs)[]) {
    if (key === 'tiers') continue
    const value = raw[key]
    if (validNumber(value, LIMITS[key])) restored[key] = value
  }
  return restored
}
