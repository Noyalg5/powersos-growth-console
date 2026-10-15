import { STAGES } from '@/lib/onboarding'
import { DAY_MS } from '@/lib/time'
import type {
  Customer,
  OnboardingRecord,
  SeededIssue,
  SeededOnboardingIssue,
  Site,
  Timestamp,
} from '@/types'
import type { Datasets } from './generate'

/**
 * Data-quality problems planted in the synthetic data on purpose: the answer key
 * for the data-quality checks. Each one mirrors something that goes wrong in
 * real site registers.
 */
export const SEEDED_ISSUES: readonly SeededIssue[] = [
  {
    kind: 'duplicate-site',
    dataset: 'sites',
    recordId: 'SITE-195',
    relatedId: 'SITE-161',
    description:
      'Mallowstead Healthcare entered Manchester Hospital twice: same name, location and equipment under a second ID.',
  },
  {
    kind: 'missing-postcode',
    dataset: 'sites',
    recordId: 'SITE-092',
    relatedId: null,
    description: 'University of Woadcote never supplied the postcode for Hull Campus.',
  },
  {
    kind: 'missing-authorisation-expiry',
    dataset: 'responders',
    recordId: 'RSP-026',
    relatedId: null,
    description:
      'Sparwick HV Services Ltd has no HV authorisation expiry on file, so nobody will be reminded to renew it.',
  },
  {
    kind: 'orphaned-call-out',
    dataset: 'callOuts',
    recordId: 'CO-0135',
    relatedId: 'SITE-155',
    description:
      'Marramby Farms deleted Wrexham Grain Store, leaving its call-out pointing at a site that no longer exists.',
  },
]

function findSite(
  customers: readonly Customer[],
  siteId: string,
): { customer: Customer; site: Site } {
  for (const customer of customers) {
    const site = customer.sites.find((s) => s.id === siteId)
    if (site) return { customer, site }
  }
  throw new Error(`Seeded issue refers to unknown site ${siteId}`)
}

/**
 * Plant the issues in freshly generated data. Throws if the data has drifted so a
 * planted issue no longer fits (for example the target record is missing), so the
 * answer key and the data can never silently disagree.
 */
export function applySeededIssues(data: Datasets, issues: readonly SeededIssue[]): Datasets {
  const { callOuts } = data
  let { customers, responders } = data
  const replaceSites = (customerId: string, update: (sites: Site[]) => Site[]) => {
    customers = customers.map((c) => (c.id === customerId ? { ...c, sites: update(c.sites) } : c))
  }

  for (const issue of issues) {
    switch (issue.kind) {
      case 'duplicate-site': {
        const { customer, site } = findSite(customers, issue.relatedId ?? '')
        if (customers.some((c) => c.sites.some((s) => s.id === issue.recordId))) {
          throw new Error(`Duplicate site ID ${issue.recordId} is already in use`)
        }
        const copy: Site = {
          ...site,
          id: issue.recordId,
          equipment: site.equipment.map((item) => ({
            ...item,
            id: item.id.replace(site.id, issue.recordId),
          })),
          contacts: site.contacts.map((contact) => ({ ...contact })),
        }
        replaceSites(customer.id, (sites) => sites.flatMap((s) => (s === site ? [s, copy] : [s])))
        break
      }
      case 'missing-postcode': {
        const { customer, site } = findSite(customers, issue.recordId)
        replaceSites(customer.id, (sites) =>
          sites.map((s) => (s === site ? { ...s, postcodeArea: null } : s)),
        )
        break
      }
      case 'missing-authorisation-expiry': {
        if (!responders.some((r) => r.id === issue.recordId)) {
          throw new Error(`Seeded issue refers to unknown responder ${issue.recordId}`)
        }
        responders = responders.map((r) =>
          r.id === issue.recordId ? { ...r, authorisationExpiry: null } : r,
        )
        break
      }
      case 'orphaned-call-out': {
        const { customer, site } = findSite(customers, issue.relatedId ?? '')
        const affected = callOuts.filter((c) => c.siteId === site.id).map((c) => c.id)
        if (affected.length !== 1 || affected[0] !== issue.recordId) {
          throw new Error(
            `Deleting ${site.id} would orphan [${affected.join(', ')}], not just ${issue.recordId}`,
          )
        }
        if (customer.sites.length < 2) {
          throw new Error(`Deleting ${site.id} would leave ${customer.id} with no sites`)
        }
        replaceSites(customer.id, (sites) => sites.filter((s) => s !== site))
        break
      }
    }
  }

  return { ...data, customers, responders, callOuts }
}

/**
 * Problems planted in the onboarding records: their answer key. Kept apart from
 * SEEDED_ISSUES so the datasets above, and their planted issues, stay as they were.
 */
export const SEEDED_ONBOARDING_ISSUES: readonly SeededOnboardingIssue[] = [
  {
    kind: 'on-call-after-lapse',
    dataset: 'responders',
    recordId: 'RSP-027',
    lastActiveAt: Date.UTC(2026, 9, 12),
    description:
      'Ironwick HV Services Ltd was still on call on 12 Oct 2026, nine days after its insurance expired on 3 Oct 2026.',
  },
  {
    kind: 'live-with-open-item',
    dataset: 'onboarding',
    recordId: 'ONB-013',
    item: 'cost-approval-limits',
    description:
      'Gorsedale Data Centres went live on 23 Jun 2026 without cost-approval limits, so nobody is set up to approve its call-out costs.',
  },
  {
    kind: 'future-dated-item',
    dataset: 'onboarding',
    recordId: 'ONB-165',
    item: 'app-training',
    doneAt: Date.UTC(2026, 9, 21),
    description:
      "Graphitemoor Switching Services' app training is logged as done on 21 Oct 2026, a week after the data date: it was booked, not done.",
  },
  {
    kind: 'stale-onboarding',
    dataset: 'onboarding',
    recordId: 'ONB-201',
    daysBack: 150,
    description:
      'Woldhythe Switchgear signed on 3 Mar 2026 and nothing on its checklist has moved since 20 Apr 2026.',
  },
  {
    kind: 'stage-behind-dates',
    dataset: 'onboarding',
    recordId: 'ONB-192',
    description:
      'Tarnwick Cable & Jointing went live on 19 Jul 2026, but its onboarding record still says Signed.',
  },
]

/**
 * Plant the onboarding issues. Like applySeededIssues, it throws if a planted issue
 * no longer fits the records, so the answer key and the data never silently disagree.
 */
export function applyOnboardingIssues(
  records: readonly OnboardingRecord[],
  issues: readonly SeededOnboardingIssue[],
): OnboardingRecord[] {
  const out = [...records]
  const change = (
    issue: SeededOnboardingIssue,
    update: (record: OnboardingRecord) => OnboardingRecord,
  ) => {
    const byOrg = issue.kind === 'on-call-after-lapse'
    const index = out.findIndex((r) => (byOrg ? r.orgId : r.id) === issue.recordId)
    const record = out[index]
    if (!record) throw new Error(`Seeded issue refers to unknown record ${issue.recordId}`)
    out[index] = update(record)
  }
  const fail = (issue: SeededOnboardingIssue, why: string): never => {
    throw new Error(`Cannot plant ${issue.kind} on ${issue.recordId}: ${why}`)
  }

  for (const issue of issues) {
    switch (issue.kind) {
      case 'stage-behind-dates':
        change(issue, (r) => {
          const behind = STAGES[STAGES.indexOf(r.stage) - 1]
          return behind ? { ...r, stage: behind } : fail(issue, 'it is at the first stage')
        })
        break
      case 'live-with-open-item':
        change(issue, (r) => {
          if (r.entered.onboarded === null) fail(issue, 'it is not live')
          if (!r.checklist.some((e) => e.item === issue.item && e.doneAt !== null)) {
            fail(issue, `${issue.item} is not done`)
          }
          return {
            ...r,
            checklist: r.checklist.map((e) => (e.item === issue.item ? { ...e, doneAt: null } : e)),
          }
        })
        break
      case 'future-dated-item':
        change(issue, (r) => {
          if (!r.checklist.some((e) => e.item === issue.item && e.doneAt === null)) {
            fail(issue, `${issue.item} is not outstanding`)
          }
          return {
            ...r,
            checklist: r.checklist.map((e) =>
              e.item === issue.item ? { ...e, doneAt: issue.doneAt } : e,
            ),
          }
        })
        break
      case 'stale-onboarding':
        change(issue, (r) => {
          if (r.stage !== 'signed' || r.entered.onboarded !== null || r.churnedAt !== null) {
            fail(issue, 'it is not onboarding')
          }
          const shift = (at: Timestamp | null) => (at === null ? null : at - issue.daysBack * DAY_MS)
          return {
            ...r,
            entered: {
              aware: shift(r.entered.aware),
              engaged: shift(r.entered.engaged),
              signed: shift(r.entered.signed),
              onboarded: null,
            },
            checklist: r.checklist.map((e) => ({ ...e, doneAt: shift(e.doneAt) })),
          }
        })
        break
      case 'on-call-after-lapse':
        change(issue, (r) => {
          if (r.side !== 'responder' || r.entered.onboarded === null) fail(issue, 'not a live responder')
          if (r.lastActiveAt !== null && r.lastActiveAt >= issue.lastActiveAt) {
            fail(issue, 'it was already active later')
          }
          return { ...r, lastActiveAt: issue.lastActiveAt }
        })
        break
    }
  }
  return out
}
