import type { Rng } from '@/lib/rng'
import type { Partner, PartnerKind, Timestamp } from '@/types'
import { daysFrom, makeContact, makeId, pickTown, type TownWeights } from './helpers'
import { PARTNER_STEMS, TRADE_BODY_NAMES } from './names'
import { TOWNS } from './towns'

interface KindProfile {
  partners: number
  names: readonly ((stem: string) => string)[]
  referrals: [min: number, max: number]
  contactRole: string
}

export const PARTNER_PROFILES: Record<PartnerKind, KindProfile> = {
  'facilities-management': {
    partners: 3,
    names: [(s) => `${s} Facilities Management`, (s) => `${s} Estates Services`],
    referrals: [4, 14],
    contactRole: 'Head of engineering services',
  },
  'icp-idno': {
    partners: 3,
    names: [(s) => `${s} Connections`, (s) => `${s} Distribution`],
    referrals: [2, 8],
    contactRole: 'Business development manager',
  },
  insurer: {
    partners: 2,
    names: [(s) => `${s} Engineering Insurance`, (s) => `${s} Mutual`],
    referrals: [3, 10],
    contactRole: 'Risk engineering lead',
  },
  consultant: {
    partners: 2,
    names: [(s) => `${s} Consulting Engineers`, (s) => `${s} & Partners`],
    referrals: [1, 6],
    contactRole: 'Associate director',
  },
  'trade-body': {
    partners: 2,
    // Trade bodies use fixed names; see TRADE_BODY_NAMES
    names: [],
    referrals: [0, 4],
    contactRole: 'Membership secretary',
  },
}

const TOWN_WEIGHTS: TownWeights = {
  London: 4,
  Birmingham: 3,
  Manchester: 3,
  Leeds: 2,
  Bristol: 2,
  Glasgow: 2,
  Edinburgh: 1,
  Nottingham: 1,
  Cardiff: 1,
  Reading: 1,
}

export interface PartnerOptions {
  rng: Rng
  asOf: Timestamp
}

export function generatePartners({ rng, asOf }: PartnerOptions): Partner[] {
  const stems = rng.shuffle(PARTNER_STEMS)
  const kinds = (Object.keys(PARTNER_PROFILES) as PartnerKind[]).flatMap((kind) =>
    Array.from({ length: PARTNER_PROFILES[kind].partners }, () => kind),
  )
  let stemIndex = 0
  let tradeBodyIndex = 0

  return kinds.map((kind, index): Partner => {
    const profile = PARTNER_PROFILES[kind]
    let name: string
    if (kind === 'trade-body') {
      name = TRADE_BODY_NAMES[tradeBodyIndex++] ?? ''
    } else {
      const stem = stems[stemIndex++]
      name = stem ? rng.pick(profile.names)(stem) : ''
    }
    if (!name) throw new Error(`Not enough names for partner kind ${kind}`)

    const town = pickTown(rng, TOWNS, TOWN_WEIGHTS, 0)
    const referrals = rng.int(...profile.referrals)
    return {
      id: makeId('PTN', index + 1),
      name,
      kind,
      town: town.name,
      region: town.region,
      referrals,
      // Under half of referrals have converted so far
      convertedReferrals: rng.int(0, Math.floor(referrals * 0.45)),
      since: daysFrom(asOf, -rng.int(60, 700)),
      contact: makeContact(rng, profile.contactRole),
    }
  })
}
