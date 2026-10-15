import type { Rng } from '@/lib/rng'
import type { Responder, Timestamp } from '@/types'
import { clamp, daysFrom, makeContact, makeId, placeNear, roundTo } from './helpers'
import { RESPONDER_STEMS } from './names'
import { getTown, type TownName } from './towns'

/**
 * Where the HV contractors are based: thick in the Midlands, the North and the big
 * cities, absent from Cornwall, west and north Wales, Cumbria, Dumfries and Galloway
 * and the Highlands. Those gaps are deliberate: Network health should find them.
 */
const BASE_TOWNS: readonly TownName[] = [
  'Birmingham',
  'Birmingham',
  'Birmingham',
  'Manchester',
  'Manchester',
  'Manchester',
  'London',
  'London',
  'London',
  'Leeds',
  'Leeds',
  'Bristol',
  'Bristol',
  'Glasgow',
  'Edinburgh',
  'Aberdeen',
  'Sheffield',
  'Nottingham',
  'Derby',
  'Newcastle',
  'Stoke-on-Trent',
  'Coventry',
  'Leicester',
  'Wolverhampton',
  'Liverpool',
  'Preston',
  'York',
  'Middlesbrough',
  'Cardiff',
  'Southampton',
  'Reading',
  'Cambridge',
  'Exeter',
  'Norwich',
  'Canterbury',
]

const NAME_ENDINGS = [
  'HV Services',
  'High Voltage',
  'Power Engineering',
  'Electrical Contractors',
  'HV Solutions',
  'Switching Services',
]

const CONTACT_ROLES = ['Operations director', 'Control room supervisor', 'Managing director']

/** A contractor's trading name from a name stem: "Sparwick HV Services Ltd". */
export function responderName(rng: Rng, stem: string): string {
  return `${stem} ${rng.pick(NAME_ENDINGS)}${rng.chance(0.5) ? ' Ltd' : ''}`
}

/**
 * How many responders fall into each compliance situation. The groups never
 * overlap, so each responder shows at most one problem.
 */
export const COMPLIANCE_GROUPS = {
  authorisationExpired: 3,
  authorisationDueSoon: 6,
  insuranceExpired: 2,
  insuranceDueSoon: 6,
  auditOverdue: 4,
} as const

type ComplianceGroup = keyof typeof COMPLIANCE_GROUPS | 'clear'

export interface ResponderOptions {
  rng: Rng
  asOf: Timestamp
}

export function generateResponders({ rng, asOf }: ResponderOptions): Responder[] {
  const stems = rng.shuffle(RESPONDER_STEMS)
  const bases = rng.shuffle(BASE_TOWNS)

  // Deal out the compliance situations to distinct responders
  const groups: ComplianceGroup[] = bases.map(() => 'clear')
  let next = 0
  const order = rng.shuffle(groups.map((_, i) => i))
  for (const [group, count] of Object.entries(COMPLIANCE_GROUPS)) {
    for (let i = 0; i < count; i++) groups[order[next++] as number] = group as ComplianceGroup
  }

  return groups.map((group, index): Responder => {
    const stem = stems[index]
    if (!stem) throw new Error('Not enough responder name stems')
    const town = getTown(bases[index] as TownName)
    const engineers = rng.int(3, 24)
    const seniorAuthorised = rng.chance(0.55)
    const overnight = rng.chance(0.7)

    const authorisationExpiry =
      group === 'authorisationExpired'
        ? daysFrom(asOf, -rng.int(5, 75))
        : group === 'authorisationDueSoon'
          ? daysFrom(asOf, rng.int(4, 88))
          : daysFrom(asOf, rng.int(95, 1080))
    const insuranceExpiry =
      group === 'insuranceExpired'
        ? daysFrom(asOf, -rng.int(3, 40))
        : group === 'insuranceDueSoon'
          ? daysFrom(asOf, rng.int(2, 89))
          : daysFrom(asOf, rng.int(92, 364))
    // Most joined before the 12-month call-out window; a few are recent recruits.
    // Overdue audits belong to long-standing responders.
    let joinedDaysAgo = rng.chance(0.8) ? rng.int(380, 1000) : rng.int(40, 360)
    if (group === 'auditOverdue') joinedDaysAgo = Math.max(joinedDaysAgo, 540)
    // Everyone is audited when they join, and yearly after that
    const auditDaysAgo =
      group === 'auditOverdue' ? rng.int(380, 520) : rng.int(15, Math.min(330, joinedDaysAgo))

    return {
      id: makeId('RSP', index + 1),
      name: responderName(rng, stem),
      town: town.name,
      region: town.region,
      ...placeNear(rng, town),
      engineers,
      authorisationLevel: seniorAuthorised ? 'senior-authorised-person' : 'authorised-person',
      maxVoltageKv: seniorAuthorised && rng.chance(0.5) ? 33 : 11,
      authorisationExpiry,
      insuranceExpiry,
      lastAuditAt: daysFrom(asOf, -auditDaysAgo),
      rating: roundTo(clamp(rng.normal(4.3, 0.35), 3.2, 5), 1),
      availability: {
        // Overnight cover always includes weekends
        weekends: overnight || rng.chance(0.6),
        overnight,
        onCallEngineers: Math.max(1, Math.round(engineers * rng.float(0.15, 0.35))),
      },
      rates: {
        callOutFee: rng.int(36, 96) * 5,
        hourlyRate: rng.int(75, 135),
        outOfHoursMultiplier: rng.pick([1.5, 1.5, 1.75, 2]),
      },
      joinedAt: daysFrom(asOf, -joinedDaysAgo),
      contact: makeContact(rng, rng.pick(CONTACT_ROLES)),
    }
  })
}
