import type { Rng } from '@/lib/rng'
import type {
  Criticality,
  Customer,
  Equipment,
  Insulation,
  SectorId,
  Site,
  StandbyGenerator,
  Timestamp,
  Town,
} from '@/types'
import {
  daysFrom,
  makeContact,
  makeId,
  pickTown,
  placeNear,
  townsByDistance,
  type TownWeights,
} from './helpers'
import { CUSTOMER_STEMS } from './names'
import { TOWNS } from './towns'

interface SectorProfile {
  /** How many customers in the sector. */
  customers: number
  sites: [min: number, max: number]
  criticality: [min: Criticality, max: Criticality]
  /** Regional customers cluster around their head office; national ones spread out. */
  footprint: 'regional' | 'national'
  names: readonly ((stem: string) => string)[]
  siteKinds: readonly string[]
  contactRoles: readonly [primary: string, onCall: string]
  transformerKva: readonly number[]
  maxTransformers: number
  switchgearChance: number
  generatorChance: number
  /** Sector hotspots. Unlisted towns weigh SECTOR_TOWN_FALLBACK. */
  towns?: TownWeights
}

export const SECTOR_PROFILES: Record<SectorId, SectorProfile> = {
  medical: {
    customers: 9,
    sites: [1, 6],
    criticality: [4, 5],
    footprint: 'regional',
    names: [(s) => `${s} Healthcare`, (s) => `${s} Hospitals`, (s) => `${s} Medical Group`],
    siteKinds: ['Hospital', 'Treatment Centre', 'Diagnostics Centre', 'Rehabilitation Unit'],
    contactRoles: ['Estates manager', 'Duty estates officer'],
    transformerKva: [500, 800, 1000, 1250, 1600],
    maxTransformers: 3,
    switchgearChance: 0.8,
    generatorChance: 1,
  },
  education: {
    customers: 8,
    sites: [1, 5],
    criticality: [2, 4],
    footprint: 'regional',
    names: [(s) => `University of ${s}`, (s) => `${s} College`, (s) => `${s} Academy Trust`],
    siteKinds: ['Campus', 'Science Park', 'Halls of Residence', 'Sports Centre'],
    contactRoles: ['Estates manager', 'Security control room'],
    transformerKva: [500, 800, 1000, 1250],
    maxTransformers: 3,
    switchgearChance: 0.5,
    generatorChance: 0.5,
  },
  hospitality: {
    customers: 5,
    sites: [2, 6],
    criticality: [2, 3],
    footprint: 'national',
    names: [(s) => `${s} Hotels`, (s) => `${s} Resorts`, (s) => `${s} Leisure`],
    siteKinds: ['Hotel', 'Resort', 'Conference Centre', 'Spa Hotel'],
    contactRoles: ['General manager', 'Duty manager'],
    transformerKva: [500, 800, 1000],
    maxTransformers: 2,
    switchgearChance: 0.3,
    generatorChance: 0.5,
  },
  manufacturing: {
    customers: 10,
    sites: [1, 4],
    criticality: [2, 4],
    footprint: 'regional',
    names: [
      (s) => `${s} Foods`,
      (s) => `${s} Precision`,
      (s) => `${s} Plastics`,
      (s) => `${s} Glassworks`,
      (s) => `${s} Engineering`,
    ],
    siteKinds: ['Works', 'Plant', 'Factory', 'Mill'],
    contactRoles: ['Maintenance manager', 'Shift engineer'],
    transformerKva: [800, 1000, 1250, 1600, 2000],
    maxTransformers: 3,
    switchgearChance: 0.6,
    generatorChance: 0.4,
    towns: {
      Birmingham: 3,
      'Stoke-on-Trent': 3,
      Sheffield: 3,
      Derby: 2,
      Wolverhampton: 2,
      Coventry: 2,
      Leeds: 2,
    },
  },
  aviation: {
    customers: 3,
    sites: [1, 2],
    criticality: [4, 5],
    footprint: 'regional',
    // Tenants at or near an airport, never the airport itself
    names: [
      (s) => `${s} Aviation Services`,
      (s) => `${s} Air Cargo`,
      (s) => `${s} Aero Engineering`,
    ],
    siteKinds: ['Cargo Terminal', 'Maintenance Hangar', 'Business Aviation Terminal'],
    contactRoles: ['Airfield operations manager', 'Duty engineer'],
    transformerKva: [1000, 1250, 1600, 2000],
    maxTransformers: 4,
    switchgearChance: 0.9,
    generatorChance: 1,
    towns: { Bristol: 2, Newcastle: 2, Aberdeen: 2, Exeter: 1, Southampton: 1, Inverness: 1 },
  },
  warehousing: {
    customers: 8,
    sites: [2, 6],
    criticality: [2, 4],
    footprint: 'national',
    names: [(s) => `${s} Logistics`, (s) => `${s} Distribution`, (s) => `${s} Cold Storage`],
    siteKinds: ['Distribution Centre', 'Fulfilment Centre', 'Cold Store', 'Depot'],
    contactRoles: ['Site manager', 'Night shift manager'],
    transformerKva: [500, 800, 1000, 1250],
    maxTransformers: 2,
    switchgearChance: 0.3,
    generatorChance: 0.4,
  },
  agriculture: {
    customers: 4,
    sites: [1, 3],
    criticality: [1, 3],
    footprint: 'regional',
    names: [(s) => `${s} Farms`, (s) => `${s} Growers`, (s) => `${s} Dairies`],
    siteKinds: ['Farm', 'Glasshouses', 'Dairy', 'Grain Store'],
    contactRoles: ['Farm manager', 'Herd manager'],
    transformerKva: [315, 500],
    maxTransformers: 1,
    switchgearChance: 0.1,
    generatorChance: 0.3,
    towns: {
      Lincoln: 3,
      Norwich: 3,
      Truro: 2,
      Dumfries: 2,
      Perth: 2,
      Aberystwyth: 2,
      Exeter: 2,
      Carlisle: 2,
    },
  },
  power: {
    customers: 6,
    sites: [1, 5],
    criticality: [3, 5],
    footprint: 'national',
    names: [(s) => `${s} Energy`, (s) => `${s} Renewables`, (s) => `${s} Power`],
    siteKinds: ['Solar Farm', 'Battery Storage Site', 'Wind Farm', 'Biogas Plant', 'Energy Centre'],
    contactRoles: ['Asset manager', 'Control room'],
    transformerKva: [1000, 1600, 2000, 2500],
    maxTransformers: 3,
    switchgearChance: 0.6,
    generatorChance: 0.3,
    towns: { 'Fort William': 2, Inverness: 2, Aberdeen: 2, Lincoln: 2, Hull: 2, Swansea: 1 },
  },
  telecoms: {
    customers: 7,
    sites: [1, 6],
    criticality: [4, 5],
    footprint: 'national',
    names: [(s) => `${s} Data Centres`, (s) => `${s} Digital`, (s) => `${s} Telecom`],
    siteKinds: ['Data Centre', 'Exchange', 'Network Hub'],
    contactRoles: ['Data centre manager', 'Network operations centre'],
    transformerKva: [1600, 2000, 2500],
    maxTransformers: 4,
    switchgearChance: 0.9,
    generatorChance: 1,
    towns: { London: 4, Manchester: 2, Reading: 2, Cardiff: 1, Newcastle: 1, Leeds: 1 },
  },
}

/** Where customers without sector hotspots put their sites. Unlisted towns weigh 1. */
const DEFAULT_TOWN_WEIGHTS: TownWeights = {
  London: 5,
  Birmingham: 4,
  Manchester: 4,
  Leeds: 3,
  Glasgow: 3,
  Bristol: 3,
  Sheffield: 2,
  Newcastle: 2,
  Nottingham: 2,
  Leicester: 2,
  Liverpool: 2,
  Edinburgh: 2,
  Cardiff: 2,
  Coventry: 2,
  'Stoke-on-Trent': 2,
  Derby: 2,
  Wolverhampton: 2,
  Southampton: 2,
  Reading: 2,
  Cambridge: 2,
}

const SECTOR_TOWN_FALLBACK = 0.1

function pickSiteTown(rng: Rng, towns: readonly Town[], profile: SectorProfile): Town {
  return profile.towns
    ? pickTown(rng, towns, profile.towns, SECTOR_TOWN_FALLBACK)
    : pickTown(rng, towns, DEFAULT_TOWN_WEIGHTS)
}

const STANDARD_GENERATOR_KVA = [200, 350, 500, 800, 1000, 1250, 1500, 2000]

function insulation(rng: Rng, oilShare: number): Insulation {
  return rng.weighted([
    { value: 'SF6' as const, weight: 0.65 - oilShare / 2 },
    { value: 'vacuum' as const, weight: 0.35 - oilShare / 2 },
    { value: 'oil' as const, weight: oilShare },
  ])
}

function makeEquipment(rng: Rng, siteId: string, profile: SectorProfile): Equipment[] {
  const items: Equipment[] = []
  const nextId = () => `${siteId}-E${items.length + 1}`

  const rmus = 1 + (rng.chance(0.4) ? 1 : 0) + (rng.chance(0.15) ? 1 : 0)
  for (let i = 0; i < rmus; i++) {
    const kind = insulation(rng, 0.2)
    const installedYear = kind === 'oil' ? rng.int(1972, 1998) : rng.int(1995, 2024)
    items.push({ id: nextId(), kind: 'rmu', voltageKv: 11, insulation: kind, installedYear })
  }

  if (rng.chance(profile.switchgearChance)) {
    const kind = insulation(rng, 0.15)
    items.push({
      id: nextId(),
      kind: 'switchgear',
      voltageKv: 11,
      panels: rng.int(3, 9),
      insulation: kind,
      installedYear: kind === 'oil' ? rng.int(1975, 1999) : rng.int(1998, 2024),
    })
  }

  let totalKva = 0
  const transformers = rng.int(1, profile.maxTransformers)
  for (let i = 0; i < transformers; i++) {
    const ratingKva = rng.pick(profile.transformerKva)
    totalKva += ratingKva
    items.push({
      id: nextId(),
      kind: 'transformer',
      ratingKva,
      voltage: '11/0.433 kV',
      cooling: rng.chance(0.8) ? 'oil' : 'dry',
      installedYear: rng.int(1980, 2024),
    })
  }

  if (rng.chance(profile.generatorChance)) {
    // Sized to carry the essential load: roughly 60% of transformer capacity
    const target = totalKva * 0.6
    const ratingKva =
      STANDARD_GENERATOR_KVA.find((kva) => kva >= target) ?? STANDARD_GENERATOR_KVA.at(-1) ?? 2000
    const generator: StandbyGenerator = {
      id: nextId(),
      kind: 'generator',
      ratingKva,
      fuel: rng.weighted([
        { value: 'diesel' as const, weight: 0.75 },
        { value: 'HVO' as const, weight: 0.2 },
        { value: 'gas' as const, weight: 0.05 },
      ]),
      installedYear: rng.int(2000, 2025),
    }
    items.push(generator)
  }

  return items
}

/** Distinct towns for a customer's sites, starting with the head office. */
export function siteTowns(
  rng: Rng,
  home: Town,
  count: number,
  profile: SectorProfile,
  towns: readonly Town[],
) {
  const chosen = [home]
  if (profile.footprint === 'regional') {
    // The next nearest towns, shuffled, so sites cluster around the head office
    const nearby = townsByDistance(home, towns).slice(1, count + 2)
    chosen.push(...rng.shuffle(nearby).slice(0, count - 1))
  } else {
    let pool = towns.filter((town) => town !== home)
    while (chosen.length < count) {
      const town = pickSiteTown(rng, pool, profile)
      chosen.push(town)
      pool = pool.filter((t) => t !== town)
    }
  }
  return chosen
}

export interface CustomerOptions {
  rng: Rng
  asOf: Timestamp
}

export function generateCustomers({ rng, asOf }: CustomerOptions): Customer[] {
  const sectors = rng.shuffle(
    (Object.keys(SECTOR_PROFILES) as SectorId[]).flatMap((sector) =>
      Array.from({ length: SECTOR_PROFILES[sector].customers }, () => sector),
    ),
  )
  const stems = rng.shuffle(CUSTOMER_STEMS)
  let siteCount = 0

  return sectors.map((sector, index) => {
    const profile = SECTOR_PROFILES[sector]
    const id = makeId('CUS', index + 1)
    const stem = stems[index]
    if (!stem) throw new Error('Not enough customer name stems')
    const home = pickSiteTown(rng, TOWNS, profile)
    const count = rng.int(...profile.sites)

    const sites = siteTowns(rng, home, count, profile, TOWNS).map((town): Site => {
      siteCount++
      const siteId = makeId('SITE', siteCount)
      const [primary, onCall] = profile.contactRoles
      return {
        id: siteId,
        customerId: id,
        name: `${town.name} ${rng.pick(profile.siteKinds)}`,
        town: town.name,
        region: town.region,
        ...placeNear(rng, town),
        postcodeArea: town.postcodeArea,
        criticality: rng.int(...profile.criticality) as Criticality,
        equipment: makeEquipment(rng, siteId, profile),
        contacts: [makeContact(rng, primary), makeContact(rng, onCall)],
      }
    })

    return {
      id,
      name: rng.pick(profile.names)(stem),
      sector,
      headOffice: home.name,
      joinedAt: daysFrom(asOf, -rng.int(30, 760)),
      sites,
    }
  })
}
