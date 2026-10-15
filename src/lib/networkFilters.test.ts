import { describe, expect, it } from 'vitest'
import type { CallOut, Customer, Region, Responder, SectorId, Site } from '@/types'
import {
  coverContextFor,
  dataBounds,
  defaultFilters,
  filtersToParams,
  parseFilters,
  parseIsoDate,
  rangeUntil,
  scopeNetwork,
  toIsoDate,
  type NetworkFilters,
} from './networkFilters'
import { DAY_MS, MINUTE_MS } from './time'

const bounds = { min: Date.UTC(2025, 9, 14), max: Date.UTC(2026, 9, 14) }
const ASOF = Date.UTC(2026, 9, 14, 8, 0)
const options = {
  sectors: ['medical', 'telecoms'] as SectorId[],
  regions: ['Wales', 'North East'] as Region[],
}
const parse = (query: string) => parseFilters(new URLSearchParams(query), bounds, options)

describe('dataBounds', () => {
  it('runs for the twelve months to the data date, in whole days', () => {
    expect(dataBounds(ASOF)).toEqual({ min: Date.UTC(2025, 9, 14), max: Date.UTC(2026, 9, 14) })
    expect(dataBounds(Date.UTC(2026, 9, 14))).toEqual(dataBounds(ASOF))
  })
})

describe('ISO dates', () => {
  it('round-trips a day', () => {
    expect(toIsoDate(Date.UTC(2026, 2, 5))).toBe('2026-03-05')
    expect(parseIsoDate('2026-03-05')).toBe(Date.UTC(2026, 2, 5))
  })

  it('rejects anything that is not a real day', () => {
    expect(parseIsoDate('2026-02-30')).toBeNull()
    expect(parseIsoDate('5 March 2026')).toBeNull()
    expect(parseIsoDate('')).toBeNull()
    expect(parseIsoDate(null)).toBeNull()
  })
})

describe('parseFilters', () => {
  it('defaults to every sector and region, the whole year, weekday daytime', () => {
    expect(parse('')).toEqual({
      sector: null,
      region: null,
      from: bounds.min,
      to: bounds.max,
      cover: 'day',
    })
  })

  it('reads valid values', () => {
    expect(parse('sector=medical&region=Wales&from=2026-01-01&to=2026-03-31&cover=night')).toEqual({
      sector: 'medical',
      region: 'Wales',
      from: Date.UTC(2026, 0, 1),
      to: Date.UTC(2026, 2, 31),
      cover: 'night',
    })
  })

  it('falls back to defaults for anything unknown or invalid', () => {
    expect(parse('sector=mining&region=Mars&cover=dawn&from=yesterday')).toEqual(
      defaultFilters(bounds),
    )
  })

  it('keeps dates inside the data and in order', () => {
    expect(parse('from=2020-01-01&to=2030-01-01')).toMatchObject({
      from: bounds.min,
      to: bounds.max,
    })
    expect(parse('from=2026-05-01&to=2026-02-01')).toMatchObject({
      from: Date.UTC(2026, 1, 1),
      to: Date.UTC(2026, 4, 1),
    })
  })
})

describe('filtersToParams', () => {
  it('leaves defaults out of the URL', () => {
    expect(filtersToParams(defaultFilters(bounds), bounds).toString()).toBe('')
  })

  it('round-trips through parseFilters', () => {
    const filters: NetworkFilters = {
      sector: 'telecoms',
      region: 'North East',
      from: Date.UTC(2026, 3, 1),
      to: Date.UTC(2026, 5, 30),
      cover: 'weekend',
    }
    const query = filtersToParams(filters, bounds).toString()
    expect(query).toBe('sector=telecoms&region=North+East&from=2026-04-01&to=2026-06-30&cover=weekend')
    expect(parse(query)).toEqual(filters)
  })
})

describe('coverContextFor', () => {
  it('judges cover at the end of the range, but never after the data date', () => {
    const march = { ...defaultFilters(bounds), to: Date.UTC(2026, 2, 31) }
    expect(coverContextFor(march, ASOF).at).toBe(Date.UTC(2026, 3, 1) - MINUTE_MS)
    expect(coverContextFor(defaultFilters(bounds), ASOF).at).toBe(ASOF)
    expect(rangeUntil(march)).toBe(Date.UTC(2026, 2, 31) + DAY_MS)
  })

  it('takes the kind of hour from the cover mode', () => {
    const night = { ...defaultFilters(bounds), cover: 'night' as const }
    const weekend = { ...defaultFilters(bounds), cover: 'weekend' as const }
    expect(coverContextFor(night, ASOF)).toMatchObject({ overnight: true, weekend: false })
    expect(coverContextFor(weekend, ASOF)).toMatchObject({ overnight: false, weekend: true })
  })
})

describe('scopeNetwork', () => {
  const customers = [
    { id: 'CUS-001', sector: 'medical' },
    { id: 'CUS-002', sector: 'telecoms' },
  ] as Customer[]
  const sites = [
    { id: 'SITE-001', customerId: 'CUS-001', region: 'Wales' },
    { id: 'SITE-002', customerId: 'CUS-002', region: 'North East' },
  ] as Site[]
  const responders = [
    { id: 'RSP-001', region: 'Wales' },
    { id: 'RSP-002', region: 'Scotland' },
  ] as Responder[]
  const call = (id: string, siteId: string, customerId: string, day: number) =>
    ({ id, siteId, customerId, requestedAt: Date.UTC(2026, 4, day, 12) }) as CallOut
  const callOuts = [
    call('CO-1', 'SITE-001', 'CUS-001', 1),
    call('CO-2', 'SITE-002', 'CUS-002', 2),
    call('CO-3', 'SITE-001', 'CUS-001', 20),
    // A call-out for a site that has since been deleted
    call('CO-4', 'SITE-404', 'CUS-001', 3),
  ]
  const data = { customers, sites, responders, callOuts }
  const ids = (items: { id: string }[]) => items.map((i) => i.id)

  it('narrows sites, call-outs and responders together', () => {
    const scoped = scopeNetwork(
      {
        ...defaultFilters(bounds),
        sector: 'medical',
        region: 'Wales',
        from: Date.UTC(2026, 4, 1),
        to: Date.UTC(2026, 4, 10),
      },
      data,
    )
    expect(ids(scoped.sites)).toEqual(['SITE-001'])
    expect(ids(scoped.callOuts)).toEqual(['CO-1'])
    expect(scoped.callOuts[0]?.region).toBe('Wales')
    expect(ids(scoped.responders)).toEqual(['RSP-001'])
  })

  it('keeps call-outs for deleted sites unless a region is chosen', () => {
    const all = scopeNetwork(defaultFilters(bounds), data)
    expect(ids(all.callOuts)).toEqual(['CO-1', 'CO-2', 'CO-3', 'CO-4'])
    expect(all.callOuts[3]?.region).toBeNull()
    const wales = scopeNetwork({ ...defaultFilters(bounds), region: 'Wales' }, data)
    expect(ids(wales.callOuts)).toEqual(['CO-1', 'CO-3'])
  })

  it('includes the last day of the range', () => {
    const scoped = scopeNetwork(
      { ...defaultFilters(bounds), from: Date.UTC(2026, 4, 20), to: Date.UTC(2026, 4, 20) },
      data,
    )
    expect(ids(scoped.callOuts)).toEqual(['CO-3'])
  })
})
