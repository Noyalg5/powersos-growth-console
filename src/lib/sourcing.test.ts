import { describe, expect, it } from 'vitest'
import type { StockItem, Supplier } from '@/types'
import { destinationPoint } from './geo'
import {
  deliveryTime,
  describeStock,
  isTradingHours,
  LOAD_OUT_MINUTES,
  parseKva,
  sourceItem,
  type ItemRequest,
} from './sourcing'
import { DAY_MS, MINUTE_MS } from './time'

// Wednesday 14 Oct 2026 in London (BST)
const MIDDAY = Date.UTC(2026, 9, 14, 11, 0)
const TWO_AM = Date.UTC(2026, 9, 14, 1, 0)

const site = { lat: 53.7632, lng: -2.7031, region: 'North West' as const }

const line = (description: string, quantity: number, leadTimeDays: number): StockItem => ({
  description,
  quantity,
  unit: 'each',
  leadTimeDays,
})

function supplier(id: string, km: number, overrides: Partial<Supplier> = {}): Supplier {
  return {
    id,
    name: `Supplier ${id}`,
    category: 'generator-hire',
    town: 'Testtown',
    region: 'North West',
    ...destinationPoint(site, 180, km),
    regionsServed: ['North West'],
    emergencyLine: true,
    stock: [],
    joinedAt: MIDDAY - 300 * DAY_MS,
    contact: { name: 'Test Person', role: 'Sales manager', phone: '07700 900000' },
    ...overrides,
  }
}

const generator: ItemRequest = { category: 'generator-hire', purpose: 'hire', minKva: 480 }

describe('parseKva', () => {
  it('reads the rating from a catalogue description', () => {
    expect(parseKva('1,000 kVA containerised generator')).toBe(1000)
    expect(parseKva('500 kVA 11/0.433 kV ground-mounted transformer')).toBe(500)
    expect(parseKva('Refurbished 800 kVA transformer (exchange unit)')).toBe(800)
  })

  it('returns null when there is no kVA rating', () => {
    expect(parseKva('Resistive load bank, 500 kW')).toBeNull()
    expect(parseKva('Trip battery and charger')).toBeNull()
  })
})

describe('isTradingHours', () => {
  it('is weekdays 08:00 to 17:59 London time', () => {
    expect(isTradingHours(MIDDAY)).toBe(true)
    expect(isTradingHours(TWO_AM)).toBe(false)
    expect(isTradingHours(Date.UTC(2026, 9, 14, 7, 0))).toBe(true)
    expect(isTradingHours(Date.UTC(2026, 9, 14, 17, 0))).toBe(false)
    expect(isTradingHours(Date.UTC(2026, 9, 17, 11, 0))).toBe(false)
  })
})

describe('deliveryTime', () => {
  it('loads and drives same-day orders straight to site', () => {
    expect(deliveryTime(MIDDAY, 0, 45)).toBe(MIDDAY + (LOAD_OUT_MINUTES + 45) * MINUTE_MS)
  })

  it('adds whole days otherwise', () => {
    expect(deliveryTime(MIDDAY, 2, 45)).toBe(MIDDAY + 2 * DAY_MS)
  })

  it('rejects an unusable lead time', () => {
    expect(() => deliveryTime(MIDDAY, -1, 10)).toThrow(RangeError)
    expect(() => deliveryTime(MIDDAY, 1.5, 10)).toThrow(RangeError)
  })
})

describe('sourceItem', () => {
  it('picks the smallest unit big enough, preferring one in stock', () => {
    const hire = supplier('SUP-001', 20, {
      stock: [
        line('250 kVA generator', 5, 0),
        line('500 kVA containerised generator', 2, 1),
        line('1,000 kVA containerised generator', 3, 1),
      ],
    })
    const result = sourceItem([hire], generator, site, MIDDAY)
    expect(result.chosen?.item?.description).toBe('500 kVA containerised generator')
  })

  it('sends in-stock items the same day from a supplier with an emergency line', () => {
    const stock = [line('500 kVA containerised generator', 2, 3)]
    const withLine = sourceItem([supplier('SUP-001', 20, { stock })], generator, site, MIDDAY)
    expect(withLine.chosen?.leadTimeDays).toBe(0)

    const without = sourceItem(
      [supplier('SUP-001', 20, { stock, emergencyLine: false })],
      generator,
      site,
      MIDDAY,
    )
    expect(without.chosen?.leadTimeDays).toBe(3)
    expect(without.chosen?.deliveryAt).toBe(MIDDAY + 3 * DAY_MS)
  })

  it('prefers stock on the shelf over a nearer back-order', () => {
    const backOrder = supplier('SUP-001', 5, { stock: [line('500 kVA containerised generator', 0, 4)] })
    const inStock = supplier('SUP-002', 80, { stock: [line('500 kVA containerised generator', 1, 0)] })
    const result = sourceItem([backOrder, inStock], generator, site, MIDDAY)
    expect(result.chosen?.supplier.id).toBe('SUP-002')
    expect(result.checks.map((c) => c.supplier.id)).toEqual(['SUP-002', 'SUP-001'])
  })

  it('falls back to a back-order when nothing is on the shelf', () => {
    const backOrder = supplier('SUP-001', 5, { stock: [line('500 kVA containerised generator', 0, 4)] })
    const result = sourceItem([backOrder], generator, site, MIDDAY)
    expect(result.chosen?.deliveryAt).toBe(MIDDAY + 4 * DAY_MS)
  })

  it('excludes suppliers that cannot take or fulfil the order, with reasons', () => {
    const stock = [line('500 kVA containerised generator', 2, 0)]
    const suppliers = [
      supplier('SUP-001', 5, { stock, regionsServed: ['Scotland'] }),
      supplier('SUP-002', 6, { stock, emergencyLine: false }),
      supplier('SUP-003', 7, { stock: [line('250 kVA generator', 9, 0)] }),
      supplier('SUP-004', 8, { stock, category: 'fuel' }),
    ]
    const result = sourceItem(suppliers, generator, site, TWO_AM)
    expect(result.chosen).toBeNull()
    expect(result.checks.map((c) => [c.supplier.id, c.exclusions.map((e) => e.code)])).toEqual([
      ['SUP-001', ['region']],
      ['SUP-002', ['no-emergency-line']],
      ['SUP-003', ['not-stocked']],
    ])
    expect(result.checks[0]?.exclusions[0]?.label).toBe("Doesn't deliver to North West")
  })

  it('takes orders from suppliers without an emergency line in trading hours', () => {
    const stock = [line('Trip battery and charger', 2, 1)]
    const request: ItemRequest = {
      category: 'switchgear',
      purpose: 'part',
      description: 'Trip battery and charger',
    }
    const shop = supplier('SUP-001', 10, { category: 'switchgear', stock, emergencyLine: false })
    expect(sourceItem([shop], request, site, MIDDAY).chosen?.supplier.id).toBe('SUP-001')
    expect(sourceItem([shop], request, site, TWO_AM).chosen).toBeNull()
  })

  it('needs a description or a minimum rating', () => {
    const hire = supplier('SUP-001', 10, { stock: [line('250 kVA generator', 1, 0)] })
    expect(() =>
      sourceItem([hire], { category: 'generator-hire', purpose: 'hire' }, site, MIDDAY),
    ).toThrow(RangeError)
  })
})

describe('describeStock', () => {
  it('reads naturally for each unit', () => {
    expect(describeStock(line('Trip battery and charger', 2, 1))).toBe('2 in stock')
    expect(describeStock({ ...line('Generator', 1, 0), unit: 'units' })).toBe('1 in stock')
    expect(describeStock({ ...line('Oil', 31, 1), unit: 'drums' })).toBe('31 drums in stock')
    expect(describeStock(line('HV bushing set', 0, 36))).toBe('Out of stock: 36-day lead time')
  })
})
