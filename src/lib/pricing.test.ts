import { describe, expect, it } from 'vitest'
import {
  breakEvenCallOuts,
  breakEvenSentence,
  DEFAULT_ASSUMPTIONS,
  defaultPricingInputs,
  MAX_TIERS,
  memberCostPerSite,
  nextTier,
  priceModel,
  projectGrowth,
  restorePricingInputs,
  type PricingInputs,
  type Tier,
} from './pricing'

const tier = (overrides: Partial<Tier> = {}): Tier => ({
  id: 'standard',
  name: 'Standard',
  pricePerSite: 100,
  allowance: 1,
  customers: 10,
  ...overrides,
})

/** One tier of 10 customers with 2 sites each, calling out 3 times a site a year. */
const INPUTS: PricingInputs = {
  tiers: [tier()],
  payPerCallOut: 1_000,
  adHocCost: 1_500,
  materialsPerCallOut: 600,
  responderPayout: 0.8,
  supplierMargin: 0.1,
  sitesPerCustomer: 2,
  callOutsPerSite: 3,
  newCustomers: 0,
  monthlyChurn: 0,
}

describe('memberCostPerSite', () => {
  it('adds call-outs beyond the allowance to twelve monthly fees', () => {
    // 12 × £100 + (3 − 1) × £1,000
    expect(memberCostPerSite(tier(), 3, 1_000)).toBe(3_200)
    expect(memberCostPerSite(tier(), 0.5, 1_000)).toBe(1_200)
    expect(memberCostPerSite(tier({ allowance: null }), 40, 1_000)).toBe(1_200)
  })

  it('rejects negative call-outs or prices', () => {
    expect(() => memberCostPerSite(tier(), -1, 1_000)).toThrow(RangeError)
    expect(() => memberCostPerSite(tier({ pricePerSite: -5 }), 1, 1_000)).toThrow(RangeError)
  })
})

describe('breakEvenCallOuts', () => {
  it('matches the hand-worked example within the allowance', () => {
    // £100 a month is £1,200 a year; at £1,500 a call-out ad hoc, 0.8 call-outs cost the same
    expect(breakEvenCallOuts(tier(), 1_000, 1_500)).toBeCloseTo(0.8, 12)
  })

  it('matches the hand-worked example beyond the allowance', () => {
    // £300 a month is £3,600 a year. One call-out ad hoc costs £1,500, so the allowance
    // alone does not pay. Each extra call-out then saves £1,500 − £1,000 = £500:
    // (3,600 − 1 × 1,000) ÷ 500 = 5.2
    const premium = tier({ pricePerSite: 300 })
    const n = breakEvenCallOuts(premium, 1_000, 1_500) ?? Number.NaN
    expect(n).toBeCloseTo(5.2, 12)
    // Check: 5.2 call-outs cost the same either way
    expect(memberCostPerSite(premium, n, 1_000)).toBeCloseTo(n * 1_500, 9)
  })

  it('uses the fee alone for unlimited call-outs', () => {
    expect(breakEvenCallOuts(tier({ allowance: null, pricePerSite: 250 }), 1_000, 1_500)).toBe(2)
  })

  it('never breaks even when charged call-outs cost as much as ad hoc', () => {
    expect(breakEvenCallOuts(tier({ pricePerSite: 300 }), 1_500, 1_500)).toBeNull()
    expect(breakEvenCallOuts(tier({ pricePerSite: 300 }), 2_000, 1_500)).toBeNull()
    expect(breakEvenCallOuts(tier(), 1_000, 0)).toBeNull()
  })

  it('breaks even at once when membership is free', () => {
    expect(breakEvenCallOuts(tier({ pricePerSite: 0 }), 1_000, 1_500)).toBe(0)
  })

  it('rejects invalid prices', () => {
    expect(() => breakEvenCallOuts(tier(), -1, 1_500)).toThrow(RangeError)
    expect(() => breakEvenCallOuts(tier(), 1_000, Number.NaN)).toThrow(RangeError)
    expect(() => breakEvenCallOuts(tier({ allowance: -1 }), 1_000, 1_500)).toThrow(RangeError)
  })
})

describe('priceModel', () => {
  const model = priceModel(INPUTS)
  const [standard] = model.tiers

  it('works a month through by hand', () => {
    // 20 sites at £100, calling out 3 times a year each: 5 call-outs a month,
    // 20 × (3 − 1) ÷ 12 = 3⅓ of them charged at £1,000
    expect(standard).toMatchObject({ sites: 20, membership: 2_000, callOuts: 5 })
    expect(standard?.charged).toBeCloseTo(10 / 3, 12)
    expect(standard?.callOutCharges).toBeCloseTo(3_333.33, 2)
    // 5 call-outs × £600 of parts and hire × 10%
    expect(standard?.supplierIncome).toBeCloseTo(300, 9)
    // 5 call-outs × £1,000 × 80%
    expect(standard?.responderEarnings).toBeCloseTo(4_000, 9)
    expect(model.mrr).toBe(2_000)
    expect(model.revenue).toBeCloseTo(5_633.33, 2)
    expect(model.take).toBeCloseTo(1_633.33, 2)
    expect(model.payoutPerCallOut).toBe(800)
  })

  it("compares a member's year with paying ad hoc", () => {
    // £3,200 as a member against 3 × £1,500 ad hoc
    expect(standard).toMatchObject({ memberCost: 3_200, adHocCost: 4_500, saving: 1_300 })
    expect(standard?.breakEven).toBeCloseTo(0.8, 12)
  })

  it('adds the tiers together', () => {
    const two = priceModel({
      ...INPUTS,
      tiers: [tier(), tier({ id: 'unlimited', allowance: null, pricePerSite: 300, customers: 5 })],
    })
    expect(two.customers).toBe(15)
    expect(two.sites).toBe(30)
    // 20 × £100 + 10 × £300
    expect(two.mrr).toBe(5_000)
    expect(two.callOuts).toBeCloseTo(7.5, 12)
    expect(two.take).toBeCloseTo((two.tiers[0]?.take ?? 0) + (two.tiers[1]?.take ?? 0), 9)
  })

  it('makes no revenue with no customers', () => {
    const empty = priceModel({ ...INPUTS, tiers: [tier({ customers: 0 })] })
    expect(empty).toMatchObject({
      customers: 0,
      sites: 0,
      mrr: 0,
      revenue: 0,
      responderEarnings: 0,
      take: 0,
    })
    expect(priceModel({ ...INPUTS, sitesPerCustomer: 0 }).revenue).toBe(0)
  })

  it('loses money when included call-outs cost more to pay out than the fee brings in', () => {
    const cheap = priceModel({
      ...INPUTS,
      tiers: [tier({ allowance: null, pricePerSite: 50 })],
    })
    // £50 a site against 0.25 call-outs a month × £800 paid out, plus £15 of supplier margin
    expect(cheap.take).toBeCloseTo(20 * (50 + 15 - 200), 9)
    expect(cheap.take).toBeLessThan(0)
  })

  it('rejects invalid inputs', () => {
    expect(() => priceModel({ ...INPUTS, tiers: [] })).toThrow(RangeError)
    expect(() => priceModel({ ...INPUTS, tiers: [tier(), tier(), tier(), tier()] })).toThrow(
      RangeError,
    )
    expect(() => priceModel({ ...INPUTS, monthlyChurn: 1.5 })).toThrow(RangeError)
    expect(() => priceModel({ ...INPUTS, responderPayout: -0.1 })).toThrow(RangeError)
    expect(() => priceModel({ ...INPUTS, callOutsPerSite: Number.NaN })).toThrow(RangeError)
    expect(() => priceModel({ ...INPUTS, tiers: [tier({ customers: -1 })] })).toThrow(RangeError)
  })
})

describe('breakEvenSentence', () => {
  const three = {
    ...INPUTS,
    tiers: [
      tier({ id: 'a', name: 'Essentials', pricePerSite: 95, allowance: 1 }),
      tier({ id: 'b', name: 'Standard', pricePerSite: 265, allowance: 3 }),
      tier({ id: 'c', name: 'Unlimited', pricePerSite: 400, allowance: null }),
    ],
  }

  it('names the tiers that save money and when the rest start to', () => {
    // Ad hoc: 3 × £1,500 = £4,500. Essentials £1,140 + 2 × £1,000; Standard £3,180;
    // Unlimited £4,800, which pays for itself from £4,800 ÷ £1,500 = 3.2 call-outs
    expect(breakEvenSentence(priceModel(three), 3)).toBe(
      'At 3 call-outs per site a year, Essentials and Standard cost a member less than paying ad hoc; Unlimited costs £300 more per site a year and pays for itself only from 3.2 call-outs.',
    )
  })

  it('says when no tier saves money, and which comes closest', () => {
    const dear = {
      ...three,
      tiers: [tier({ name: 'Premium', pricePerSite: 300 })],
      callOutsPerSite: 1,
    }
    // £3,600 a year against £1,500 ad hoc; beyond the allowance each call-out saves £500
    expect(breakEvenSentence(priceModel(dear), 1)).toBe(
      'At 1 call-out per site a year, no tier costs a member less than paying ad hoc: Premium comes closest at £2,100 more per site a year, and pays for itself only from 5.2 call-outs.',
    )
    const never = { ...dear, payPerCallOut: 1_500 }
    expect(breakEvenSentence(priceModel(never), 1)).toMatch(
      /and never pays for itself, because a charged call-out costs as much as one ad hoc\.$/,
    )
  })

  it('handles a tier that costs exactly the same', () => {
    const even = { ...INPUTS, tiers: [tier({ allowance: null, pricePerSite: 375 })] }
    expect(breakEvenSentence(priceModel(even), 3)).toBe(
      'At 3 call-outs per site a year, every tier costs the same as paying ad hoc.',
    )
  })
})

describe('projectGrowth', () => {
  it('runs from today for 24 months', () => {
    const points = projectGrowth(INPUTS)
    expect(points).toHaveLength(25)
    expect(points[0]).toMatchObject({ month: 0, customers: 10, mrr: 2_000 })
    expect(points[0]?.revenue).toBeCloseTo(priceModel(INPUTS).revenue, 9)
  })

  it('reduces customers month on month with churn and no new customers', () => {
    const points = projectGrowth({ ...INPUTS, monthlyChurn: 0.05 })
    for (let m = 1; m < points.length; m++) {
      expect(points[m]?.customers).toBeLessThan(points[m - 1]?.customers ?? 0)
      expect(points[m]?.revenue).toBeLessThan(points[m - 1]?.revenue ?? 0)
    }
    expect(points[12]?.customers).toBeCloseTo(10 * 0.95 ** 12, 9)
  })

  it('adds new customers each month after churn', () => {
    const points = projectGrowth({ ...INPUTS, monthlyChurn: 0.1, newCustomers: 2 }, 2)
    // 10 × 0.9 + 2 = 11, then 11 × 0.9 + 2 = 11.9
    expect(points.map((p) => p.customers)).toEqual([10, 11, expect.closeTo(11.9, 12)])
  })

  it('makes no revenue with no customers and none joining', () => {
    const points = projectGrowth({ ...INPUTS, tiers: [tier({ customers: 0 })] })
    expect(points.every((p) => p.customers === 0 && p.revenue === 0 && p.take === 0)).toBe(true)
  })

  it("brings new customers in on today's mix, or evenly when there are none", () => {
    const mixed = {
      ...INPUTS,
      newCustomers: 4,
      tiers: [tier({ customers: 30 }), tier({ id: 'b', customers: 10, pricePerSite: 200 })],
    }
    const [, next] = projectGrowth(mixed, 1)
    // 3 joiners at £100 × 2 sites and 1 at £200 × 2 sites
    expect(next?.mrr).toBeCloseTo(6_000 + 4_000 + 3 * 200 + 1 * 400, 9)

    const fresh = { ...mixed, tiers: mixed.tiers.map((t) => ({ ...t, customers: 0 })) }
    const [, first] = projectGrowth(fresh, 1)
    // 2 joiners on each tier
    expect(first?.mrr).toBeCloseTo(2 * 200 + 2 * 400, 9)
  })

  it('rejects a negative or fractional number of months', () => {
    expect(() => projectGrowth(INPUTS, -1)).toThrow(RangeError)
    expect(() => projectGrowth(INPUTS, 2.5)).toThrow(RangeError)
    expect(projectGrowth(INPUTS, 0)).toHaveLength(1)
  })
})

describe('defaultPricingInputs', () => {
  const defaults = defaultPricingInputs({
    liveCustomers: 51,
    sitesPerCustomer: 3.2333,
    callOutsPerSite: 2.6429,
    responseCost: 1_400.77,
    materialsCost: 2_001.26,
    newCustomers: 2.5,
    monthlyChurn: 0.011392,
  })

  it('reads what it can from the evidence, rounded to the step each input moves in', () => {
    expect(defaults).toMatchObject({
      adHocCost: 1_401,
      materialsPerCallOut: 2_001,
      sitesPerCustomer: 3.2,
      callOutsPerSite: 2.6,
      newCustomers: 2.5,
      monthlyChurn: 0.011,
      ...DEFAULT_ASSUMPTIONS,
    })
  })

  it("splits today's customers across the tiers in whole numbers", () => {
    expect(defaults.tiers.map((t) => t.customers)).toEqual([21, 20, 10])
  })

  it('makes a valid model', () => {
    expect(() => priceModel(defaults)).not.toThrow()
  })
})

describe('nextTier', () => {
  it('copies the last tier with nobody on it and a fresh ID', () => {
    const added = nextTier([tier({ id: 'tier-2' })])
    expect(added).toEqual({
      id: 'tier-3',
      name: 'Tier 2',
      pricePerSite: 100,
      allowance: 1,
      customers: 0,
    })
  })

  it('stops at three tiers', () => {
    const three = Array.from({ length: MAX_TIERS }, (_, i) => tier({ id: `t${i}` }))
    expect(nextTier(three)).toBeNull()
  })
})

describe('restorePricingInputs', () => {
  it('returns the defaults for anything that is not a saved object', () => {
    for (const raw of [null, 'x', 1, []]) expect(restorePricingInputs(raw, INPUTS)).toBe(INPUTS)
  })

  it('keeps valid values and replaces the rest with defaults', () => {
    const restored = restorePricingInputs(
      { payPerCallOut: 900, monthlyChurn: 2, responderPayout: '0.9', adHocCost: -5 },
      INPUTS,
    )
    expect(restored).toEqual({ ...INPUTS, payPerCallOut: 900 })
  })

  it('restores tiers, including unlimited allowances', () => {
    const restored = restorePricingInputs(
      {
        tiers: [
          { id: 'standard', name: 'Core', pricePerSite: 120, allowance: null, customers: 4 },
          { id: 'tier-2', name: '', pricePerSite: -1, allowance: 2, customers: 3 },
        ],
      },
      INPUTS,
    )
    expect(restored.tiers).toEqual([
      { id: 'standard', name: 'Core', pricePerSite: 120, allowance: null, customers: 4 },
      { id: 'tier-2', name: 'Tier 2', pricePerSite: 0, allowance: 2, customers: 3 },
    ])
  })

  it('falls back to the default tiers when the saved ones are unusable', () => {
    expect(restorePricingInputs({ tiers: [] }, INPUTS).tiers).toBe(INPUTS.tiers)
    expect(restorePricingInputs({ tiers: [{ name: 'No ID' }] }, INPUTS).tiers).toBe(INPUTS.tiers)
    const twins = [tier(), tier()]
    expect(restorePricingInputs({ tiers: twins }, INPUTS).tiers).toBe(INPUTS.tiers)
  })

  it('keeps at most three tiers', () => {
    const many = Array.from({ length: 5 }, (_, i) => tier({ id: `t${i}` }))
    expect(restorePricingInputs({ tiers: many }, INPUTS).tiers).toHaveLength(MAX_TIERS)
  })

  it('round-trips through JSON', () => {
    const edited = { ...INPUTS, tiers: [tier({ allowance: null })], supplierMargin: 0.15 }
    const raw: unknown = JSON.parse(JSON.stringify(edited))
    expect(restorePricingInputs(raw, INPUTS)).toEqual(edited)
  })
})
