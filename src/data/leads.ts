import type { Rng } from '@/lib/rng'
import type { Lead, LeadSource, LeadStage, Partner, SectorId, Timestamp } from '@/types'
import { SECTOR_PROFILES } from './customers'
import { daysFrom, makeContact, makeId, pickTown } from './helpers'
import { LEAD_STEMS } from './names'
import { TOWNS } from './towns'

/** How many leads sit at each stage. */
export const STAGE_COUNTS: Record<LeadStage, number> = {
  'wait-list': 10,
  contacted: 9,
  discovery: 8,
  proposal: 6,
  negotiation: 4,
  lost: 3,
}

const SECTOR_WEIGHTS: Record<SectorId, number> = {
  medical: 3,
  education: 2,
  hospitality: 1,
  manufacturing: 3,
  aviation: 1,
  warehousing: 2,
  agriculture: 1,
  power: 1.5,
  telecoms: 2,
}

const SOURCE_WEIGHTS: Record<LeadSource, number> = {
  'partner-referral': 0.3,
  'trade-show': 0.2,
  inbound: 0.3,
  outbound: 0.2,
}

const CONTACT_ROLES: Record<SectorId, readonly string[]> = {
  medical: ['Director of estates', 'Head of engineering'],
  education: ['Director of estates', 'Energy manager'],
  hospitality: ['Operations director', 'Group facilities manager'],
  manufacturing: ['Engineering manager', 'Plant director'],
  aviation: ['Head of airfield engineering', 'Infrastructure director'],
  warehousing: ['Property director', 'Head of facilities'],
  agriculture: ['Farm director', 'Estate manager'],
  power: ['Asset director', 'Head of operations'],
  telecoms: ['Head of critical facilities', 'Data centre director'],
}

/** What we learned about the organisation. */
const SECTOR_NOTES: Record<SectorId, readonly string[]> = {
  medical: [
    'Two 11 kV intakes; the estates team only covers HV in-house on weekdays.',
    'Recent loss of supply to theatres, and the board now wants a guaranteed response time.',
    'Their authorised person retires next year and they are weighing up outsourced cover.',
  ],
  education: [
    'Campus ring main with legacy oil RMUs; exam season is the worry.',
    'Halls of residence on a private network, with complaints after an overnight outage.',
    'The estates director wants one contract across every campus.',
  ],
  hospitality: [
    'Peak-season outages cost bookings, and nobody on site is HV-authorised.',
    'Conference venue whose standby generator failed its last load test.',
  ],
  manufacturing: [
    'Continuous process line: an hour of downtime costs more than a year of cover.',
    'Current contractor retainer renews in March and they are open to switching.',
    'Their insurer flagged slow fault response at the last survey.',
  ],
  aviation: [
    'Airside substations need security-cleared engineers; asked how vetting works.',
    'Wants response-time evidence it can show the regulator.',
  ],
  warehousing: [
    'Cold store stock is at risk after four hours without power.',
    'Multi-site operator comparing a membership with ad hoc call-outs.',
  ],
  agriculture: [
    'Remote site on a long overhead line; worried about the distance to responders.',
    'Glasshouse heating and lighting run from a private 11 kV supply.',
  ],
  power: [
    'Solar and battery sites need fast switching after DNO faults.',
    'Owns private 11 kV cable between two generation sites.',
  ],
  telecoms: [
    'Tier III data centre that needs authorised engineers inside its SLA window.',
    'Exchange sites spread across rural areas, so coverage is the main question.',
  ],
}

/** The discovery note that records a product demo. */
export const DEMO_NOTE = 'Walked through the three-click request; asked about pricing.'

/** Whether the lead's notes record a walk-through of the product. */
export function hadDemo(lead: Lead): boolean {
  return lead.notes.endsWith(DEMO_NOTE)
}

/** Where things stand. */
const STAGE_NOTES: Record<LeadStage, readonly string[]> = {
  'wait-list': [
    'Joined the early-adopter wait-list; not contacted yet.',
    'Signed up to the wait-list after an industry webinar; not contacted yet.',
  ],
  contacted: ['Intro email sent; call being arranged.', 'Left a voicemail; follow up next week.'],
  discovery: ['Discovery call held; site list requested.', DEMO_NOTE],
  proposal: [
    'Proposal sent for membership across all sites.',
    'Proposal with the early-adopter discount is under review.',
  ],
  negotiation: [
    'Negotiating site count and start date.',
    'Procurement is reviewing terms; decision expected this month.',
  ],
  lost: [
    'Decided to keep their in-house authorised person.',
    'Renewed an existing contractor retainer.',
  ],
}

export interface LeadOptions {
  rng: Rng
  partners: readonly Partner[]
  asOf: Timestamp
}

export function generateLeads({ rng, partners, asOf }: LeadOptions): Lead[] {
  const stems = rng.shuffle(LEAD_STEMS)
  const stages = rng.shuffle(
    (Object.keys(STAGE_COUNTS) as LeadStage[]).flatMap((stage) =>
      Array.from({ length: STAGE_COUNTS[stage] }, () => stage),
    ),
  )
  // Referrals still open: each partner can only refer so many leads
  const openReferrals = new Map(partners.map((p) => [p.id, p.referrals - p.convertedReferrals]))
  const sectorWeights = (Object.keys(SECTOR_WEIGHTS) as SectorId[]).map((sector) => ({
    value: sector,
    weight: SECTOR_WEIGHTS[sector],
  }))
  const sourceWeights = (Object.keys(SOURCE_WEIGHTS) as LeadSource[]).map((source) => ({
    value: source,
    weight: SOURCE_WEIGHTS[source],
  }))

  return stages.map((stage, index): Lead => {
    const stem = stems[index]
    if (!stem) throw new Error('Not enough lead name stems')
    const sector = rng.weighted(sectorWeights)
    const profile = SECTOR_PROFILES[sector]
    const town = profile.towns ? pickTown(rng, TOWNS, profile.towns, 0.2) : pickTown(rng, TOWNS, {})

    let source = rng.weighted(sourceWeights)
    // Nobody we have reached out to is still waiting to be contacted
    if (stage === 'wait-list' && source === 'outbound') source = 'inbound'
    let partnerId: string | null = null
    if (source === 'partner-referral') {
      const available = partners.filter((p) => (openReferrals.get(p.id) ?? 0) > 0)
      if (available.length > 0) {
        const partner = rng.weighted(
          available.map((p) => ({ value: p, weight: openReferrals.get(p.id) ?? 0 })),
        )
        openReferrals.set(partner.id, (openReferrals.get(partner.id) ?? 0) - 1)
        partnerId = partner.id
      } else {
        source = 'inbound'
      }
    }

    const ageDays = rng.int(3, 300)
    const createdAt = daysFrom(asOf, -ageDays)
    // Lost leads went quiet a while ago; live ones were touched recently, a few have gone stale
    const lastContactDaysAgo =
      stage === 'lost'
        ? rng.int(Math.min(30, ageDays), ageDays)
        : rng.chance(0.2)
          ? rng.int(30, 75)
          : rng.int(0, 21)
    const lastContactAt =
      stage === 'wait-list' ? null : daysFrom(asOf, -Math.min(ageDays, lastContactDaysAgo))

    // Prospects are often bigger than the customers signed so far
    const [minSites, maxSites] = profile.sites
    return {
      id: makeId('LEAD', index + 1),
      organisation: rng.pick(profile.names)(stem),
      sector,
      town: town.name,
      region: town.region,
      stage,
      estimatedSites: rng.int(minSites, maxSites * 2),
      source,
      partnerId,
      contact: makeContact(rng, rng.pick(CONTACT_ROLES[sector])),
      createdAt,
      lastContactAt,
      notes: `${rng.pick(SECTOR_NOTES[sector])} ${rng.pick(STAGE_NOTES[stage])}`,
    }
  })
}
