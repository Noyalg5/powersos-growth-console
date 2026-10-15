/**
 * What the synthetic network says about demand, cost and membership over the 12
 * months to the data date, worked out once, when first imported. Market strategy
 * shows these figures beside its defaults; Pipeline values deals and recommends
 * tiers from the same figures, so the two pages always agree.
 */
import { averageJobCost, callOutRate, callOutsAtSites, YEAR_MS, type Period } from '@/lib/demand'
import { defaultPricingInputs, type PricingEvidence } from '@/lib/pricing'
import { cancellations, membershipAt, monthlyChurn, retentionCohorts } from '@/lib/retention'
import { sectorEvidence } from '@/lib/sectorScoring'
import { callOuts, customers, DATA_AS_OF, onboarding, SECTORS } from './index'

export const EVIDENCE_PERIOD: Period = { from: DATA_AS_OF - YEAR_MS, to: DATA_AS_OF }

const CUSTOMER_RECORDS = onboarding.filter((r) => r.side === 'customer')

/** When each customer that cancelled left. */
export const CANCELLED = cancellations(CUSTOMER_RECORDS)
export const SECTOR_EVIDENCE = sectorEvidence(
  SECTORS,
  customers,
  callOuts,
  EVIDENCE_PERIOD,
  CANCELLED,
)
export const CALL_OUTS_AT_SITES = callOutsAtSites(customers, callOuts)
export const CALL_OUT_RATE = callOutRate(customers, callOuts, EVIDENCE_PERIOD, CANCELLED)
export const JOB_COSTS = averageJobCost(CALL_OUTS_AT_SITES.matched)
export const CHURN = monthlyChurn(retentionCohorts(CUSTOMER_RECORDS, DATA_AS_OF))
export const MEMBERSHIP = membershipAt(CUSTOMER_RECORDS, DATA_AS_OF)

export const PRICING_EVIDENCE: PricingEvidence = {
  liveCustomers: MEMBERSHIP.live,
  sitesPerCustomer: customers.length === 0 ? 0 : CALL_OUT_RATE.sites / customers.length,
  callOutsPerSite: CALL_OUT_RATE.perSiteYear ?? 0,
  responseCost: JOB_COSTS.response,
  materialsCost: JOB_COSTS.materials,
  newCustomers: MEMBERSHIP.joinedLastYear / 12,
  monthlyChurn: CHURN.monthly ?? 0,
}

/** The pricing sandbox's starting point, before anyone edits it. */
export const PRICING_DEFAULTS = defaultPricingInputs(PRICING_EVIDENCE)
