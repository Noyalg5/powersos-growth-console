/**
 * Data-quality checks across every dataset, grouped by five standard dimensions.
 *
 * Each rule is a pure function of the datasets: it says how many records it
 * examined and which of them break it, what is wrong and how to fix it. A score is
 * the share of checks that pass, where one check is one rule applied to one record.
 * Scores round down, so anything short of perfect never shows as 100%.
 *
 * The synthetic data has problems planted on purpose (SEEDED_ISSUES and
 * SEEDED_ONBOARDING_ISSUES in src/data). PLANTED_ISSUE_RULES names the rule that
 * should catch each kind, and the tests prove every planted problem is caught and
 * nothing else is raised.
 */
import type {
  CallOut,
  Customer,
  Lead,
  OnboardingRecord,
  Partner,
  Responder,
  SeededIssueKind,
  SeededOnboardingIssueKind,
  SideId,
  Site,
  Supplier,
  Timestamp,
} from '@/types'
import { toCsv } from './csv'
import { formatDate, formatDateTime, formatList, formatNumber } from './format'
import { haversineKm, type LatLng } from './geo'
import { isOnMainland } from './mainland'
import { coverContext, eligibilityExclusions, eligibleWindow } from './matching'
import {
  checklistLabel,
  isOnboarding,
  lastProgressAt,
  SIDE_LABELS,
  STAGES,
  STEP_LABELS,
} from './onboarding'
import { DAY_MS } from './time'

export const DIMENSIONS = [
  'completeness',
  'validity',
  'uniqueness',
  'consistency',
  'timeliness',
] as const
export type Dimension = (typeof DIMENSIONS)[number]

export const DIMENSION_INFO: Record<Dimension, { label: string; question: string }> = {
  completeness: { label: 'Completeness', question: 'Is everything we rely on recorded?' },
  validity: { label: 'Validity', question: 'Are values in the allowed format and range?' },
  uniqueness: { label: 'Uniqueness', question: 'Is each real thing recorded once?' },
  consistency: {
    label: 'Consistency',
    question: 'Do values agree, within a record and across datasets?',
  },
  timeliness: { label: 'Timeliness', question: 'Is the data current enough to act on?' },
}

/** Most serious first. */
export const SEVERITIES = ['high', 'medium', 'low'] as const
export type Severity = (typeof SEVERITIES)[number]

export const SEVERITY_LABELS: Record<Severity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

export const DATASETS = [
  'customers',
  'sites',
  'responders',
  'suppliers',
  'partners',
  'callOuts',
  'leads',
  'onboarding',
] as const
export type DatasetId = (typeof DATASETS)[number]

export const DATASET_LABELS: Record<DatasetId, string> = {
  customers: 'Customers',
  sites: 'Sites',
  responders: 'Responders',
  suppliers: 'Suppliers',
  partners: 'Partners',
  callOuts: 'Call-outs',
  leads: 'Leads',
  onboarding: 'Onboarding',
}

export interface QualityData {
  customers: readonly Customer[]
  sites: readonly Site[]
  responders: readonly Responder[]
  suppliers: readonly Supplier[]
  partners: readonly Partner[]
  callOuts: readonly CallOut[]
  leads: readonly Lead[]
  onboarding: readonly OnboardingRecord[]
}

/** One record that breaks a rule. */
export interface Finding {
  recordId: string
  /** The record in words, e.g. "Hull Campus (University of Woadcote)". */
  record: string
  /** The other record involved, such as the original of a duplicate. */
  relatedId?: string
  problem: string
  fix: string
}

/** Lookups shared by the rules, built once per run. */
export interface CheckContext {
  data: QualityData
  asOf: Timestamp
  customerById: ReadonlyMap<string, Customer>
  siteById: ReadonlyMap<string, Site>
  responderById: ReadonlyMap<string, Responder>
  partnerIds: ReadonlySet<string>
  recordsByOrg: ReadonlyMap<string, readonly OnboardingRecord[]>
  /** Organisations in each side's dataset: ID → name and the day it joined. */
  live: Record<SideId, ReadonlyMap<string, { name: string; joinedAt: Timestamp }>>
}

export interface QualityRule {
  id: string
  dataset: DatasetId
  dimension: Dimension
  severity: Severity
  /** What should be true, e.g. "Every site has a postcode". */
  title: string
  run(ctx: CheckContext): { checked: number; findings: Finding[] }
}

export interface QualityIssue extends Omit<Finding, 'relatedId'> {
  ruleId: string
  /** The rule broken, in words. */
  rule: string
  dataset: DatasetId
  dimension: Dimension
  severity: Severity
  relatedId: string | null
}

// Helpers -------------------------------------------------------------------

const collator = new Intl.Collator('en-GB', { numeric: true })
const byId = <T extends { id: string }>(a: T, b: T) => collator.compare(a.id, b.id)
const normalise = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`
const dayOf = (at: Timestamp) => at - (at % DAY_MS)
const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
/** "Marramby Farms' records", "Sparwick's records". */
const possessive = (name: string) => (name.endsWith('s') ? `${name}'` : `${name}'s`)

/** Check each row; a row passes when the test returns null. */
function each<T>(rows: readonly T[], test: (row: T) => Finding | null) {
  return { checked: rows.length, findings: rows.flatMap((row) => test(row) ?? []) }
}

/** Flag every row that matches an earlier one (in ID order), naming the earlier one. */
function laterDuplicates<T extends { id: string }>(
  rows: readonly T[],
  same: (earlier: T, row: T) => boolean,
  finding: (row: T, earlier: T) => Finding,
) {
  const sorted = [...rows].sort(byId)
  return each(sorted, (row) => {
    const index = sorted.indexOf(row)
    const earlier = sorted.slice(0, index).find((other) => same(other, row))
    return earlier ? { ...finding(row, earlier), relatedId: earlier.id } : null
  })
}

const customerName = (ctx: CheckContext, id: string) => ctx.customerById.get(id)?.name ?? id
const siteLabel = (ctx: CheckContext, site: Site) =>
  `${site.name} (${customerName(ctx, site.customerId)})`
const callOutLabel = (ctx: CheckContext, c: CallOut) =>
  `${customerName(ctx, c.customerId)}, ${formatDateTime(c.requestedAt)}`

function onMainland<T extends LatLng & { id: string; name: string }>(
  rule: Omit<QualityRule, 'dimension' | 'run'>,
  rows: (data: QualityData) => readonly T[],
  fix: string,
): QualityRule {
  return {
    ...rule,
    dimension: 'validity',
    run: (ctx) =>
      each(rows(ctx.data), (row) =>
        isOnMainland(row)
          ? null
          : {
              recordId: row.id,
              record: row.name,
              problem: `Coordinates ${formatNumber(row.lat, 4)}, ${formatNumber(row.lng, 4)} are not on mainland Great Britain.`,
              fix,
            },
      ),
  }
}

// Rules ---------------------------------------------------------------------

/** Open onboardings with nothing done for longer than this are flagged as stale. */
export const STALE_AFTER_DAYS = 120

const completeness: QualityRule[] = [
  {
    id: 'site-postcode',
    dataset: 'sites',
    dimension: 'completeness',
    severity: 'medium',
    title: 'Every site has a postcode',
    run: (ctx) =>
      each(ctx.data.sites, (site) =>
        site.postcodeArea
          ? null
          : {
              recordId: site.id,
              record: siteLabel(ctx, site),
              problem: 'No postcode on file.',
              fix: `Ask ${customerName(ctx, site.customerId)} for the postcode. Until then responders navigate by coordinates alone.`,
            },
      ),
  },
  {
    id: 'site-contacts',
    dataset: 'sites',
    dimension: 'completeness',
    severity: 'high',
    title: 'Every site has two emergency contacts with phone numbers',
    run: (ctx) =>
      each(ctx.data.sites, (site) => {
        const reachable = site.contacts.filter((c) => c.name.trim() && c.phone.trim()).length
        return reachable >= 2
          ? null
          : {
              recordId: site.id,
              record: siteLabel(ctx, site),
              problem: `${plural(reachable, 'emergency contact')} with a phone number.`,
              fix: `Get two named contacts with phone numbers from ${customerName(ctx, site.customerId)}: the responder rings them on the way.`,
            }
      }),
  },
  {
    id: 'site-equipment',
    dataset: 'sites',
    dimension: 'completeness',
    severity: 'medium',
    title: 'Every site has its ring main unit and transformer logged',
    run: (ctx) =>
      each(ctx.data.sites, (site) => {
        const missing = [
          site.equipment.some((e) => e.kind === 'rmu') ? null : 'ring main unit',
          site.equipment.some((e) => e.kind === 'transformer') ? null : 'transformer',
        ].filter((x): x is string => x !== null)
        return missing.length === 0
          ? null
          : {
              recordId: site.id,
              record: siteLabel(ctx, site),
              problem: `No ${missing.join(' or ')} logged.`,
              fix: "Log the equipment from the site's single-line diagram, so responders arrive knowing what they will find.",
            }
      }),
  },
  {
    id: 'customer-sites',
    dataset: 'customers',
    dimension: 'completeness',
    severity: 'high',
    title: 'Every customer has at least one site',
    run: (ctx) =>
      each(ctx.data.customers, (customer) =>
        customer.sites.length > 0
          ? null
          : {
              recordId: customer.id,
              record: customer.name,
              problem: 'No sites on file.',
              fix: 'Add its sites: a customer cannot make a three-click request without one.',
            },
      ),
  },
  {
    id: 'responder-authorisation-expiry',
    dataset: 'responders',
    dimension: 'completeness',
    severity: 'high',
    title: 'Every responder has an HV authorisation expiry',
    run: (ctx) =>
      each(ctx.data.responders, (r) =>
        r.authorisationExpiry !== null
          ? null
          : {
              recordId: r.id,
              record: r.name,
              problem: 'No HV authorisation expiry on file.',
              fix: `Ask ${r.name} for its current HV authorisation and record the expiry. Matching excludes it until then.`,
            },
      ),
  },
  {
    id: 'supplier-catalogue',
    dataset: 'suppliers',
    dimension: 'completeness',
    severity: 'medium',
    title: 'Every supplier lists its stock and the regions it serves',
    run: (ctx) =>
      each(ctx.data.suppliers, (s) => {
        const missing = [
          s.stock.length > 0 ? null : 'stock',
          s.regionsServed.length > 0 ? null : 'regions served',
        ].filter((x): x is string => x !== null)
        return missing.length === 0
          ? null
          : {
              recordId: s.id,
              record: s.name,
              problem: `No ${missing.join(' or ')} listed.`,
              fix: `Ask ${s.name} for its catalogue and delivery area: the simulator cannot source parts from it without them.`,
            }
      }),
  },
  {
    id: 'onboarding-record',
    dataset: 'onboarding',
    dimension: 'completeness',
    severity: 'medium',
    title: 'Every live organisation has an onboarding record',
    run: (ctx) => {
      const live = (Object.keys(ctx.live) as SideId[]).flatMap((side) =>
        [...ctx.live[side]].map(([id, org]) => ({ side, id, name: org.name })),
      )
      return each(live, (org) =>
        ctx.recordsByOrg.has(org.id)
          ? null
          : {
              recordId: org.id,
              record: org.name,
              problem: `No onboarding record for this live ${SIDE_LABELS[org.side].one.toLowerCase()}.`,
              fix: 'Create it from the go-live paperwork, so the organisation counts in its funnel.',
            },
      )
    },
  },
]

const validity: QualityRule[] = [
  onMainland(
    {
      id: 'site-mainland',
      dataset: 'sites',
      severity: 'high',
      title: 'Every site is on mainland Great Britain',
    },
    (data) => data.sites,
    "Check the coordinates against the site's postcode: the service only covers mainland UK.",
  ),
  onMainland(
    {
      id: 'responder-mainland',
      dataset: 'responders',
      severity: 'high',
      title: 'Every responder depot is on mainland Great Britain',
    },
    (data) => data.responders,
    "Check the depot's coordinates: every ETA from it is wrong until they are right.",
  ),
  onMainland(
    {
      id: 'supplier-mainland',
      dataset: 'suppliers',
      severity: 'medium',
      title: 'Every supplier depot is on mainland Great Britain',
    },
    (data) => data.suppliers,
    "Check the depot's coordinates: delivery times are worked out from them.",
  ),
  {
    id: 'site-postcode-format',
    dataset: 'sites',
    dimension: 'validity',
    severity: 'low',
    title: 'Postcode areas are one or two capital letters',
    run: (ctx) =>
      each(ctx.data.sites, (site) =>
        site.postcodeArea === null || /^[A-Z]{1,2}$/.test(site.postcodeArea)
          ? null
          : {
              recordId: site.id,
              record: siteLabel(ctx, site),
              problem: `Postcode area "${site.postcodeArea}" is not one or two capital letters.`,
              fix: 'Correct it to the letters at the start of the postcode, such as LS for Leeds.',
            },
      ),
  },
  {
    id: 'equipment-installed',
    dataset: 'sites',
    dimension: 'validity',
    severity: 'low',
    title: 'Equipment install years are not in the future',
    run: (ctx) => {
      const thisYear = new Date(ctx.asOf).getUTCFullYear()
      return each(ctx.data.sites, (site) => {
        const wrong = site.equipment.filter(
          (e) => e.installedYear > thisYear || e.installedYear < 1900,
        )
        return wrong.length === 0
          ? null
          : {
              recordId: site.id,
              record: siteLabel(ctx, site),
              problem: `${formatList(wrong.map((e) => `${e.id} installed in ${e.installedYear}`))}.`,
              fix: "Check the install year on the equipment's rating plate.",
            }
      })
    },
  },
  {
    id: 'callout-values',
    dataset: 'callOuts',
    dimension: 'validity',
    severity: 'medium',
    title: 'Ratings are whole stars from 1 to 5, and costs are not negative',
    run: (ctx) =>
      each(ctx.data.callOuts, (c) => {
        const problems = [
          Number.isInteger(c.rating) && c.rating >= 1 && c.rating <= 5
            ? null
            : `rating of ${c.rating}`,
          ...Object.entries(c.cost).map(([part, amount]) =>
            Number.isFinite(amount) && amount >= 0 ? null : `${part} cost of ${amount}`,
          ),
        ].filter((x): x is string => x !== null)
        return problems.length === 0
          ? null
          : {
              recordId: c.id,
              record: callOutLabel(ctx, c),
              problem: `Has a ${formatList(problems)}.`,
              fix: "Correct it from the responder's invoice and the customer's review.",
            }
      }),
  },
  {
    id: 'partner-referrals',
    dataset: 'partners',
    dimension: 'validity',
    severity: 'low',
    title: 'Converted referrals are whole numbers, never more than referrals',
    run: (ctx) =>
      each(ctx.data.partners, (p) =>
        Number.isInteger(p.referrals) &&
        Number.isInteger(p.convertedReferrals) &&
        p.convertedReferrals >= 0 &&
        p.convertedReferrals <= p.referrals
          ? null
          : {
              recordId: p.id,
              record: p.name,
              problem: `${formatNumber(p.convertedReferrals)} converted out of ${plural(p.referrals, 'referral')}.`,
              fix: 'Recount referrals and conversions from the referral codes used.',
            },
      ),
  },
  {
    id: 'onboarding-future',
    dataset: 'onboarding',
    dimension: 'validity',
    severity: 'medium',
    title: 'Nothing in onboarding is dated after the data date',
    run: (ctx) =>
      each(ctx.data.onboarding, (r) => {
        const dated: [string, Timestamp | null][] = [
          ...STAGES.map((s): [string, Timestamp | null] => [STEP_LABELS[s], r.entered[s]]),
          ...r.checklist.map((e): [string, Timestamp | null] => [checklistLabel(e.item), e.doneAt]),
          ['Last activity', r.lastActiveAt],
          ['Leaving date', r.churnedAt],
        ]
        const future = dated.filter(([, at]) => at !== null && at > ctx.asOf)
        return future.length === 0
          ? null
          : {
              recordId: r.id,
              record: r.name,
              problem: `${formatList(future.map(([what, at]) => `${what} is dated ${formatDate(at ?? 0)}`))}, after the data date.`,
              fix: 'Record the date it actually happens. Until then it does not count as done.',
            }
      }),
  },
]

const uniqueness: QualityRule[] = [
  {
    id: 'site-duplicate',
    dataset: 'sites',
    dimension: 'uniqueness',
    severity: 'medium',
    title: 'Each site is registered once',
    run: (ctx) =>
      laterDuplicates(
        ctx.data.sites,
        // Same customer, and the same name or within 100 m
        (a, b) =>
          a.customerId === b.customerId &&
          (normalise(a.name) === normalise(b.name) || haversineKm(a, b) < 0.1),
        (site, original) => {
          const same = [
            normalise(site.name) === normalise(original.name) ? 'name' : null,
            haversineKm(site, original) < 0.1 ? 'location' : null,
          ].filter((x): x is string => x !== null)
          return {
            recordId: site.id,
            record: siteLabel(ctx, site),
            problem: `Same customer, ${formatList(same)} as ${original.id}.`,
            fix: `Merge ${site.id} into ${original.id}, moving any call-outs across, then retire ${site.id}.`,
          }
        },
      ),
  },
  {
    id: 'customer-duplicate',
    dataset: 'customers',
    dimension: 'uniqueness',
    severity: 'medium',
    title: 'Each customer is registered once',
    run: (ctx) =>
      laterDuplicates(
        ctx.data.customers,
        (a, b) => normalise(a.name) === normalise(b.name),
        (customer, original) => ({
          recordId: customer.id,
          record: customer.name,
          problem: `Same name as ${original.id}.`,
          fix: `Merge ${customer.id} into ${original.id}, with its sites and call-outs.`,
        }),
      ),
  },
  {
    id: 'responder-duplicate',
    dataset: 'responders',
    dimension: 'uniqueness',
    severity: 'medium',
    title: 'Each responder is registered once',
    run: (ctx) =>
      laterDuplicates(
        ctx.data.responders,
        (a, b) => normalise(a.name) === normalise(b.name),
        (r, original) => ({
          recordId: r.id,
          record: r.name,
          problem: `Same name as ${original.id}.`,
          fix: `Merge ${r.id} into ${original.id}: as two records it can be offered the same job twice.`,
        }),
      ),
  },
  {
    id: 'callout-duplicate',
    dataset: 'callOuts',
    dimension: 'uniqueness',
    severity: 'medium',
    title: 'Each call-out is logged once',
    run: (ctx) => {
      const first = new Map<string, CallOut>()
      return each([...ctx.data.callOuts].sort(byId), (c) => {
        const key = `${c.siteId}|${c.faultType}|${c.requestedAt}`
        const original = first.get(key)
        if (!original) {
          first.set(key, c)
          return null
        }
        return {
          recordId: c.id,
          record: callOutLabel(ctx, c),
          relatedId: original.id,
          problem: `Same site, fault and request time as ${original.id}.`,
          fix: `Delete ${c.id} once the invoice is checked: it counts the job and its cost twice.`,
        }
      })
    },
  },
  {
    id: 'onboarding-duplicate',
    dataset: 'onboarding',
    dimension: 'uniqueness',
    severity: 'medium',
    title: 'Each organisation has one onboarding record',
    run: (ctx) =>
      laterDuplicates(
        ctx.data.onboarding,
        (a, b) => a.orgId === b.orgId,
        (r, original) => ({
          recordId: r.id,
          record: r.name,
          problem: `A second record for ${r.orgId}; the first is ${original.id}.`,
          fix: `Merge ${r.id} into ${original.id}: the organisation is counted twice in its funnel.`,
        }),
      ),
  },
]

const consistency: QualityRule[] = [
  {
    id: 'callout-site',
    dataset: 'callOuts',
    dimension: 'consistency',
    severity: 'high',
    title: 'Every call-out points to a site on file',
    run: (ctx) =>
      each(ctx.data.callOuts, (c) =>
        ctx.siteById.has(c.siteId)
          ? null
          : {
              recordId: c.id,
              record: callOutLabel(ctx, c),
              relatedId: c.siteId,
              problem: `Points to ${c.siteId}, which is not in the site register.`,
              fix: `Restore ${c.siteId} from ${possessive(customerName(ctx, c.customerId))} records, or re-link the call-out to the right site. Until then it drops out of site and regional reporting.`,
            },
      ),
  },
  {
    id: 'callout-parties',
    dataset: 'callOuts',
    dimension: 'consistency',
    severity: 'high',
    title: "Every call-out's customer and responder are on file, and the site is the customer's",
    run: (ctx) =>
      each(ctx.data.callOuts, (c) => {
        const site = ctx.siteById.get(c.siteId)
        const problems = [
          ctx.customerById.has(c.customerId) ? null : `customer ${c.customerId} is not on file`,
          ctx.responderById.has(c.responderId) ? null : `responder ${c.responderId} is not on file`,
          // A missing site is the rule above's to report
          site && site.customerId !== c.customerId
            ? `${site.id} belongs to ${customerName(ctx, site.customerId)}`
            : null,
        ].filter((x): x is string => x !== null)
        if (problems.length === 0) return null
        return {
          recordId: c.id,
          record: callOutLabel(ctx, c),
          problem: `${capitalise(formatList(problems))}.`,
          fix: 'Re-link the call-out to the right customer, site and responder from the job sheet.',
        }
      }),
  },
  {
    id: 'callout-time-order',
    dataset: 'callOuts',
    dimension: 'consistency',
    severity: 'high',
    title: 'Call-out times run in order: requested, accepted, arrived, resolved',
    run: (ctx) =>
      each(ctx.data.callOuts, (c) => {
        const steps = [
          { what: 'request', at: c.requestedAt },
          { what: 'acceptance', at: c.acceptedAt },
          { what: 'arrival', at: c.arrivedAt },
          { what: 'resolution', at: c.resolvedAt },
        ]
        // In order overall exactly when each step is no earlier than the one before
        const i = steps.findIndex((step, k) => k > 0 && step.at < (steps[k - 1]?.at ?? step.at))
        const [earlier, later] = [steps[i - 1], steps[i]]
        if (!earlier || !later) return null
        return {
          recordId: c.id,
          record: callOutLabel(ctx, c),
          problem: `${capitalise(later.what)} at ${formatDateTime(later.at)} is before ${earlier.what} at ${formatDateTime(earlier.at)}.`,
          fix: "Correct the times from the responder's job sheet: every response-time figure includes this job.",
        }
      }),
  },
  {
    id: 'callout-responder-eligible',
    dataset: 'callOuts',
    dimension: 'consistency',
    severity: 'high',
    title: 'Every call-out went to a responder that matching would have allowed at the time',
    run: (ctx) =>
      each(ctx.data.callOuts, (c) => {
        const responder = ctx.responderById.get(c.responderId)
        if (!responder) return null
        // A missing expiry is a gap in today's record, reported on its own
        const reasons = eligibilityExclusions(responder, coverContext(c.requestedAt)).filter(
          (e) => e.code !== 'authorisation-missing',
        )
        return reasons.length === 0
          ? null
          : {
              recordId: c.id,
              record: callOutLabel(ctx, c),
              relatedId: responder.id,
              problem: `${responder.name} was not eligible at the time: ${reasons.map((e) => e.label).join('; ')}.`,
              fix: 'Find out how the job reached this responder: matching should have excluded it.',
            }
      }),
  },
  {
    id: 'callout-membership',
    dataset: 'callOuts',
    dimension: 'consistency',
    severity: 'medium',
    title: 'Call-outs fall while the customer is a live member',
    run: (ctx) =>
      each(ctx.data.callOuts, (c) => {
        const customer = ctx.customerById.get(c.customerId)
        if (!customer) return null
        const left =
          (ctx.recordsByOrg.get(customer.id) ?? []).find((r) => r.churnedAt !== null)?.churnedAt ??
          null
        const problem =
          c.requestedAt < customer.joinedAt
            ? `Requested before ${customer.name} went live on ${formatDate(customer.joinedAt)}.`
            : left !== null && c.requestedAt >= left
              ? `Requested after ${customer.name} cancelled on ${formatDate(left)}.`
              : null
        return problem === null
          ? null
          : {
              recordId: c.id,
              record: callOutLabel(ctx, c),
              problem,
              fix: 'Check whether the customer was a member at the time, and correct its go-live or leaving date.',
            }
      }),
  },
  {
    id: 'lead-partner',
    dataset: 'leads',
    dimension: 'consistency',
    severity: 'medium',
    title: 'Partner referrals name a partner on file, and only referrals name one',
    run: (ctx) =>
      each(ctx.data.leads, (lead) => {
        const referral = lead.source === 'partner-referral'
        const problem = referral
          ? lead.partnerId === null
            ? 'A partner referral with no partner named.'
            : ctx.partnerIds.has(lead.partnerId)
              ? null
              : `Referred by ${lead.partnerId}, which is not on file.`
          : lead.partnerId === null
            ? null
            : `Names partner ${lead.partnerId}, but did not come through a referral.`
        return problem === null
          ? null
          : {
              recordId: lead.id,
              record: lead.organisation,
              problem,
              fix: 'Set the referring partner from the referral code used, or clear it.',
            }
      }),
  },
  {
    id: 'lead-contact-dates',
    dataset: 'leads',
    dimension: 'consistency',
    severity: 'low',
    title: 'Leads are contacted after they come in, and only once off the wait-list',
    run: (ctx) =>
      each(ctx.data.leads, (lead) => {
        const { lastContactAt: contact } = lead
        const problem =
          lead.stage === 'wait-list'
            ? contact === null
              ? null
              : `On the wait-list, but last contacted ${formatDate(contact)}.`
            : contact === null
              ? 'Past the wait-list with no contact recorded.'
              : contact < lead.createdAt
                ? `Last contacted ${formatDate(contact)}, before coming in on ${formatDate(lead.createdAt)}.`
                : contact > ctx.asOf
                  ? `Last contacted ${formatDate(contact)}, after the data date.`
                  : null
        return problem === null
          ? null
          : {
              recordId: lead.id,
              record: lead.organisation,
              problem,
              fix: 'Correct the stage or the contact date from the CRM history.',
            }
      }),
  },
  {
    id: 'onboarding-stage',
    dataset: 'onboarding',
    dimension: 'consistency',
    severity: 'low',
    title: "Each onboarding record's stage matches its stage dates",
    run: (ctx) =>
      each(ctx.data.onboarding, (r) => {
        const dated = STAGES.filter((s) => r.entered[s] !== null)
        const furthest = dated.at(-1)
        const gap =
          furthest && STAGES.slice(0, STAGES.indexOf(furthest)).find((s) => r.entered[s] === null)
        const label = (s: (typeof STAGES)[number]) => STEP_LABELS[s]
        const result = (problem: string, fix: string): Finding => ({
          recordId: r.id,
          record: r.name,
          problem,
          fix,
        })
        if (!furthest)
          return result('No stage dates recorded.', 'Fill in the dates from the CRM history.')
        if (gap) {
          return result(
            `Has a date for ${label(furthest)} but none for ${label(gap)}.`,
            'Fill in the missing date from the CRM history.',
          )
        }
        if (furthest === r.stage) return null
        return result(
          `Stage says ${label(r.stage)}, but its dates show ${label(furthest)} on ${formatDate(r.entered[furthest] ?? 0)}.`,
          `Move the stage to ${label(furthest)}: reports that read the stage, not the dates, are out by one.`,
        )
      }),
  },
  {
    id: 'onboarding-date-order',
    dataset: 'onboarding',
    dimension: 'consistency',
    severity: 'medium',
    title: 'Onboarding dates run in order: stages, checklist, activity and leaving',
    run: (ctx) =>
      each(ctx.data.onboarding, (r) => {
        const { signed, onboarded } = r.entered
        const date = (at: Timestamp) => formatDate(at)
        const problems: string[] = []
        const stages = STAGES.flatMap((s) => {
          const at = r.entered[s]
          return at === null ? [] : [{ s, at }]
        })
        stages.forEach((stage, i) => {
          const prior = stages[i - 1]
          if (prior && stage.at < prior.at) {
            problems.push(
              `${STEP_LABELS[stage.s]} (${date(stage.at)}) comes before ${STEP_LABELS[prior.s]} (${date(prior.at)})`,
            )
          }
        })
        for (const { item, doneAt } of r.checklist) {
          if (doneAt === null) continue
          const what = checklistLabel(item)
          if (signed === null || doneAt < signed) {
            problems.push(
              `${what} done ${date(doneAt)}, before ${signed === null ? 'signing' : `signing on ${date(signed)}`}`,
            )
          } else if (onboarded !== null && doneAt > onboarded) {
            problems.push(`${what} done ${date(doneAt)}, after going live on ${date(onboarded)}`)
          }
        }
        const lastStage = stages.at(-1)
        if (r.churnedAt !== null && lastStage && r.churnedAt < lastStage.at) {
          problems.push(
            `Left on ${date(r.churnedAt)}, before ${STEP_LABELS[lastStage.s]} on ${date(lastStage.at)}`,
          )
        }
        if (r.lastActiveAt !== null && (onboarded === null || r.lastActiveAt < onboarded)) {
          problems.push(
            onboarded === null
              ? `Active on ${date(r.lastActiveAt)}, but never went live`
              : `Active on ${date(r.lastActiveAt)}, before going live on ${date(onboarded)}`,
          )
        }
        return problems.length === 0
          ? null
          : {
              recordId: r.id,
              record: r.name,
              problem: `${problems.join('; ')}.`,
              fix: 'Correct the dates from the onboarding history, so stage times and checklists add up.',
            }
      }),
  },
  {
    id: 'onboarding-checklist-complete',
    dataset: 'onboarding',
    dimension: 'consistency',
    severity: 'high',
    title: 'Organisations only go live once their checklist is complete',
    run: (ctx) =>
      each(
        ctx.data.onboarding.filter((r) => r.entered.onboarded !== null),
        (r) => {
          const open = r.checklist
            .filter((e) => e.doneAt === null)
            .map((e) => checklistLabel(e.item))
          return open.length === 0
            ? null
            : {
                recordId: r.id,
                record: r.name,
                problem: `Went live on ${formatDate(r.entered.onboarded ?? 0)} with ${formatList(open).toLowerCase()} outstanding.`,
                fix: `Complete ${formatList(open).toLowerCase()} with ${r.name} now: it is already live.`,
              }
        },
      ),
  },
  {
    id: 'onboarding-go-live',
    dataset: 'onboarding',
    dimension: 'consistency',
    severity: 'medium',
    title: 'Go-live dates match the day the organisation joined',
    run: (ctx) =>
      each(ctx.data.onboarding, (r) => {
        const org = ctx.live[r.side].get(r.orgId)
        const { onboarded } = r.entered
        const dataset = `${SIDE_LABELS[r.side].one.toLowerCase()} data`
        const problem = org
          ? onboarded === null
            ? `Live in the ${dataset} since ${formatDate(org.joinedAt)}, but onboarding never finished.`
            : dayOf(onboarded) === dayOf(org.joinedAt)
              ? null
              : `Went live on ${formatDate(onboarded)}, but joined on ${formatDate(org.joinedAt)} in the ${dataset}.`
          : onboarded === null
            ? null
            : `Went live on ${formatDate(onboarded)}, but ${r.orgId} is not in the ${dataset}.`
        return problem === null
          ? null
          : {
              recordId: r.id,
              record: r.name,
              relatedId: r.orgId,
              problem,
              fix: 'Agree the go-live date with the date the organisation joined, and add or remove it from the live data to match.',
            }
      }),
  },
]

const timeliness: QualityRule[] = [
  {
    id: 'responder-on-call-after-lapse',
    dataset: 'responders',
    dimension: 'timeliness',
    severity: 'high',
    title: 'Responders come off the rota when their paperwork lapses',
    run: (ctx) =>
      each(ctx.data.responders, (r) => {
        const window = eligibleWindow(r)
        if (window === null || window.until > ctx.asOf) return null
        const last = Math.max(
          -Infinity,
          ...(ctx.recordsByOrg.get(r.id) ?? []).flatMap((rec) => rec.lastActiveAt ?? []),
        )
        if (last < window.until) return null
        const what =
          r.authorisationExpiry !== null && r.authorisationExpiry <= r.insuranceExpiry
            ? 'HV authorisation'
            : 'insurance'
        return {
          recordId: r.id,
          record: r.name,
          problem: `On call on ${formatDate(last)}, ${plural(Math.round((last - window.until) / DAY_MS), 'day')} after its ${what} expired on ${formatDate(window.until)}.`,
          fix: `Take ${r.name} off the on-call rota until the renewed ${what} is uploaded.`,
        }
      }),
  },
  {
    id: 'onboarding-stale',
    dataset: 'onboarding',
    dimension: 'timeliness',
    severity: 'medium',
    title: `Open onboardings show progress in the last ${STALE_AFTER_DAYS} days`,
    run: (ctx) =>
      each(
        ctx.data.onboarding.filter((r) => isOnboarding(r, ctx.asOf)),
        (r) => {
          const last = lastProgressAt(r, ctx.asOf)
          if (last === null || ctx.asOf - last <= STALE_AFTER_DAYS * DAY_MS) return null
          return {
            recordId: r.id,
            record: r.name,
            problem: `Signed ${formatDate(r.entered.signed ?? last)}; nothing has moved since ${formatDate(last)}, ${plural(Math.floor((ctx.asOf - last) / DAY_MS), 'day')} ago.`,
            fix: `Ask ${r.name} whether onboarding is still going ahead. If not, mark it lost so the funnel stays honest.`,
          }
        },
      ),
  },
]

/** Every rule, by dimension. */
export const RULES: readonly QualityRule[] = [
  ...completeness,
  ...validity,
  ...uniqueness,
  ...consistency,
  ...timeliness,
]

// Running and scoring ---------------------------------------------------------

export function checkContext(data: QualityData, asOf: Timestamp): CheckContext {
  const recordsByOrg = new Map<string, OnboardingRecord[]>()
  for (const r of data.onboarding)
    recordsByOrg.set(r.orgId, [...(recordsByOrg.get(r.orgId) ?? []), r])
  const live = <T extends { id: string; name: string }>(
    rows: readonly T[],
    joined: (row: T) => Timestamp,
  ) => new Map(rows.map((row) => [row.id, { name: row.name, joinedAt: joined(row) }]))
  return {
    data,
    asOf,
    customerById: new Map(data.customers.map((c) => [c.id, c])),
    siteById: new Map(data.sites.map((s) => [s.id, s])),
    responderById: new Map(data.responders.map((r) => [r.id, r])),
    partnerIds: new Set(data.partners.map((p) => p.id)),
    recordsByOrg,
    live: {
      customer: live(data.customers, (c) => c.joinedAt),
      responder: live(data.responders, (r) => r.joinedAt),
      supplier: live(data.suppliers, (s) => s.joinedAt),
      partner: live(data.partners, (p) => p.since),
    },
  }
}

/** Share of checks passed, rounded down to 0.1%. Null when nothing was checked. */
export function qualityScore(checks: number, failed: number): number | null {
  if (!Number.isInteger(checks) || !Number.isInteger(failed) || failed < 0 || failed > checks) {
    throw new RangeError(`qualityScore() needs 0 <= failed <= checks, got ${failed} of ${checks}`)
  }
  return checks === 0 ? null : Math.floor(((checks - failed) / checks) * 1000) / 1000
}

export interface ScoreSummary {
  rules: number
  checks: number
  failed: number
  score: number | null
}

export interface RuleResult {
  rule: QualityRule
  checked: number
  issues: QualityIssue[]
}

export interface QualityReport {
  results: RuleResult[]
  /** Most severe first, then by dimension, dataset and record. */
  issues: QualityIssue[]
  overall: ScoreSummary
  byDimension: Record<Dimension, ScoreSummary>
  byDataset: Record<DatasetId, ScoreSummary & { records: number }>
  /** Every dataset against every dimension. */
  matrix: Record<DatasetId, Record<Dimension, ScoreSummary>>
}

function summarise(results: readonly RuleResult[]): ScoreSummary {
  const checks = results.reduce((sum, r) => sum + r.checked, 0)
  const failed = results.reduce((sum, r) => sum + r.issues.length, 0)
  return { rules: results.length, checks, failed, score: qualityScore(checks, failed) }
}

const order =
  <T>(list: readonly T[]) =>
  (a: T, b: T) =>
    list.indexOf(a) - list.indexOf(b)

export function runQualityChecks(
  data: QualityData,
  asOf: Timestamp,
  rules: readonly QualityRule[] = RULES,
): QualityReport {
  const ctx = checkContext(data, asOf)
  const results = rules.map((rule): RuleResult => {
    const { checked, findings } = rule.run(ctx)
    const issues = findings.map(({ relatedId, ...finding }): QualityIssue => ({
      ...finding,
      ruleId: rule.id,
      rule: rule.title,
      dataset: rule.dataset,
      dimension: rule.dimension,
      severity: rule.severity,
      relatedId: relatedId ?? null,
    }))
    return { rule, checked, issues }
  })

  const issues = results
    .flatMap((r) => r.issues)
    .sort(
      (a, b) =>
        order(SEVERITIES)(a.severity, b.severity) ||
        order(DIMENSIONS)(a.dimension, b.dimension) ||
        order(DATASETS)(a.dataset, b.dataset) ||
        collator.compare(a.recordId, b.recordId),
    )

  const sizes: Record<DatasetId, number> = {
    customers: data.customers.length,
    sites: data.sites.length,
    responders: data.responders.length,
    suppliers: data.suppliers.length,
    partners: data.partners.length,
    callOuts: data.callOuts.length,
    leads: data.leads.length,
    onboarding: data.onboarding.length,
  }
  const where = (dataset?: DatasetId, dimension?: Dimension) =>
    results.filter(
      (r) =>
        (dataset === undefined || r.rule.dataset === dataset) &&
        (dimension === undefined || r.rule.dimension === dimension),
    )

  return {
    results,
    issues,
    overall: summarise(results),
    byDimension: Object.fromEntries(
      DIMENSIONS.map((d) => [d, summarise(where(undefined, d))]),
    ) as QualityReport['byDimension'],
    byDataset: Object.fromEntries(
      DATASETS.map((ds) => [ds, { ...summarise(where(ds)), records: sizes[ds] }]),
    ) as QualityReport['byDataset'],
    matrix: Object.fromEntries(
      DATASETS.map((ds) => [
        ds,
        Object.fromEntries(DIMENSIONS.map((d) => [d, summarise(where(ds, d))])),
      ]),
    ) as QualityReport['matrix'],
  }
}

export interface IssueFilters {
  severity: Severity | null
  dimension: Dimension | null
  dataset: DatasetId | null
}

export const NO_ISSUE_FILTERS: IssueFilters = { severity: null, dimension: null, dataset: null }

/** Issues matching every filter that is set. */
export function filterIssues(
  issues: readonly QualityIssue[],
  { severity, dimension, dataset }: IssueFilters,
): QualityIssue[] {
  return issues.filter(
    (i) =>
      (severity === null || i.severity === severity) &&
      (dimension === null || i.dimension === dimension) &&
      (dataset === null || i.dataset === dataset),
  )
}

/** The issues as a CSV table. */
export function issuesTable(issues: readonly QualityIssue[]): string {
  return toCsv([
    [
      'Severity',
      'Dimension',
      'Dataset',
      'Record ID',
      'Record',
      'Rule',
      'Problem',
      'Suggested fix',
      'Related ID',
    ],
    ...issues.map((i) => [
      SEVERITY_LABELS[i.severity],
      DIMENSION_INFO[i.dimension].label,
      DATASET_LABELS[i.dataset],
      i.recordId,
      i.record,
      i.rule,
      i.problem,
      i.fix,
      i.relatedId,
    ]),
  ])
}

// Answer key ----------------------------------------------------------------

export type PlantedIssueKind = SeededIssueKind | SeededOnboardingIssueKind

/** The rule that should catch each kind of planted issue. */
export const PLANTED_ISSUE_RULES: Record<PlantedIssueKind, string> = {
  'duplicate-site': 'site-duplicate',
  'missing-postcode': 'site-postcode',
  'missing-authorisation-expiry': 'responder-authorisation-expiry',
  'orphaned-call-out': 'callout-site',
  'stage-behind-dates': 'onboarding-stage',
  'live-with-open-item': 'onboarding-checklist-complete',
  'future-dated-item': 'onboarding-future',
  'stale-onboarding': 'onboarding-stale',
  'on-call-after-lapse': 'responder-on-call-after-lapse',
}

export interface PlantedIssue {
  kind: PlantedIssueKind
  recordId: string
}

export interface AnswerKeyResult<P extends PlantedIssue = PlantedIssue> {
  found: P[]
  missed: P[]
  /** Raised by a check but not planted: a false alarm, or a real problem nobody planted. */
  unexpected: QualityIssue[]
}

/** Compare what the checks raised with what was planted. */
export function checkAnswerKey<P extends PlantedIssue>(
  issues: readonly QualityIssue[],
  planted: readonly P[],
): AnswerKeyResult<P> {
  const matches = (issue: QualityIssue, p: PlantedIssue) =>
    issue.ruleId === PLANTED_ISSUE_RULES[p.kind] && issue.recordId === p.recordId
  return {
    found: planted.filter((p) => issues.some((i) => matches(i, p))),
    missed: planted.filter((p) => !issues.some((i) => matches(i, p))),
    unexpected: issues.filter((i) => !planted.some((p) => matches(i, p))),
  }
}
