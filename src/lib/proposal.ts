/**
 * Proposal generator: a one-page membership proposal for one lead, built only from
 * that lead's sites.
 *
 * - Cover follows coverage.ts: eligible responders within an estimated 75-minute
 *   drive, checked for a weekday daytime and for overnight.
 * - The tier is the one that costs the least per site at the sector's call-out rate,
 *   using the pricing model.
 * - The cost of downtime turns the sector's cost-of-downtime score (1–5) from Market
 *   strategy into an hourly figure. The figures per score are assumptions.
 *
 * Everything in a proposal is illustrative.
 */
import type {
  ChecklistItemId,
  Lead,
  LeadSite,
  Responder,
  Timestamp,
} from '@/types'
import {
  siteCoverage,
  summariseCoverage,
  type CoverageStatus,
  type CoverageSummary,
} from './coverage'
import { formatDuration, formatGBP, formatList, formatNumber } from './format'
import type { CoverContext } from './matching'
import { CHECKLISTS } from './onboarding'
import type { PipelineStage } from './pipeline'
import { memberCostPerSite, type Tier } from './pricing'

const pounds = (n: number) => formatGBP(n, { pence: false })
const siteCount = (n: number) => `${formatNumber(n)} ${n === 1 ? 'site' : 'sites'}`
const callOutCount = (n: number) => `${formatNumber(n, 1)} ${n === 1 ? 'call-out' : 'call-outs'}`

export interface TierCost {
  tier: Tier
  /** Pounds a year for one site: twelve monthly fees plus call-outs beyond the allowance. */
  perSite: number
}

export interface TierRecommendation {
  tier: Tier
  perSite: number
  /** Every tier, cheapest first. */
  costs: TierCost[]
  callOutsPerSite: number
  reason: string
}

/** Unlimited counts as the most cover. */
const cover = (tier: Tier) => tier.allowance ?? Number.MAX_SAFE_INTEGER

/**
 * The tier that costs least per site at `callOutsPerSite` call-outs a site a year. On a
 * tie the tier with more call-outs included wins: more cover for the same money.
 */
export function recommendTier(
  tiers: readonly Tier[],
  callOutsPerSite: number,
  payPerCallOut: number,
): TierRecommendation {
  const costs = tiers
    .map((tier) => ({ tier, perSite: memberCostPerSite(tier, callOutsPerSite, payPerCallOut) }))
    .sort((a, b) => a.perSite - b.perSite || cover(b.tier) - cover(a.tier))
  const [best, next] = costs
  if (!best) throw new RangeError('recommendTier() needs at least one tier')

  const at = `At ${callOutCount(callOutsPerSite)} per site a year`
  const cost =
    !next
      ? `${at}, ${best.tier.name} costs ${pounds(best.perSite)} per site a year.`
      : next.perSite === best.perSite
        ? `${at}, ${best.tier.name} and ${next.tier.name} both cost ${pounds(best.perSite)} per site a year, and ${best.tier.name} includes more call-outs.`
        : `${at}, ${best.tier.name} costs the least: ${pounds(best.perSite)} per site a year, ${pounds(next.perSite - best.perSite)} less than ${next.tier.name}.`
  const allowance =
    best.tier.allowance === null
      ? 'Call-outs are unlimited.'
      : `It includes ${callOutCount(best.tier.allowance)} per site a year; any more cost ${pounds(payPerCallOut)} each.`
  return {
    tier: best.tier,
    perSite: best.perSite,
    costs,
    callOutsPerSite,
    reason: `${cost} ${allowance}`,
  }
}

/** A year's membership for this many sites on the recommended tier. */
export function annualMembership(recommendation: TierRecommendation, sites: number): number {
  if (!Number.isInteger(sites) || sites < 0) {
    throw new RangeError(`sites must be a whole number of 0 or more, got ${sites}`)
  }
  return recommendation.perSite * sites
}

/**
 * Assumption: what an hour without power costs at one site, by the sector's
 * cost-of-downtime score. 1 is an inconvenience; 5 is a data hall, a process line
 * or theatres down.
 */
export const DOWNTIME_COST_PER_HOUR: Readonly<Record<number, number>> = {
  1: 500,
  2: 2_000,
  3: 5_000,
  4: 15_000,
  5: 40_000,
}

export function downtimeCostPerHour(score: number): number {
  const cost = DOWNTIME_COST_PER_HOUR[score]
  if (cost === undefined) {
    throw new RangeError(`The cost-of-downtime score must be a whole number from 1 to 5, got ${score}`)
  }
  return cost
}

export interface DowntimeComparison {
  score: number
  perHour: number
  /** A year's membership for every site. */
  membership: number
  /** Minutes without power at one site that cost as much as the year's membership. */
  breakEvenMinutes: number
  sentence: string
}

export function compareDowntime(
  score: number,
  membership: number,
  sites: number,
): DowntimeComparison {
  if (!Number.isFinite(membership) || membership < 0) {
    throw new RangeError(`membership must be a non-negative amount, got ${membership}`)
  }
  const perHour = downtimeCostPerHour(score)
  const breakEvenMinutes = (membership / perHour) * 60
  return {
    score,
    perHour,
    membership,
    breakEvenMinutes,
    sentence: `A year's membership for ${sites === 1 ? 'your site' : `all ${siteCount(sites)}`}, ${pounds(membership)}, costs the same as ${formatDuration(breakEvenMinutes)} without power at one site at ${pounds(perHour)} an hour.`,
  }
}

export interface ProposalSite {
  site: LeadSite
  /** 1, 2, 3 …, matching the numbers on the map. */
  number: number
  /** Eligible responders within an estimated 75-minute drive on a weekday daytime. */
  inReach: number
  inReachOvernight: number
  /** Estimated drive from the nearest eligible responder, in minutes; null with none eligible. */
  bestMinutes: number | null
  status: CoverageStatus
  overnightStatus: CoverageStatus
}

export interface PlanStep {
  id: ChecklistItemId
  label: string
  when: string
  detail: string
}

const PLAN: Partial<Record<ChecklistItemId, { when: (long: boolean) => string; detail: string }>> =
  {
    'sites-added': {
      when: () => 'Week 1',
      detail: 'We load every site in this proposal from your site list.',
    },
    'equipment-logged': {
      when: (long) => (long ? 'Weeks 1–3' : 'Weeks 1–2'),
      detail:
        'Your team confirms the RMUs, transformers, switchgear and generators at each site, so crews arrive knowing the kit.',
    },
    'emergency-contacts': {
      when: (long) => (long ? 'Week 3' : 'Week 2'),
      detail: 'Who we call at each site, in order, day and night.',
    },
    'cost-approval-limits': {
      when: (long) => (long ? 'Week 3' : 'Week 2'),
      detail: 'Spending limits and approvers, so predicted costs are agreed before work starts.',
    },
    'first-test-call-out': {
      when: (long) => (long ? 'Week 4' : 'Week 3'),
      detail: 'A planned test call-out at one site proves the request, match and arrival.',
    },
  }

/** More sites than this take an extra week to log. */
export const LONG_ONBOARDING_SITES = 6

/** The customer onboarding checklist from Onboarding & compliance, as a timed plan. */
export function onboardingPlan(sites: number): PlanStep[] {
  const long = sites > LONG_ONBOARDING_SITES
  return CHECKLISTS.customer.map((item) => {
    const step = PLAN[item.id]
    if (!step) throw new Error(`No onboarding plan for ${item.id}`)
    return { id: item.id, label: item.label, when: step.when(long), detail: step.detail }
  })
}

const FIRST_STEP: Record<PipelineStage, string> = {
  lead: 'Book a 30-minute demo of the three-click request for your duty team.',
  discovery: 'Book a 30-minute demo of the three-click request for your duty team.',
  demo: 'Review this proposal with your estates and finance leads.',
  proposal: 'Review this proposal with your estates and finance leads.',
  negotiation: 'Agree terms, including the early-adopter discount.',
  onboarding: 'Finish onboarding against the plan above.',
  live: 'Book a 90-day review of response times and spend.',
}

/** The few sites named in a sentence, then a count of the rest. */
function someSites(sites: readonly ProposalSite[], shown = 2): string {
  const names = sites.slice(0, shown).map((s) => s.site.name)
  const rest = sites.length - names.length
  return formatList(rest > 0 ? [...names, `${formatNumber(rest)} more`] : names)
}

export function nextSteps(stage: PipelineStage, sites: readonly ProposalSite[]): string[] {
  const gaps = sites.filter((s) => s.status !== 'covered')
  return [
    FIRST_STEP[stage],
    `Confirm the ${siteCount(sites.length)} listed here and a start date.`,
    ...(gaps.length > 0
      ? [
          `Agree cover for ${someSites(gaps)}: ${formatNumber(gaps.length)} of ${siteCount(sites.length)} ${gaps.length === 1 ? 'has' : 'have'} fewer than two eligible responders within 75 minutes today.`,
        ]
      : []),
    'Name an approver and spending limits for call-outs.',
  ]
}

export interface ProposalInput {
  lead: Lead
  /** Where the deal is on the board. */
  stage: PipelineStage
  /** Sites on record for any lead: only this lead's are used. */
  sites: readonly LeadSite[]
  responders: readonly Responder[]
  asOf: Timestamp
  /** The tier for the lead's sector. */
  recommendation: TierRecommendation
  /** The sector's cost-of-downtime score, 1–5. */
  downtimeScore: number
}

/** A sector's recommended tier and cost of downtime, and where its call-out rate comes from. */
export type SectorTerms = Pick<ProposalInput, 'recommendation' | 'downtimeScore'> & {
  rateBasis: string
}

export interface Proposal {
  lead: Lead
  preparedOn: Timestamp
  sites: ProposalSite[]
  coverage: CoverageSummary
  overnight: CoverageSummary
  /** Eligible responders within reach of at least one of the sites on a weekday daytime. */
  responders: Responder[]
  recommendation: TierRecommendation
  annualCost: number
  downtime: DowntimeComparison
  plan: PlanStep[]
  nextSteps: string[]
}

export function buildProposal(input: ProposalInput): Proposal {
  const { lead, stage, responders, asOf, recommendation, downtimeScore } = input
  const own = input.sites.filter((s) => s.leadId === lead.id)
  if (own.length === 0) throw new RangeError(`No sites on record for ${lead.id}`)

  const day: CoverContext = { at: asOf, overnight: false, weekend: false }
  const night: CoverContext = { ...day, overnight: true }
  const byDay = siteCoverage(own, responders, day)
  const byNight = siteCoverage(own, responders, night)

  const sites = byDay.map(
    (cover, i): ProposalSite => ({
      site: cover.site,
      number: i + 1,
      inReach: cover.inReach.length,
      inReachOvernight: byNight[i]?.inReach.length ?? 0,
      bestMinutes: cover.nearest[0]?.minutes ?? null,
      status: cover.status,
      overnightStatus: byNight[i]?.status ?? 'uncovered',
    }),
  )
  const nearby = new Map(byDay.flatMap((c) => c.inReach.map((r) => [r.responder.id, r.responder])))
  const annualCost = annualMembership(recommendation, own.length)

  return {
    lead,
    preparedOn: asOf,
    sites,
    coverage: summariseCoverage(sites.map((s) => s.status)),
    overnight: summariseCoverage(sites.map((s) => s.overnightStatus)),
    responders: [...nearby.values()],
    recommendation,
    annualCost,
    downtime: compareDowntime(downtimeScore, annualCost, own.length),
    plan: onboardingPlan(own.length),
    nextSteps: nextSteps(stage, sites),
  }
}
