/**
 * Every modelled assumption in the console, written out from the constants the models
 * actually use, so the list can never drift from the code. The Overview shows it under
 * "Assumptions & method".
 */
import type { Timestamp } from '@/types'
import { AUDIT_INTERVAL_DAYS } from './compliance'
import { CREW_SIZE } from './costs'
import { COVERED_MIN_RESPONDERS } from './coverage'
import {
  formatDateTime,
  formatDecimal,
  formatDuration,
  formatGBP,
  formatHour,
  formatList,
  formatNumber,
  formatPercent,
} from './format'
import {
  DEFAULT_AVERAGE_SPEED_MPH,
  DEFAULT_ROAD_FACTOR,
  RESPONSE_TARGET_MINUTES,
  reachKm,
} from './geo'
import {
  CANDIDATE_POOL_SIZE,
  FACTOR_LABELS,
  FACTOR_WEIGHTS,
  FACTORS,
  MAX_OFFER_ETA_MINUTES,
  MOBILISE_MINUTES,
  RUSH_HOURS,
  TRAFFIC_FACTORS,
} from './matching'
import { ACTIVE_WINDOW_DAYS } from './onboarding'
import { AMBER_AFTER_DAYS, PIPELINE_STAGES, RED_AFTER_DAYS } from './pipeline'
import type { PricingInputs } from './pricing'
import { DOWNTIME_COST_PER_HOUR } from './proposal'
import { DEFAULT_PICKS } from './recruitment'
import { CONFIDENCE_LEVELS, IMPACT_LEVELS } from './rice'
import { DEFAULT_SEED } from './rng'
import { CRITERIA, MIDPOINT, SCORE_MAX, SCORE_MIN, type Weights } from './sectorScoring'
import { OVERNIGHT_END_HOUR, OVERNIGHT_START_HOUR } from './time'

export interface Assumption {
  label: string
  value: string
}

export interface AssumptionGroup {
  id: string
  title: string
  /** Where the console relies on these. */
  usedIn: string
  items: Assumption[]
}

export interface AssumptionInputs {
  /** The sector weights in use: the defaults, or the viewer's saved edits. */
  weights: Weights
  weightsEdited: boolean
  /** The pricing sandbox defaults, which value the pipeline. */
  pricing: PricingInputs
  /** The moment the synthetic data describes. */
  asOf: Timestamp
}

const hours = ([from, to]: readonly [number, number]) => `${formatHour(from)}–${formatHour(to)}`
const callOuts = (n: number) => `${formatNumber(n)} ${n === 1 ? 'call-out' : 'call-outs'}`
const target = `${formatNumber(RESPONSE_TARGET_MINUTES)} minutes`

export function modelAssumptions({
  weights,
  weightsEdited,
  pricing,
  asOf,
}: AssumptionInputs): AssumptionGroup[] {
  return [
    {
      id: 'travel',
      title: 'Drive times',
      usedIn: 'Coverage, recruitment, the simulator and proposals',
      items: [
        {
          label: 'Road distance',
          value: `${formatDecimal(DEFAULT_ROAD_FACTOR)} × the straight-line distance`,
        },
        { label: 'Average speed', value: `${formatNumber(DEFAULT_AVERAGE_SPEED_MPH)} mph` },
        {
          label: 'Reach in the target',
          value: `${target} (the public PowerSOS target) is about ${formatNumber(reachKm())} km in a straight line`,
        },
        {
          label: 'Getting going',
          value: `${formatDuration(MOBILISE_MINUTES.day)} from accepting to leaving the depot, ${formatDuration(MOBILISE_MINUTES.overnight)} overnight (${hours([OVERNIGHT_START_HOUR, OVERNIGHT_END_HOUR])})`,
        },
        {
          label: 'Traffic',
          value: `Drive time × ${formatDecimal(TRAFFIC_FACTORS.overnight, 2)} overnight and × ${formatDecimal(TRAFFIC_FACTORS.rushHour, 2)} in weekday rush hours (${formatList(RUSH_HOURS.map(hours))})`,
        },
      ],
    },
    {
      id: 'coverage',
      title: 'Coverage rule',
      usedIn: 'Network health, the Overview and proposals',
      items: [
        {
          label: 'Covered',
          value: `${formatNumber(COVERED_MIN_RESPONDERS)} or more eligible responders within ${target}; thin with one, uncovered with none`,
        },
        {
          label: 'Eligible',
          value: `In-date HV authorisation and insurance, and cover for the hour (overnight, weekend). An audit more than ${formatNumber(AUDIT_INTERVAL_DAYS)} days old is flagged but does not exclude`,
        },
        {
          label: 'Recruitment plan',
          value: `${formatNumber(DEFAULT_PICKS)} picks, one at a time: the anchor town where one new, always-available responder adds the most criticality-weighted cover`,
        },
        {
          label: 'Headline figures',
          value: `The 12 months to ${formatDateTime(asOf)}, with cover judged for a weekday daytime request`,
        },
        { label: 'Active member', value: `Used the platform in the last ${formatNumber(ACTIVE_WINDOW_DAYS)} days` },
      ],
    },
    {
      id: 'matching',
      title: 'Responder matching',
      usedIn: 'The simulator',
      items: [
        {
          label: 'Score weights',
          value: FACTORS.map((f) => `${FACTOR_LABELS[f]} ${formatNumber(FACTOR_WEIGHTS[f])}`).join(' · '),
        },
        {
          label: 'Who is asked',
          value: `The ${formatNumber(CANDIDATE_POOL_SIZE)} nearest eligible responders; nobody with an ETA over ${formatDuration(MAX_OFFER_ETA_MINUTES)}`,
        },
        { label: 'Crew', value: `${formatNumber(CREW_SIZE)} people at every attendance` },
      ],
    },
    {
      id: 'sectors',
      title: weightsEdited ? 'Sector scoring weights (your saved edits)' : 'Sector scoring weights',
      usedIn: 'Market strategy and the Overview',
      items: [
        {
          label: 'Weights',
          value: CRITERIA.map((c) => `${c.label} ${formatNumber(weights[c.id])}`).join(' · '),
        },
        {
          label: 'Scores',
          value: `${formatNumber(SCORE_MIN)}–${formatNumber(SCORE_MAX)} per sector and criterion, by judgement, to validate with MPN; strong competition from in-house teams counts against a sector`,
        },
        { label: 'Matrix', value: `Each axis splits at ${formatNumber(MIDPOINT)}` },
      ],
    },
    {
      id: 'pricing',
      title: 'Pricing defaults',
      usedIn: 'The pricing sandbox, deal values and proposals',
      items: [
        {
          label: 'Tiers, a site a month',
          value: pricing.tiers
            .map(
              (t) =>
                `${t.name} ${formatGBP(t.pricePerSite, { pence: false })} (${t.allowance === null ? 'unlimited call-outs' : `${callOuts(t.allowance)} a year`})`,
            )
            .join(' · '),
        },
        {
          label: 'Beyond the allowance',
          value: `${formatGBP(pricing.payPerCallOut, { pence: false })} a call-out, ${formatPercent(pricing.responderPayout)} of it to the responder`,
        },
        {
          label: 'Without PowerSOS',
          value: `${formatGBP(pricing.adHocCost, { pence: false })} a call-out for attendance and labour, from the synthetic call-outs`,
        },
        {
          label: 'Demand',
          value: `${formatNumber(pricing.callOutsPerSite, 1)} call-outs a site a year; ${formatNumber(pricing.sitesPerCustomer, 1)} sites a customer`,
        },
        {
          label: 'Growth',
          value: `${formatNumber(pricing.newCustomers, 1)} new customers a month; ${formatPercent(pricing.monthlyChurn, 1)} monthly churn; suppliers pay ${formatPercent(pricing.supplierMargin)} on parts and hire`,
        },
      ],
    },
    {
      id: 'pipeline',
      title: 'Pipeline, proposals and roadmap',
      usedIn: 'Pipeline and the Overview',
      items: [
        {
          label: 'Stage probability',
          value: PIPELINE_STAGES.map((s) => `${s.label} ${formatPercent(s.probability)}`).join(' · '),
        },
        {
          label: 'Deal value',
          value: "A year's membership on the sector's recommended tier, for every site the lead estimated",
        },
        {
          label: 'Days in stage',
          value: `Amber after ${formatNumber(AMBER_AFTER_DAYS)}, red after ${formatNumber(RED_AFTER_DAYS)}`,
        },
        {
          label: 'Cost of downtime an hour',
          value: Object.entries(DOWNTIME_COST_PER_HOUR)
            .map(([score, cost]) => `score ${score}: ${formatGBP(cost, { pence: false })}`)
            .join(' · '),
        },
        {
          label: 'RICE',
          value: `Reach × impact × confidence ÷ effort; impact ${IMPACT_LEVELS.map((l) => formatNumber(l.value, 2)).join(' / ')}; confidence ${CONFIDENCE_LEVELS.map((l) => formatPercent(l.value)).join(' / ')}`,
        },
      ],
    },
    {
      id: 'data',
      title: 'Data',
      usedIn: 'Every page',
      items: [
        {
          label: 'Synthetic',
          value:
            'Every organisation, person, site, call-out and price is synthetic. Only the facts quoted from powersos.co.uk are real',
        },
        {
          label: 'Generated',
          value: `From seed ${formatNumber(DEFAULT_SEED)}, with one stream per dataset, so every load is identical; as at ${formatDateTime(asOf)}`,
        },
        {
          label: 'Working definitions',
          value: 'Partners and suppliers, as the public site does not define them',
        },
      ],
    },
  ]
}
