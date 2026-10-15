import { describe, expect, it } from 'vitest'
import { modelAssumptions, type AssumptionInputs } from './assumptions'
import { DEFAULT_AVERAGE_SPEED_MPH, DEFAULT_ROAD_FACTOR } from './geo'
import { PIPELINE_STAGES } from './pipeline'
import type { PricingInputs } from './pricing'
import { CRITERIA, DEFAULT_WEIGHTS } from './sectorScoring'

const pricing: PricingInputs = {
  tiers: [
    { id: 'essentials', name: 'Essentials', pricePerSite: 95, allowance: 1, customers: 10 },
    { id: 'unlimited', name: 'Unlimited', pricePerSite: 325, allowance: null, customers: 5 },
  ],
  payPerCallOut: 1_350,
  adHocCost: 1_480,
  materialsPerCallOut: 600,
  responderPayout: 0.85,
  supplierMargin: 0.1,
  sitesPerCustomer: 3.2,
  callOutsPerSite: 1.4,
  newCustomers: 2.5,
  monthlyChurn: 0.004,
}

const inputs: AssumptionInputs = {
  weights: DEFAULT_WEIGHTS,
  weightsEdited: false,
  pricing,
  asOf: Date.UTC(2026, 9, 14, 8, 0),
}

const text = (groups: ReturnType<typeof modelAssumptions>) =>
  groups.flatMap((g) => [g.title, ...g.items.map((i) => `${i.label}: ${i.value}`)]).join('\n')

describe('modelAssumptions', () => {
  const groups = modelAssumptions(inputs)
  const all = text(groups)

  it('states the drive-time model from the constants in use', () => {
    expect(all).toContain(`Road distance: ${DEFAULT_ROAD_FACTOR.toFixed(1)} × the straight-line distance`)
    expect(all).toContain(`Average speed: ${DEFAULT_AVERAGE_SPEED_MPH} mph`)
    expect(all).toContain('Traffic: Drive time × 0.85 overnight and × 1.25 in weekday rush hours (07:00–09:00 and 16:00–18:00)')
  })

  it('states the coverage rule', () => {
    expect(all).toContain(
      'Covered: 2 or more eligible responders within 75 minutes; thin with one, uncovered with none',
    )
  })

  it('lists every scoring weight, stage probability and pricing tier', () => {
    for (const c of CRITERIA) expect(all).toContain(`${c.label} ${DEFAULT_WEIGHTS[c.id]}`)
    for (const s of PIPELINE_STAGES) expect(all).toContain(`${s.label} ${Math.round(s.probability * 100)}%`)
    expect(all).toContain('Essentials £95 (1 call-out a year) · Unlimited £325 (unlimited call-outs)')
    expect(all).toContain('£1,350 a call-out, 85% of it to the responder')
  })

  it('shows saved sector weights when the viewer has edited them', () => {
    const edited = modelAssumptions({
      ...inputs,
      weights: { ...DEFAULT_WEIGHTS, downtime: 9 },
      weightsEdited: true,
    })
    const sectors = edited.find((g) => g.id === 'sectors')
    expect(sectors?.title).toMatch(/your saved edits/)
    expect(text(edited)).toContain('Cost of downtime 9')
  })

  it('says the data is synthetic and when it is as at', () => {
    expect(all).toMatch(/Every organisation, person, site, call-out and price is synthetic/)
    expect(all).toContain('14 Oct 2026, 09:00')
  })

  it('gives every group a unique id, a place it is used and at least one item', () => {
    expect(new Set(groups.map((g) => g.id)).size).toBe(groups.length)
    for (const g of groups) {
      expect(g.usedIn).not.toBe('')
      expect(g.items.length).toBeGreaterThan(0)
      for (const item of g.items) expect(item.value).not.toBe('')
    }
  })
})
