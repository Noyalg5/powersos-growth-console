import { describe, expect, it } from 'vitest'
import { costTotal } from '@/lib/costs'
import { matchResponders } from '@/lib/matching'
import { buildSimulation, etaStatus } from '@/lib/scenario'
import { callOuts, customers, partners, responders, sites, suppliers } from './index'
import { getScenario, resolveScenario, SCENARIOS, type ScenarioSpec } from './scenarios'

const data = { customers, responders, suppliers, partners, callOuts }
const simulate = (spec: ScenarioSpec) => buildSimulation(resolveScenario(spec, data))

describe('simulator scenarios', () => {
  it('cover a hospital, a data centre overnight and a warehouse', () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(['hospital', 'data-centre', 'warehouse'])
    expect(() => getScenario('nope' as never)).toThrow('Unknown scenario')
  })

  it.each(SCENARIOS.map((s) => [s.title, s] as const))('%s plays through', (_title, spec) => {
    const sim = simulate(spec)
    expect(sim.input.site.id).toBe(spec.siteId)
    expect(sim.input.equipment.id).toBe(spec.equipmentId)
    expect(sim.responder.exclusions).toEqual([])
    expect(sim.orders).toHaveLength(spec.orders.length)
    expect(sim.total).toBe(costTotal(sim.cost))
    expect(sim.steps.at(-1)?.cost.committed).toBe(sim.total)
  })

  it('the hospital gets a hire generator', () => {
    const sim = simulate(getScenario('hospital'))
    expect(sim.input.site.name).toBe('Oxford Hospital')
    expect(sim.orders[0]?.request.purpose).toBe('hire')
    expect(sim.orders[0]?.item.description).toMatch(/kVA containerised generator$/)
    expect(sim.cost.generatorHire).toBeGreaterThan(0)
  })

  it('the 02:00 data centre trip excludes responders without overnight cover', () => {
    const sim = simulate(getScenario('data-centre'))
    expect(sim.match.overnight).toBe(true)
    expect(sim.outOfHours).toBe(true)
    const noCover = sim.match.excluded.filter((c) =>
      c.exclusions.some((e) => e.code === 'no-overnight-cover'),
    )
    expect(noCover.length).toBeGreaterThan(0)
    // The nearest responder sleeps at night, so the job goes further afield
    expect(noCover[0]?.etaMinutes).toBeLessThan(sim.responder.etaMinutes)
    expect(sim.match.ranked.every((c) => c.responder.availability.overnight)).toBe(true)
    // Ordering at 02:00 needs a supplier with an emergency line
    expect(sim.orders[0]?.supplier.emergencyLine).toBe(true)
  })

  it('the warehouse gets a new 1,250 kVA transformer, late, because nearer crews have lapsed', () => {
    const sim = simulate(getScenario('warehouse'))
    expect(sim.orders[0]?.item.description).toBe('1,250 kVA 11/0.433 kV ground-mounted transformer')
    expect(sim.input.equipment).toMatchObject({ kind: 'transformer', ratingKva: 1250 })
    expect(etaStatus(sim.responseMinutes)).toBe('past-target')
    const lapsed = sim.match.excluded.filter((c) =>
      c.exclusions.some((e) => e.factor === 'compliance'),
    )
    expect(lapsed.some((c) => c.etaMinutes < sim.responder.etaMinutes)).toBe(true)
  })

  it('throws when a scenario no longer fits the data', () => {
    const spec = getScenario('hospital')
    expect(() => resolveScenario({ ...spec, siteId: 'SITE-999' }, data)).toThrow('unknown site')
    expect(() => resolveScenario({ ...spec, equipmentKind: 'rmu' }, data)).toThrow('has no rmu')
    expect(() => resolveScenario({ ...spec, insurerId: 'PTN-003' }, data)).toThrow('expected insurer')
    expect(() => resolveScenario({ ...spec, facilitiesId: 'PTN-404' }, data)).toThrow(
      'unknown partner',
    )
  })
})

describe('matching across every site', () => {
  // Wednesday 02:00, Wednesday 11:00 and Saturday 11:00, London time
  const times = [
    Date.UTC(2026, 9, 14, 1, 0),
    Date.UTC(2026, 9, 14, 10, 0),
    Date.UTC(2026, 9, 17, 10, 0),
  ]

  it('never chooses a responder with lapsed or missing paperwork, or no cover at that hour', () => {
    let chosen = 0
    for (const site of sites) {
      for (const at of times) {
        const result = matchResponders(responders, site, at)
        for (const { responder } of result.ranked) {
          expect(responder.authorisationExpiry).not.toBeNull()
          expect(responder.authorisationExpiry ?? 0).toBeGreaterThan(at)
          expect(responder.insuranceExpiry).toBeGreaterThan(at)
          if (result.overnight) expect(responder.availability.overnight).toBe(true)
          if (result.weekend) expect(responder.availability.weekends).toBe(true)
        }
        if (result.chosen) chosen++
      }
    }
    // Most sites can be reached; the deliberate coverage gaps cannot
    expect(chosen).toBeGreaterThan(sites.length * times.length * 0.6)
  })

  it('excludes every responder with lapsed paperwork, even for a site on its doorstep', () => {
    const at = Date.UTC(2026, 9, 14, 10, 0)
    const lapsed = responders.filter(
      (r) => r.authorisationExpiry === null || r.authorisationExpiry <= at || r.insuranceExpiry <= at,
    )
    expect(lapsed.length).toBeGreaterThan(0)
    for (const r of lapsed) expect(matchResponders([r], r, at).chosen).toBeNull()
  })
})
