import { haversineKm } from '@/lib/geo'
import type { Rng } from '@/lib/rng'
import type { Region, StockItem, Supplier, SupplierCategory, Timestamp } from '@/types'
import { daysFrom, makeContact, makeId, placeNear } from './helpers'
import { SUPPLIER_STEMS } from './names'
import { getTown, TOWNS, type TownName } from './towns'

interface CatalogueItem {
  description: string
  unit: string
  maxQuantity: number
  /** Stock is held in multiples of this (default 1). */
  step?: number
  /** Delivery in days when in stock, and when it has to be ordered in. */
  inStockDays: [min: number, max: number]
  backOrderDays: [min: number, max: number]
}

interface CategoryProfile {
  /** One supplier per base. */
  bases: readonly TownName[]
  names: readonly ((stem: string) => string)[]
  emergencyLineChance: number
  catalogue: readonly CatalogueItem[]
}

export const CATEGORY_PROFILES: Record<SupplierCategory, CategoryProfile> = {
  transformers: {
    bases: ['Stoke-on-Trent', 'Leeds', 'Glasgow'],
    names: [(s) => `${s} Transformers`, (s) => `${s} Transformer Services`],
    emergencyLineChance: 0.5,
    catalogue: [
      {
        description: '500 kVA 11/0.433 kV ground-mounted transformer',
        unit: 'each',
        maxQuantity: 3,
        inStockDays: [1, 3],
        backOrderDays: [90, 200],
      },
      {
        description: '1,000 kVA 11/0.433 kV ground-mounted transformer',
        unit: 'each',
        maxQuantity: 3,
        inStockDays: [1, 3],
        backOrderDays: [120, 260],
      },
      {
        description: '1,250 kVA 11/0.433 kV ground-mounted transformer',
        unit: 'each',
        maxQuantity: 2,
        inStockDays: [1, 3],
        backOrderDays: [140, 270],
      },
      {
        description: '1,600 kVA 11/0.433 kV ground-mounted transformer',
        unit: 'each',
        maxQuantity: 2,
        inStockDays: [2, 4],
        backOrderDays: [150, 280],
      },
      {
        description: 'Refurbished 800 kVA transformer (exchange unit)',
        unit: 'each',
        maxQuantity: 2,
        inStockDays: [1, 2],
        backOrderDays: [21, 45],
      },
      {
        description: 'Transformer oil, 205 L drum',
        unit: 'drums',
        maxQuantity: 40,
        inStockDays: [1, 2],
        backOrderDays: [5, 10],
      },
      {
        description: 'HV bushing set',
        unit: 'sets',
        maxQuantity: 8,
        inStockDays: [1, 3],
        backOrderDays: [20, 60],
      },
    ],
  },
  switchgear: {
    bases: ['Birmingham', 'Manchester', 'Bristol'],
    names: [(s) => `${s} Switchgear`, (s) => `${s} Switchgear Spares`],
    emergencyLineChance: 0.5,
    catalogue: [
      {
        description: '11 kV ring main unit, non-extensible',
        unit: 'each',
        maxQuantity: 4,
        inStockDays: [1, 3],
        backOrderDays: [42, 120],
      },
      {
        description: 'RMU cable box kit',
        unit: 'kits',
        maxQuantity: 12,
        inStockDays: [1, 2],
        backOrderDays: [14, 35],
      },
      {
        description: 'Overcurrent and earth-fault protection relay',
        unit: 'each',
        maxQuantity: 10,
        inStockDays: [1, 2],
        backOrderDays: [14, 42],
      },
      {
        description: '11 kV vacuum circuit breaker truck',
        unit: 'each',
        maxQuantity: 3,
        inStockDays: [2, 5],
        backOrderDays: [60, 140],
      },
      {
        description: 'HV fuse set',
        unit: 'sets',
        maxQuantity: 30,
        inStockDays: [0, 1],
        backOrderDays: [7, 21],
      },
      {
        description: 'Trip battery and charger',
        unit: 'each',
        maxQuantity: 10,
        inStockDays: [0, 2],
        backOrderDays: [7, 14],
      },
    ],
  },
  'generator-hire': {
    bases: ['Coventry', 'Sheffield', 'London'],
    names: [(s) => `${s} Generator Hire`, (s) => `${s} Power Hire`],
    emergencyLineChance: 1,
    catalogue: [
      {
        description: '100 kVA towable generator',
        unit: 'units',
        maxQuantity: 12,
        inStockDays: [0, 0],
        backOrderDays: [1, 3],
      },
      {
        description: '250 kVA generator',
        unit: 'units',
        maxQuantity: 8,
        inStockDays: [0, 0],
        backOrderDays: [1, 3],
      },
      {
        description: '500 kVA containerised generator',
        unit: 'units',
        maxQuantity: 5,
        inStockDays: [0, 1],
        backOrderDays: [2, 5],
      },
      {
        description: '1,000 kVA containerised generator',
        unit: 'units',
        maxQuantity: 3,
        inStockDays: [0, 1],
        backOrderDays: [3, 7],
      },
      {
        description: 'Resistive load bank, 500 kW',
        unit: 'units',
        maxQuantity: 4,
        inStockDays: [0, 1],
        backOrderDays: [2, 5],
      },
      {
        description: 'LV distribution cable set',
        unit: 'sets',
        maxQuantity: 20,
        inStockDays: [0, 0],
        backOrderDays: [1, 2],
      },
    ],
  },
  'cable-jointing': {
    bases: ['Newcastle', 'Nottingham', 'Cardiff'],
    names: [(s) => `${s} Cable & Jointing`, (s) => `${s} Cables`],
    emergencyLineChance: 0.5,
    catalogue: [
      {
        description: '11 kV XLPE cable, 3-core 185 mm²',
        unit: 'metres',
        maxQuantity: 2000,
        step: 50,
        inStockDays: [1, 2],
        backOrderDays: [10, 30],
      },
      {
        description: '11 kV straight joint kit',
        unit: 'kits',
        maxQuantity: 25,
        inStockDays: [0, 1],
        backOrderDays: [5, 15],
      },
      {
        description: '11 kV transition joint kit (PILC to XLPE)',
        unit: 'kits',
        maxQuantity: 15,
        inStockDays: [0, 1],
        backOrderDays: [7, 21],
      },
      {
        description: '11 kV termination kit',
        unit: 'kits',
        maxQuantity: 20,
        inStockDays: [0, 1],
        backOrderDays: [5, 15],
      },
      {
        description: 'Cable fault location van, with operator',
        unit: 'days',
        maxQuantity: 2,
        inStockDays: [0, 1],
        backOrderDays: [2, 4],
      },
    ],
  },
  fuel: {
    bases: ['Manchester', 'Southampton', 'Edinburgh'],
    names: [(s) => `${s} Fuels`, (s) => `${s} Fuel Services`],
    emergencyLineChance: 1,
    catalogue: [
      {
        description: 'Diesel, bulk delivery',
        unit: 'litres',
        maxQuantity: 60000,
        step: 1000,
        inStockDays: [0, 1],
        backOrderDays: [1, 2],
      },
      {
        description: 'HVO renewable diesel, bulk delivery',
        unit: 'litres',
        maxQuantity: 30000,
        step: 1000,
        inStockDays: [0, 1],
        backOrderDays: [2, 4],
      },
      {
        description: 'Emergency top-up, 1,000 L bowser',
        unit: 'bowsers',
        maxQuantity: 10,
        inStockDays: [0, 0],
        backOrderDays: [1, 1],
      },
      {
        description: 'Fuel polishing service',
        unit: 'visits',
        maxQuantity: 4,
        inStockDays: [1, 3],
        backOrderDays: [5, 10],
      },
    ],
  },
}

/** Suppliers that are not national cover every region with a town this close to their base. */
const REGIONAL_REACH_KM = 220

export interface SupplierOptions {
  rng: Rng
  asOf: Timestamp
}

export function generateSuppliers({ rng, asOf }: SupplierOptions): Supplier[] {
  const stems = rng.shuffle(SUPPLIER_STEMS)
  const placements = (Object.keys(CATEGORY_PROFILES) as SupplierCategory[]).flatMap((category) =>
    CATEGORY_PROFILES[category].bases.map((base) => ({ category, town: getTown(base) })),
  )
  const allRegions = [...new Set(TOWNS.map((town) => town.region))]

  return placements.map(({ category, town }, index): Supplier => {
    const profile = CATEGORY_PROFILES[category]
    const stem = stems[index]
    if (!stem) throw new Error('Not enough supplier name stems')
    const location = placeNear(rng, town)

    const regionsServed: Region[] = rng.chance(0.35)
      ? allRegions
      : allRegions.filter((region) =>
          TOWNS.some((t) => t.region === region && haversineKm(location, t) <= REGIONAL_REACH_KM),
        )

    const stocked = rng.shuffle(profile.catalogue).slice(0, rng.int(4, profile.catalogue.length))
    const stock = profile.catalogue
      .filter((item) => stocked.includes(item))
      .map((item): StockItem => {
        // About one line in five is out of stock and has to be ordered in
        const step = item.step ?? 1
        const quantity = rng.chance(0.2) ? 0 : rng.int(1, item.maxQuantity / step) * step
        const [min, max] = quantity > 0 ? item.inStockDays : item.backOrderDays
        return {
          description: item.description,
          quantity,
          unit: item.unit,
          leadTimeDays: rng.int(min, max),
        }
      })

    return {
      id: makeId('SUP', index + 1),
      name: rng.pick(profile.names)(stem),
      category,
      town: town.name,
      region: town.region,
      ...location,
      regionsServed,
      emergencyLine: rng.chance(profile.emergencyLineChance),
      stock,
      joinedAt: daysFrom(asOf, -rng.int(60, 720)),
      contact: makeContact(rng, 'Sales manager'),
    }
  })
}
