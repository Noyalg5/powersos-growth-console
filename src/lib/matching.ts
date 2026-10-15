/**
 * Responder matching: who is offered an emergency, and in what order.
 *
 * The nearest responders form the candidate pool. Each is scored out of 100 on
 * four factors, shown separately so the ranking can be checked by hand:
 *
 * - ETA (50): all 50 at 0 min, falling in a straight line to 0 at the 2 h limit.
 * - Rating (25): 0 at 3.0, all 25 at 5.0.
 * - Availability (15): cover at the hour of the request.
 * - Compliance (10): HV authorisation and insurance both valid.
 *
 * Availability and compliance are pass or fail: a responder without cover at that
 * hour, or with lapsed or missing paperwork, is excluded with the reason rather
 * than scored low, and so is anyone over the ETA limit. ETA and rating therefore
 * decide the order among those who pass. The same eligibility rule drives the
 * coverage map (coverage.ts).
 */
import type { LatLng, Responder, Timestamp } from '@/types'
import { formatDate, formatDuration, formatNumber } from './format'
import { estimateDriveMinutes, haversineMiles } from './geo'
import { DAY_MS, isOvernight, isWeekend, londonClock } from './time'

/** Responders further away than this are never offered the job. */
export const MAX_OFFER_ETA_MINUTES = 120
/** How many of the nearest responders are considered. */
export const CANDIDATE_POOL_SIZE = 8
/** Paperwork expiring within this many days is flagged (it does not change the score). */
export const RENEWAL_WARNING_DAYS = 90

export const FACTOR_WEIGHTS = { eta: 50, rating: 25, availability: 15, compliance: 10 } as const
export type Factor = keyof typeof FACTOR_WEIGHTS
export const FACTORS = Object.keys(FACTOR_WEIGHTS) as Factor[]

export const FACTOR_LABELS: Record<Factor, string> = {
  eta: 'ETA',
  rating: 'Rating',
  availability: 'Availability',
  compliance: 'Compliance',
}

/** Minutes from accepting a job to the crew leaving the depot. */
export const MOBILISE_MINUTES = { day: 10, overnight: 20 } as const

/** Multipliers on the estimated drive time: quiet roads overnight, slower in the rush hour. */
export const TRAFFIC_FACTORS = { overnight: 0.85, rushHour: 1.25 } as const

/** Weekday rush hours, London time: from the first hour up to (not including) the second. */
export const RUSH_HOURS: readonly (readonly [number, number])[] = [
  [7, 9],
  [16, 18],
]

export function mobiliseMinutes(at: Timestamp): number {
  return isOvernight(at) ? MOBILISE_MINUTES.overnight : MOBILISE_MINUTES.day
}

export function trafficFactor(at: Timestamp): number {
  if (isOvernight(at)) return TRAFFIC_FACTORS.overnight
  const { hour } = londonClock(at)
  const rushHour = RUSH_HOURS.some(([from, to]) => hour >= from && hour < to)
  return rushHour && !isWeekend(at) ? TRAFFIC_FACTORS.rushHour : 1
}

export interface Eta {
  /** Straight-line distance, to one decimal place. */
  miles: number
  /** Drive time with traffic, in whole minutes. */
  driveMinutes: number
  /** Mobilisation plus drive, in whole minutes, counted from acceptance. */
  etaMinutes: number
}

/** How long a crew accepting at `at` takes to reach `to` from its depot at `from`. */
export function estimateEta(from: LatLng, to: LatLng, at: Timestamp): Eta {
  const miles = haversineMiles(from, to)
  const drive = estimateDriveMinutes(miles) * trafficFactor(at)
  return {
    miles: Math.round(miles * 10) / 10,
    driveMinutes: Math.round(drive),
    etaMinutes: Math.round(mobiliseMinutes(at) + drive),
  }
}

export type ExclusionCode =
  | 'not-on-platform'
  | 'authorisation-missing'
  | 'authorisation-expired'
  | 'insurance-expired'
  | 'no-overnight-cover'
  | 'no-weekend-cover'
  | 'eta-too-long'

export interface Exclusion {
  code: ExclusionCode
  /** The factor the responder fails on. */
  factor: Factor
  label: string
}

/**
 * What eligibility is judged against: paperwork as at `at`, and cover for the kind
 * of hour. Usually all three come from one request time (see `coverContext`); the
 * coverage map sets the kind of hour separately to ask "who covers this overnight?".
 */
export interface CoverContext {
  at: Timestamp
  overnight: boolean
  weekend: boolean
}

/** The context for a request at `at`. */
export function coverContext(at: Timestamp): CoverContext {
  return { at, overnight: isOvernight(at), weekend: isWeekend(at) }
}

/** Whether a responder's cover includes this kind of hour. */
export function hasCover(
  responder: Responder,
  { overnight, weekend }: Pick<CoverContext, 'overnight' | 'weekend'>,
): boolean {
  const { availability } = responder
  return (!overnight || availability.overnight) && (!weekend || availability.weekends)
}

/**
 * When a responder's paperwork lets it take jobs: from joining until authorisation
 * or insurance lapses, whichever comes first (exclusive). Null when there is no
 * authorisation expiry on file. Agrees with `eligibilityExclusions` by construction
 * and by test.
 */
export function eligibleWindow(responder: Responder): { from: Timestamp; until: Timestamp } | null {
  const { joinedAt, authorisationExpiry, insuranceExpiry } = responder
  if (authorisationExpiry === null) return null
  return { from: joinedAt, until: Math.min(authorisationExpiry, insuranceExpiry) }
}

/**
 * Every reason a responder cannot take a job in this context, wherever the site is:
 * not yet on the platform, lapsed or missing paperwork, or no cover at that hour.
 */
export function eligibilityExclusions(responder: Responder, context: CoverContext): Exclusion[] {
  const out: Exclusion[] = []
  const { at } = context
  const { joinedAt, authorisationExpiry, insuranceExpiry } = responder
  if (joinedAt > at) {
    out.push({
      code: 'not-on-platform',
      factor: 'availability',
      label: `Joins ${formatDate(joinedAt)}`,
    })
  }
  if (authorisationExpiry === null) {
    out.push({
      code: 'authorisation-missing',
      factor: 'compliance',
      label: 'No authorisation expiry on file',
    })
  } else if (authorisationExpiry <= at) {
    out.push({
      code: 'authorisation-expired',
      factor: 'compliance',
      label: `Authorisation expired ${formatDate(authorisationExpiry)}`,
    })
  }
  if (insuranceExpiry <= at) {
    out.push({
      code: 'insurance-expired',
      factor: 'compliance',
      label: `Insurance expired ${formatDate(insuranceExpiry)}`,
    })
  }
  if (!hasCover(responder, { overnight: context.overnight, weekend: false })) {
    out.push({ code: 'no-overnight-cover', factor: 'availability', label: 'No overnight cover' })
  }
  if (!hasCover(responder, { overnight: false, weekend: context.weekend })) {
    out.push({ code: 'no-weekend-cover', factor: 'availability', label: 'No weekend cover' })
  }
  return out
}

/** Whether a responder can take a job in this context. */
export function isEligible(responder: Responder, context: CoverContext): boolean {
  return eligibilityExclusions(responder, context).length === 0
}

/** Every check the responder fails for a job `eta` minutes away requested at `at`. */
export function exclusionsFor(responder: Responder, eta: number, at: Timestamp): Exclusion[] {
  const out = eligibilityExclusions(responder, coverContext(at))
  if (eta > MAX_OFFER_ETA_MINUTES) {
    out.push({
      code: 'eta-too-long',
      factor: 'eta',
      label: `ETA ${formatDuration(eta)}, over the ${formatDuration(MAX_OFFER_ETA_MINUTES)} limit`,
    })
  }
  return out
}

export interface FactorScore {
  factor: Factor
  points: number
  max: number
  /** The fact behind the points, e.g. "52 min" or "4.2 of 5". */
  detail: string
  /** Worth a look even though it passes, e.g. insurance renewing soon. */
  attention: boolean
}

const oneDecimal = (value: number) => Math.round(value * 10) / 10
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Points for a responder that has passed every check, to one decimal place. */
function scoreFactors(responder: Responder, eta: number, at: Timestamp): FactorScore[] {
  const { rating, availability, authorisationExpiry, insuranceExpiry } = responder
  // Only scored once every check has passed, so authorisation is on file
  const renewsFirst =
    authorisationExpiry !== null && authorisationExpiry <= insuranceExpiry
      ? { what: 'Authorisation', at: authorisationExpiry }
      : { what: 'Insurance', at: insuranceExpiry }
  const renewalDue = renewsFirst.at - at < RENEWAL_WARNING_DAYS * DAY_MS
  const cover = isOvernight(at) ? 'Overnight cover, ' : isWeekend(at) ? 'Weekend cover, ' : ''

  return [
    {
      factor: 'eta',
      points: oneDecimal(FACTOR_WEIGHTS.eta * clamp01(1 - eta / MAX_OFFER_ETA_MINUTES)),
      max: FACTOR_WEIGHTS.eta,
      detail: formatDuration(eta),
      attention: false,
    },
    {
      factor: 'rating',
      points: oneDecimal(FACTOR_WEIGHTS.rating * clamp01((rating - 3) / 2)),
      max: FACTOR_WEIGHTS.rating,
      detail: `${formatNumber(rating, 1)} of 5`,
      attention: false,
    },
    {
      factor: 'availability',
      points: FACTOR_WEIGHTS.availability,
      max: FACTOR_WEIGHTS.availability,
      detail: `${cover}${availability.onCallEngineers} on call`,
      attention: false,
    },
    {
      factor: 'compliance',
      points: FACTOR_WEIGHTS.compliance,
      max: FACTOR_WEIGHTS.compliance,
      detail: renewalDue
        ? `${renewsFirst.what} renews ${formatDate(renewsFirst.at)}`
        : `Valid to ${formatDate(renewsFirst.at)}`,
      attention: renewalDue,
    },
  ]
}

export interface Candidate extends Eta {
  responder: Responder
  exclusions: Exclusion[]
  /** Empty for excluded candidates: they are never scored. */
  factors: FactorScore[]
  score: number
}

export interface MatchResult {
  at: Timestamp
  overnight: boolean
  weekend: boolean
  /** Eligible candidates, best first. */
  ranked: Candidate[]
  /** Candidates that failed a hard check, nearest first. */
  excluded: Candidate[]
  /** Responders outside the candidate pool. */
  notConsidered: number
  /** The top-ranked candidate, or null when nobody is eligible. */
  chosen: Candidate | null
}

export interface MatchOptions {
  poolSize?: number
}

/** Rank responders for an emergency at `site`, requested at `at`. */
export function matchResponders(
  responders: readonly Responder[],
  site: LatLng,
  at: Timestamp,
  { poolSize = CANDIDATE_POOL_SIZE }: MatchOptions = {},
): MatchResult {
  if (!Number.isInteger(poolSize) || poolSize < 1) {
    throw new RangeError(`poolSize must be a positive integer, got ${poolSize}`)
  }
  const pool = responders
    .map((responder) => ({ responder, ...estimateEta(responder, site, at) }))
    .sort((a, b) => a.etaMinutes - b.etaMinutes || a.responder.id.localeCompare(b.responder.id))
    .slice(0, poolSize)

  const candidates: Candidate[] = pool.map((entry) => {
    const exclusions = exclusionsFor(entry.responder, entry.etaMinutes, at)
    const factors =
      exclusions.length > 0 ? [] : scoreFactors(entry.responder, entry.etaMinutes, at)
    const score = oneDecimal(factors.reduce((sum, f) => sum + f.points, 0))
    return { ...entry, exclusions, factors, score }
  })

  const ranked = candidates
    .filter((c) => c.exclusions.length === 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.etaMinutes - b.etaMinutes ||
        b.responder.rating - a.responder.rating ||
        a.responder.id.localeCompare(b.responder.id),
    )

  return {
    at,
    overnight: isOvernight(at),
    weekend: isWeekend(at),
    ranked,
    excluded: candidates.filter((c) => c.exclusions.length > 0),
    notConsidered: Math.max(0, responders.length - pool.length),
    chosen: ranked[0] ?? null,
  }
}

const signed = (points: number) => `${points > 0 ? '+' : '−'}${formatNumber(Math.abs(points), 1)}`

/** Plain-English reasons the top candidate won, for showing under the ranking. */
export function explainMatch({ ranked, excluded }: MatchResult): string[] {
  const [winner, runnerUp] = ranked
  if (!winner) {
    return [`No responder passes every check within ${formatDuration(MAX_OFFER_ETA_MINUTES)}.`]
  }
  const name = winner.responder.name
  const lines: string[] = []

  if (!runnerUp) {
    lines.push(`${name} is the only responder that passes every check.`)
  } else {
    const margin = oneDecimal(winner.score - runnerUp.score)
    const other = runnerUp.responder.name
    const score = formatNumber(winner.score, 1)
    if (margin > 0) {
      lines.push(`${name} scores ${score}, ${formatNumber(margin, 1)} points ahead of ${other}.`)
    } else {
      const tieBreak =
        winner.etaMinutes < runnerUp.etaMinutes
          ? 'goes first on the shorter ETA'
          : winner.responder.rating > runnerUp.responder.rating
            ? 'goes first on the higher rating'
            : 'goes first on responder ID'
      lines.push(`${name} ties with ${other} on ${score} and ${tieBreak}.`)
    }
    const deltas = winner.factors
      .map((f, i) => {
        const other = runnerUp.factors[i] as FactorScore
        return { winner: f, other, delta: oneDecimal(f.points - other.points) }
      })
      .filter((d) => d.delta !== 0)
      .sort((a, b) => b.delta - a.delta)
    for (const { winner: f, other, delta } of deltas) {
      lines.push(
        `${FACTOR_LABELS[f.factor]}: ${f.detail} against ${other.detail} (${signed(delta)}).`,
      )
    }
  }

  const nearer = excluded.filter((c) => c.etaMinutes < winner.etaMinutes)
  if (nearer.length > 0) {
    const list = nearer
      .map((c) => `${c.responder.name} (${c.exclusions.map((e) => e.label).join('; ')})`)
      .join(', ')
    lines.push(`Nearer but excluded: ${list}.`)
  }
  return lines
}
