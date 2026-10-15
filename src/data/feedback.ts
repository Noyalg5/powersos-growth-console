/**
 * The seeded voice-of-customer log: what organisations on every side have told us,
 * in their own words. The organisations are the synthetic ones on the other pages,
 * named by ID so the log stays in step with them. The quotes are written for the demo.
 */
import { newestFirst } from '@/lib/rice'
import type { FeedbackEntry, SideId, ThemeId } from '@/types'
import { daysFrom, makeId } from './helpers'
import { customers, DATA_AS_OF, leads, partners, responders, suppliers } from './index'

interface Seed {
  /** CUS-, LEAD-, RSP-, SUP- or PTN-. */
  orgId: string
  side: SideId
  theme: ThemeId
  daysAgo: number
  quote: string
}

const SEEDS: readonly Seed[] = [
  {
    orgId: 'CUS-015',
    side: 'customer',
    theme: 'eta-updates',
    daysAgo: 12,
    quote:
      'When theatres lost supply, our duty estates officer rang the switchboard four times asking where the engineer was. A text with the ETA would have saved every one of those calls.',
  },
  {
    orgId: 'RSP-013',
    side: 'responder',
    theme: 'eta-updates',
    daysAgo: 40,
    quote:
      "The ETA starts from our depot, but overnight the engineer often collects the earthing kit first. Let us adjust it when we accept, or the customer sees a time we can't make.",
  },
  {
    orgId: 'CUS-040',
    side: 'customer',
    theme: 'site-data',
    daysAgo: 25,
    quote:
      'Six data halls, and keying in every RMU and transformer by hand took our team two days. We already keep an asset register; let us upload it.',
  },
  {
    orgId: 'LEAD-009',
    side: 'customer',
    theme: 'site-data',
    daysAgo: 10,
    quote:
      "Eleven sites means eleven sets of single-line diagrams and switchgear details. We'd want that loaded for us before go-live, not left to each site manager.",
  },
  {
    orgId: 'SUP-007',
    side: 'supplier',
    theme: 'site-data',
    daysAgo: 58,
    quote:
      "We need the generator size and the connection arrangement before we load the lorry. If the site record carried that, we'd save an hour on every hire.",
  },
  {
    orgId: 'CUS-004',
    side: 'customer',
    theme: 'cost-control',
    daysAgo: 33,
    quote:
      "Finance won't sign off open-ended call-outs. We need a spending limit per site, and our purchase order number on every invoice.",
  },
  {
    orgId: 'CUS-027',
    side: 'customer',
    theme: 'cost-control',
    daysAgo: 71,
    quote:
      'The cost prediction is useful, but show parts separately from labour. The spares budget sits with a different manager.',
  },
  {
    orgId: 'CUS-010',
    side: 'customer',
    theme: 'compliance-evidence',
    daysAgo: 19,
    quote:
      'Our authorising engineer audits us every year. For every job I need to show who did the switching, their authorisation and the permit reference.',
  },
  {
    orgId: 'LEAD-022',
    side: 'customer',
    theme: 'compliance-evidence',
    daysAgo: 0,
    quote:
      'Procurement asked how we would evidence response times against our SLA each quarter. A monthly report we can forward would settle it.',
  },
  {
    orgId: 'PTN-007',
    side: 'partner',
    theme: 'compliance-evidence',
    daysAgo: 47,
    quote:
      "If members can show an authorised engineer on site within 75 minutes, underwriters will take it into account at renewal. We'd need the evidence in a standard format.",
  },
  {
    orgId: 'CUS-046',
    side: 'customer',
    theme: 'remote-cover',
    daysAgo: 64,
    quote:
      'Two of our wind farm substations are well over an hour from the nearest town. Tell us plainly what response looks like out there before we sign every site up.',
  },
  {
    orgId: 'RSP-006',
    side: 'responder',
    theme: 'remote-cover',
    daysAgo: 52,
    quote:
      "We'd cover the glens if there were a standby payment for being on call that far out. A two-hour drive for one switching operation doesn't pay otherwise.",
  },
  {
    orgId: 'RSP-005',
    side: 'responder',
    theme: 'responder-payments',
    daysAgo: 29,
    quote:
      "Some frameworks pay us at 60 days. If the app shows when each job will be paid, we'll take more of them.",
  },
  {
    orgId: 'RSP-024',
    side: 'responder',
    theme: 'safety-documents',
    daysAgo: 15,
    quote:
      "Half the time there's no up-to-date network diagram on site. Let us attach the switching programme and permit to the job so the next crew has them.",
  },
  {
    orgId: 'RSP-029',
    side: 'responder',
    theme: 'parts-sourcing',
    daysAgo: 36,
    quote:
      "When an RMU needs a spare, I'm phoning three suppliers from the car park. Show me who has it in stock nearby.",
  },
  {
    orgId: 'SUP-004',
    side: 'supplier',
    theme: 'parts-sourcing',
    daysAgo: 84,
    quote:
      "We'd hold spares for the common RMU types on the platform, if we knew which makes the member sites actually run.",
  },
  {
    orgId: 'SUP-010',
    side: 'supplier',
    theme: 'parts-sourcing',
    daysAgo: 103,
    quote:
      "Our jointers are often first to confirm it's a cable fault. Let the responder call a jointing team from the job instead of starting a new request.",
  },
  {
    orgId: 'CUS-021',
    side: 'customer',
    theme: 'integrations',
    daysAgo: 45,
    quote:
      'Our helpdesk logs everything in the CAFM system. If staff have to raise an HV call-out in a separate app at 2 a.m., someone will forget.',
  },
  {
    orgId: 'PTN-001',
    side: 'partner',
    theme: 'integrations',
    daysAgo: 77,
    quote:
      "We'd raise jobs for our clients, but only if they flow straight from our CAFM system. Keying them twice is a non-starter for the helpdesk.",
  },
  {
    orgId: 'PTN-004',
    side: 'partner',
    theme: 'partner-referrals',
    daysAgo: 21,
    quote:
      "We've referred a few organisations and have no idea where any of them are in the process.",
  },
  {
    orgId: 'PTN-011',
    side: 'partner',
    theme: 'partner-referrals',
    daysAgo: 130,
    quote:
      'Members asked for a referral code they can track, so the forum can report what came of its introductions.',
  },
]

const ORGANISATIONS = new Map<string, string>([
  ...customers.map((c) => [c.id, c.name] as const),
  ...leads.map((l) => [l.id, l.organisation] as const),
  ...responders.map((r) => [r.id, r.name] as const),
  ...suppliers.map((s) => [s.id, s.name] as const),
  ...partners.map((p) => [p.id, p.name] as const),
])

function organisation(id: string): string {
  const name = ORGANISATIONS.get(id)
  if (!name) throw new Error(`Feedback names an organisation that isn't in the data: ${id}`)
  return name
}

/** Newest first. */
export const FEEDBACK: readonly FeedbackEntry[] = SEEDS.map(
  ({ orgId, daysAgo, ...seed }, i): FeedbackEntry => ({
    id: makeId('FB', i + 1),
    organisation: organisation(orgId),
    date: daysFrom(DATA_AS_OF, -daysAgo),
    ...seed,
  }),
).sort(newestFirst)

/** Which dataset each seeded entry came from, for the tests. */
export const FEEDBACK_SOURCES: ReadonlyMap<string, string> = new Map(
  SEEDS.map((seed, i) => [makeId('FB', i + 1), seed.orgId]),
)
