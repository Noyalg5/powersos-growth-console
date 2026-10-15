/**
 * Sector prioritisation: the nine target sectors scored 1–5 on six criteria, with
 * weights that are normalised before use, so only their proportions matter. Three
 * criteria say how attractive a sector is and three how able we are to win it,
 * which places each sector on a 2×2. The default scores are assumptions, made to
 * be challenged; the evidence from the synthetic network sits beside them, not in them.
 */
import type { CallOut, Customer, SectorId, Timestamp } from '@/types'
import { callOutRate, type Period } from './demand'
import { formatDecimal, formatList, formatNumber } from './format'

export type CriterionId =
  'downtime' | 'hv-prevalence' | 'regulation' | 'decision-speed' | 'partner-access' | 'in-house'

export type Axis = 'attractiveness' | 'ability'

export interface Criterion {
  id: CriterionId
  label: string
  /** The label as it reads mid-sentence. */
  phrase: string
  axis: Axis
  /** False when a high score is bad for us: it counts as 6 − score. */
  higherIsBetter: boolean
  /** What a 1 and a 5 mean. */
  low: string
  high: string
}

export const CRITERIA: readonly Criterion[] = [
  {
    id: 'downtime',
    label: 'Cost of downtime',
    phrase: 'cost of downtime',
    axis: 'attractiveness',
    higherIsBetter: true,
    low: 'An outage is an inconvenience',
    high: 'Every hour without power is costly or unsafe',
  },
  {
    id: 'hv-prevalence',
    label: 'HV network prevalence',
    phrase: 'HV network prevalence',
    axis: 'attractiveness',
    higherIsBetter: true,
    low: 'Few organisations run their own HV',
    high: 'Most run a private HV network',
  },
  {
    id: 'regulation',
    label: 'Regulatory and safety pressure',
    phrase: 'regulatory and safety pressure',
    axis: 'attractiveness',
    higherIsBetter: true,
    low: 'Little outside scrutiny',
    high: 'Strict safety rules, audits and inspections',
  },
  {
    id: 'decision-speed',
    label: 'Decision speed',
    phrase: 'decision speed',
    axis: 'ability',
    higherIsBetter: true,
    low: 'Long procurement cycles',
    high: 'One manager can say yes',
  },
  {
    id: 'partner-access',
    label: 'Partner access',
    phrase: 'partner access',
    axis: 'ability',
    higherIsBetter: true,
    low: 'Hard to reach through partners',
    high: 'Reached through facilities managers, insurers or network operators',
  },
  {
    id: 'in-house',
    label: 'Competition from in-house teams',
    phrase: 'competition from in-house teams',
    axis: 'ability',
    higherIsBetter: false,
    low: 'Rarely has its own HV staff',
    high: 'Often has its own authorised persons',
  },
]

export const AXIS_LABELS: Record<Axis, string> = {
  attractiveness: 'Market attractiveness',
  ability: 'Ability to win',
}

export const SCORE_MIN = 1
export const SCORE_MAX = 5
/** Weights run from 0 to this on the sliders; only their proportions matter. */
export const WEIGHT_MAX = 10
/** Where an axis splits into low and high on the 2×2. */
export const MIDPOINT = 3

export type Weights = Record<CriterionId, number>
export type SectorScores = Record<SectorId, Record<CriterionId, number>>

export interface SectorInputs {
  weights: Weights
  scores: SectorScores
}

export interface SectorInfo {
  id: SectorId
  label: string
}

/** Assumption: what matters most is how much an outage hurts and how many run HV. */
export const DEFAULT_WEIGHTS: Weights = {
  downtime: 5,
  'hv-prevalence': 4,
  regulation: 3,
  'decision-speed': 3,
  'partner-access': 3,
  'in-house': 2,
}

const row = (
  downtime: number,
  hv: number,
  regulation: number,
  speed: number,
  partners: number,
  inHouse: number,
): Record<CriterionId, number> => ({
  downtime,
  'hv-prevalence': hv,
  regulation,
  'decision-speed': speed,
  'partner-access': partners,
  'in-house': inHouse,
})

/** Assumptions, to validate with MPN. Competition from in-house teams: 5 = strong. */
export const DEFAULT_SCORES: SectorScores = {
  medical: row(5, 5, 5, 1, 3, 4),
  education: row(2, 4, 3, 2, 4, 3),
  hospitality: row(2, 2, 2, 4, 3, 1),
  manufacturing: row(4, 4, 3, 4, 3, 4),
  aviation: row(5, 4, 5, 2, 2, 4),
  warehousing: row(3, 3, 2, 4, 4, 2),
  agriculture: row(2, 2, 2, 4, 2, 1),
  power: row(4, 5, 4, 3, 5, 4),
  telecoms: row(5, 5, 4, 4, 4, 3),
}

/** Why each sector's default scores are what they are. */
export const DEFAULT_RATIONALE: Record<SectorId, string> = {
  medical:
    'Life-safety loads and strict electrical safety rules, but procurement is slow and larger estates employ their own authorised persons.',
  education:
    'Campuses often run private HV rings with small estates teams; budgets and committees slow decisions, and facilities managers are a way in.',
  hospitality:
    'Outages hurt guests and revenue but are rarely dangerous; fewer sites run HV, almost none have HV staff, and owners decide quickly.',
  manufacturing:
    'Lost production makes downtime expensive and plants commonly take supply at HV; plant managers decide quickly, though larger plants keep their own maintenance electricians.',
  aviation:
    'Operations stop without power and scrutiny is intense, but approvals are layered and airside work is tightly controlled.',
  warehousing:
    'Cold storage and automation raise the stakes; sites are many and lightly staffed, and facilities managers run most of them.',
  agriculture:
    'Owner-run and quick to decide, but outages are usually tolerable, HV is uncommon and sites are remote.',
  power:
    'Every site connects at HV and lost export is lost revenue; network operators are natural partners, but asset owners often hold operations contracts.',
  telecoms:
    'Data centres and exchanges cannot lose power, run HV intakes as standard and buy quickly; critical-facilities teams cover some sites themselves.',
}

export const DEFAULT_SECTOR_INPUTS: SectorInputs = {
  weights: DEFAULT_WEIGHTS,
  scores: DEFAULT_SCORES,
}

/** Floating-point slack when comparing scores, so 3.6 and 3.6000000001 tie. */
const EPSILON = 1e-9

function criterion(id: CriterionId): Criterion {
  const found = CRITERIA.find((c) => c.id === id)
  if (!found) throw new Error(`Unknown criterion: ${id}`)
  return found
}

/** Weights scaled to add up to 1. */
export function normaliseWeights(weights: Weights): Weights {
  for (const c of CRITERIA) {
    const w = weights[c.id]
    if (!Number.isFinite(w) || w < 0) {
      throw new RangeError(`Weight for ${c.id} must be a non-negative number, got ${w}`)
    }
  }
  const total = CRITERIA.reduce((sum, c) => sum + weights[c.id], 0)
  if (total === 0) throw new RangeError('At least one weight must be above zero')
  return Object.fromEntries(CRITERIA.map((c) => [c.id, weights[c.id] / total])) as Weights
}

export function hasWeight(weights: Weights): boolean {
  return CRITERIA.some((c) => Number.isFinite(weights[c.id]) && weights[c.id] > 0)
}

/** A score as it counts towards the total: inverted when a high score is bad for us. */
export function effectiveScore(id: CriterionId, score: number): number {
  if (!Number.isInteger(score) || score < SCORE_MIN || score > SCORE_MAX) {
    throw new RangeError(`Scores run from ${SCORE_MIN} to ${SCORE_MAX}, got ${score} for ${id}`)
  }
  return criterion(id).higherIsBetter ? score : SCORE_MIN + SCORE_MAX - score
}

export type Quadrant = 'prioritise' | 'build-access' | 'opportunistic' | 'deprioritise'

export const QUADRANTS: Record<Quadrant, { label: string; advice: string }> = {
  prioritise: { label: 'Prioritise', advice: 'Attractive, and we can win it' },
  'build-access': { label: 'Build a way in', advice: 'Attractive, but hard to win today' },
  opportunistic: { label: 'Opportunistic', advice: 'Winnable, but less attractive' },
  deprioritise: { label: 'Deprioritise', advice: 'Neither, for now' },
}

/** High means at or above the midpoint. */
export function quadrantOf(attractiveness: number, ability: number): Quadrant {
  const attractive = attractiveness >= MIDPOINT
  const winnable = ability >= MIDPOINT
  if (attractive) return winnable ? 'prioritise' : 'build-access'
  return winnable ? 'opportunistic' : 'deprioritise'
}

export interface SectorResult {
  sector: SectorId
  label: string
  /** 1–5: the weighted average of every criterion. */
  score: number
  /** 1–5 on each axis; null when every weight on that axis is zero. */
  attractiveness: number | null
  ability: number | null
  quadrant: Quadrant | null
  /** Each criterion's share of the score: normalised weight × effective score. */
  contributions: Record<CriterionId, number>
  rank: number
}

function axisScore(axis: Axis, scores: Record<CriterionId, number>, weights: Weights) {
  const members = CRITERIA.filter((c) => c.axis === axis)
  const total = members.reduce((sum, c) => sum + weights[c.id], 0)
  if (total === 0) return null
  return (
    members.reduce((sum, c) => sum + weights[c.id] * effectiveScore(c.id, scores[c.id]), 0) / total
  )
}

/**
 * Sectors best first. Ties go to the more attractive sector, then to the order the
 * sectors are given in, so the ranking never flickers between equals.
 */
export function rankSectors(
  sectors: readonly SectorInfo[],
  scores: SectorScores,
  weights: Weights,
): SectorResult[] {
  const normalised = normaliseWeights(weights)
  const results = sectors.map((s, order) => {
    const own = scores[s.id]
    const contributions = Object.fromEntries(
      CRITERIA.map((c) => [c.id, normalised[c.id] * effectiveScore(c.id, own[c.id])]),
    ) as Record<CriterionId, number>
    const attractiveness = axisScore('attractiveness', own, weights)
    const ability = axisScore('ability', own, weights)
    return {
      order,
      result: {
        sector: s.id,
        label: s.label,
        score: CRITERIA.reduce((sum, c) => sum + contributions[c.id], 0),
        attractiveness,
        ability,
        quadrant:
          attractiveness === null || ability === null ? null : quadrantOf(attractiveness, ability),
        contributions,
        rank: 0,
      },
    }
  })
  return results
    .sort((a, b) => {
      const byScore = b.result.score - a.result.score
      if (Math.abs(byScore) > EPSILON) return byScore
      const byAttraction = (b.result.attractiveness ?? 0) - (a.result.attractiveness ?? 0)
      if (Math.abs(byAttraction) > EPSILON) return byAttraction
      return a.order - b.order
    })
    .map(({ result }, i) => ({ ...result, rank: i + 1 }))
}

export interface SectorEvidence {
  sector: SectorId
  customers: number
  /** Sites on record. */
  sites: number
  /** Average site criticality, 1–5; null with no sites. */
  averageCriticality: number | null
  callOuts: number
  /** Call-outs per site per year of membership; null with no membership in the period. */
  callOutsPerSiteYear: number | null
}

/** What the synthetic network says about each sector, measured over `period`. */
export function sectorEvidence(
  sectors: readonly SectorInfo[],
  customers: readonly Customer[],
  callOuts: readonly CallOut[],
  period: Period,
  leftAt: ReadonlyMap<string, Timestamp> = new Map(),
): Record<SectorId, SectorEvidence> {
  return Object.fromEntries(
    sectors.map((s) => {
      const inSector = customers.filter((c) => c.sector === s.id)
      const sites = inSector.flatMap((c) => c.sites)
      const rate = callOutRate(inSector, callOuts, period, leftAt)
      return [
        s.id,
        {
          sector: s.id,
          customers: inSector.length,
          sites: sites.length,
          averageCriticality:
            sites.length === 0
              ? null
              : sites.reduce((sum, site) => sum + site.criticality, 0) / sites.length,
          callOuts: rate.callOuts,
          callOutsPerSiteYear: rate.perSiteYear,
        },
      ]
    }),
  ) as Record<SectorId, SectorEvidence>
}

export interface GoFirst {
  sector: SectorId
  label: string
  score: number
  runnerUp: SectorResult | null
  /** The criteria that put it ahead of the runner-up, biggest gap first. */
  drivers: CriterionId[]
  sentence: string
}

const roundOne = (n: number) => Math.round(n * 10) / 10

/** A 1–5 score to one decimal place, rounded the same way everywhere it is shown. */
export function formatScore(score: number): string {
  return formatDecimal(roundOne(score), 1)
}

const one = formatScore

/** The sector to go after first, and a one-sentence reason. Null with no sectors. */
export function goFirst(
  ranked: readonly SectorResult[],
  evidence?: Readonly<Record<SectorId, SectorEvidence>>,
): GoFirst | null {
  const [leader, runnerUp = null] = ranked
  if (!leader) return null
  const gaps = CRITERIA.map((c) => ({
    id: c.id,
    gap: leader.contributions[c.id] - (runnerUp?.contributions[c.id] ?? 0),
  }))
  const drivers = gaps
    .filter((g) => g.gap > EPSILON)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 2)
    .map((g) => g.id)
  const phrases = drivers.map((id) => criterion(id).phrase)

  let reason: string
  if (!runnerUp) {
    reason = `${leader.label} scores ${one(leader.score)} of 5`
  } else if (leader.score - runnerUp.score > EPSILON) {
    // The margin between the scores as printed, so the sentence adds up; when rounding
    // hides the lead, say so rather than print "0.0 ahead"
    const margin = roundOne(leader.score) - roundOne(runnerUp.score)
    const ahead = margin < 0.05 ? 'just ahead of' : `${one(margin)} ahead of`
    reason = `${leader.label} scores ${one(leader.score)} of 5, ${ahead} ${runnerUp.label}, mostly on ${formatList(phrases)}`
  } else {
    reason = `${leader.label} ties with ${runnerUp.label} on ${one(leader.score)} of 5 and goes first on market attractiveness`
  }

  const own = evidence?.[leader.sector]
  let clause = ''
  if (own) {
    const most =
      evidence &&
      Object.values(evidence).every((e) => e.sector === own.sector || e.sites < own.sites)
    clause =
      own.sites === 0
        ? '; the network has none of its sites yet (synthetic)'
        : `; the network already has ${formatNumber(own.sites)} of its sites${most ? ', more than any other sector' : ''} (synthetic)`
  }

  return {
    sector: leader.sector,
    label: leader.label,
    score: leader.score,
    runnerUp,
    drivers,
    sentence: `${reason}${clause}.`,
  }
}

export const SENSITIVITY_STEP = 0.2
export const TOP_N = 3

export type TopChange = 'none' | 'order' | 'members'

export interface SensitivityCase {
  criterion: CriterionId
  direction: 'up' | 'down'
  top: SectorId[]
  change: TopChange
  /** What moved, in words; empty when nothing did. */
  description: string
}

export interface Sensitivity {
  baseline: SectorId[]
  cases: SensitivityCase[]
  /** Robust: the top N never changes. Leader holds: #1 never changes, the rest can. */
  verdict: 'robust' | 'leader-holds' | 'leader-changes'
  sentence: string
}

function describeChange(
  baseline: readonly SectorId[],
  top: readonly SectorId[],
  label: (id: SectorId) => string,
): { change: TopChange; description: string } {
  const entering = top.filter((id) => !baseline.includes(id))
  if (entering.length > 0) {
    const leaving = baseline.filter((id) => !top.includes(id))
    return {
      change: 'members',
      description: `${formatList(entering.map(label))} ${entering.length === 1 ? 'moves' : 'move'} into the top ${baseline.length} in place of ${formatList(leaving.map(label))}`,
    }
  }
  const at = top.findIndex((id, i) => id !== baseline[i])
  if (at === -1) return { change: 'none', description: '' }
  const risen = top[at] as SectorId
  const passed = baseline[at] as SectorId
  return {
    change: 'order',
    description:
      at === 0
        ? `${label(risen)} takes #1 from ${label(passed)}`
        : `${label(risen)} moves above ${label(passed)}`,
  }
}

const weightChange = (c: SensitivityCase) =>
  `with ${Math.round(SENSITIVITY_STEP * 100)}% ${c.direction === 'up' ? 'more' : 'less'} weight on ${criterion(c.criterion).phrase}`

/**
 * Whether the top of the ranking survives moving any one weight up or down by 20%.
 * A zero weight stays zero either way, so it is left out.
 */
export function sensitivity(
  sectors: readonly SectorInfo[],
  scores: SectorScores,
  weights: Weights,
  { step = SENSITIVITY_STEP, top: size = TOP_N } = {},
): Sensitivity {
  const label = (id: SectorId) => sectors.find((s) => s.id === id)?.label ?? id
  const topOf = (w: Weights) =>
    rankSectors(sectors, scores, w)
      .slice(0, size)
      .map((r) => r.sector)
  const baseline = topOf(weights)
  const leader = baseline[0]
  const cases = CRITERIA.filter((c) => weights[c.id] > 0).flatMap((c) =>
    (['up', 'down'] as const).map((direction): SensitivityCase => {
      const factor = direction === 'up' ? 1 + step : 1 - step
      const top = topOf({ ...weights, [c.id]: weights[c.id] * factor })
      return { criterion: c.id, direction, top, ...describeChange(baseline, top, label) }
    }),
  )

  const moved = cases.filter((c) => c.change !== 'none')
  const lost = cases.filter((c) => c.top[0] !== leader)
  const name = leader === undefined ? 'No sector' : label(leader)
  const pct = `±${Math.round(step * 100)}%`
  const of = (n: number) => `${formatNumber(n)} of ${formatNumber(cases.length)}`

  if (moved.length === 0) {
    return {
      baseline,
      cases,
      verdict: 'robust',
      sentence: `Robust: ${name} stays #1, and the top ${size} stays the same, under every ${pct} change to a single weight.`,
    }
  }
  const first = moved[0] as SensitivityCase
  if (lost.length === 0) {
    return {
      baseline,
      cases,
      verdict: 'leader-holds',
      sentence: `${name} stays #1 under every ${pct} change to a single weight, but the rest of the top ${size} shifts in ${of(moved.length)}: ${weightChange(first)}, ${first.description}.`,
    }
  }
  const worst = lost[0] as SensitivityCase
  const challenger = label(worst.top[0] as SectorId)
  return {
    baseline,
    cases,
    verdict: 'leader-changes',
    sentence: `Sensitive: ${name} loses #1 to ${challenger} ${weightChange(worst)}${lost.length > 1 ? `, and in ${formatNumber(lost.length - 1)} other ${lost.length === 2 ? 'change' : 'changes'}` : ''}. The top ${size} shifts in ${of(moved.length)} changes.`,
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Saved inputs, checked field by field: anything missing, out of range or of the
 * wrong type falls back to its default, so a stale or tampered save can't break the page.
 */
export function restoreSectorInputs(raw: unknown, defaults: SectorInputs): SectorInputs {
  if (!isRecord(raw)) return defaults
  const weights = isRecord(raw.weights) ? raw.weights : {}
  const scores = isRecord(raw.scores) ? raw.scores : {}
  const validWeight = (w: unknown): w is number =>
    typeof w === 'number' && Number.isFinite(w) && w >= 0 && w <= WEIGHT_MAX
  const validScore = (s: unknown): s is number =>
    typeof s === 'number' && Number.isInteger(s) && s >= SCORE_MIN && s <= SCORE_MAX
  return {
    weights: Object.fromEntries(
      CRITERIA.map((c) => {
        const w = weights[c.id]
        return [c.id, validWeight(w) ? w : defaults.weights[c.id]]
      }),
    ) as Weights,
    scores: Object.fromEntries(
      (Object.keys(defaults.scores) as SectorId[]).map((sector) => {
        const saved = scores[sector]
        const own = isRecord(saved) ? saved : {}
        return [
          sector,
          Object.fromEntries(
            CRITERIA.map((c) => {
              const s = own[c.id]
              return [c.id, validScore(s) ? s : defaults.scores[sector][c.id]]
            }),
          ),
        ]
      }),
    ) as SectorScores,
  }
}
