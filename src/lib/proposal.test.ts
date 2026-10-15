import { describe, expect, it } from 'vitest'
import type { Lead, LeadSite, Responder } from '@/types'
import { destinationPoint, reachKm } from './geo'
import { CHECKLISTS } from './onboarding'
import type { Tier } from './pricing'
import {
  annualMembership,
  buildProposal,
  compareDowntime,
  downtimeCostPerHour,
  LONG_ONBOARDING_SITES,
  nextSteps,
  onboardingPlan,
  recommendTier,
  type ProposalInput,
} from './proposal'
import { DAY_MS } from './time'

// Wednesday 14 Oct 2026, 09:00 London time
const AT = Date.UTC(2026, 9, 14, 8, 0)
const leeds = { lat: 53.8, lng: -1.55 }
const plymouth = { lat: 50.37, lng: -4.14 }

const TIERS: Tier[] = [
  { id: 'essentials', name: 'Essentials', pricePerSite: 95, allowance: 1, customers: 0 },
  { id: 'standard', name: 'Standard', pricePerSite: 265, allowance: 3, customers: 0 },
  { id: 'unlimited', name: 'Unlimited', pricePerSite: 325, allowance: null, customers: 0 },
]
const PAY_PER_CALL_OUT = 1_350

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    id,
    organisation: `Org ${id}`,
    sector: 'telecoms',
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    stage: 'proposal',
    estimatedSites: 2,
    source: 'inbound',
    partnerId: null,
    contact: { name: 'Test Person', role: 'Data centre director', phone: '07700 900000' },
    createdAt: AT - 100 * DAY_MS,
    lastContactAt: AT - 5 * DAY_MS,
    notes: '',
    ...overrides,
  }
}

function site(leadId: string, n: number, at = leeds): LeadSite {
  return {
    id: `${leadId}-S${n}`,
    leadId,
    name: `Site ${n} of ${leadId}`,
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    ...at,
    criticality: 4,
  }
}

/** A compliant responder `km` east of Leeds, with or without overnight cover. */
function responder(id: string, km: number, overnight = true): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    ...destinationPoint(leeds, 90, km),
    engineers: 6,
    authorisationLevel: 'authorised-person',
    maxVoltageKv: 11,
    authorisationExpiry: AT + 400 * DAY_MS,
    insuranceExpiry: AT + 300 * DAY_MS,
    lastAuditAt: AT - 100 * DAY_MS,
    rating: 4.5,
    availability: { weekends: true, overnight, onCallEngineers: 2 },
    rates: { callOutFee: 300, hourlyRate: 100, outOfHoursMultiplier: 1.5 },
    joinedAt: AT - 500 * DAY_MS,
    contact: { name: 'Test Person', role: 'Operations director', phone: '07700 900001' },
  }
}

describe('recommendTier', () => {
  it('picks the tier that costs least per site at the call-out rate', () => {
    // Essentials 12 × 95 = 1,140; Standard 3,180; Unlimited 3,900
    expect(recommendTier(TIERS, 1, PAY_PER_CALL_OUT).tier.id).toBe('essentials')
    // Essentials 1,140 + 2 × 1,350 = 3,840 against Standard's 3,180
    expect(recommendTier(TIERS, 3, PAY_PER_CALL_OUT).tier.id).toBe('standard')
    // Standard 3,180 + 2 × 1,350 = 5,880 against Unlimited's 3,900
    expect(recommendTier(TIERS, 5, PAY_PER_CALL_OUT).tier.id).toBe('unlimited')
  })

  it('lists every tier, cheapest first, and explains the choice', () => {
    const rec = recommendTier(TIERS, 3, PAY_PER_CALL_OUT)
    expect(rec.costs.map((c) => [c.tier.id, c.perSite])).toEqual([
      ['standard', 3_180],
      ['essentials', 3_840],
      ['unlimited', 3_900],
    ])
    expect(rec.perSite).toBe(3_180)
    expect(rec.reason).toBe(
      'At 3 call-outs per site a year, Standard costs the least: £3,180 per site a year, £660 less than Essentials. It includes 3 call-outs per site a year; any more cost £1,350 each.',
    )
  })

  it('prefers more cover when two tiers cost the same', () => {
    const tied: Tier[] = [
      { ...TIERS[0], pricePerSite: 325, allowance: 5 } as Tier,
      TIERS[2] as Tier,
    ]
    const rec = recommendTier(tied, 1, PAY_PER_CALL_OUT)
    expect(rec.tier.id).toBe('unlimited')
    expect(rec.reason).toContain('both cost £3,900')
    expect(rec.reason).toContain('Call-outs are unlimited.')
  })

  it('works with a single tier and rejects none or invalid input', () => {
    expect(recommendTier([TIERS[1] as Tier], 0, PAY_PER_CALL_OUT).reason).toBe(
      'At 0 call-outs per site a year, Standard costs £3,180 per site a year. It includes 3 call-outs per site a year; any more cost £1,350 each.',
    )
    expect(() => recommendTier([], 1, PAY_PER_CALL_OUT)).toThrow(RangeError)
    expect(() => recommendTier(TIERS, -1, PAY_PER_CALL_OUT)).toThrow(RangeError)
  })

  it('values a year of membership by the number of sites', () => {
    const rec = recommendTier(TIERS, 3, PAY_PER_CALL_OUT)
    expect(annualMembership(rec, 4)).toBe(12_720)
    expect(annualMembership(rec, 0)).toBe(0)
    expect(() => annualMembership(rec, 1.5)).toThrow(RangeError)
  })
})

describe('cost of downtime', () => {
  it('reads an hourly cost from the sector score', () => {
    expect(downtimeCostPerHour(1)).toBe(500)
    expect(downtimeCostPerHour(5)).toBe(40_000)
    for (const bad of [0, 6, 2.5, Number.NaN]) {
      expect(() => downtimeCostPerHour(bad)).toThrow(RangeError)
    }
  })

  it('puts a year of membership in hours without power', () => {
    const comparison = compareDowntime(4, 30_000, 8)
    expect(comparison.perHour).toBe(15_000)
    expect(comparison.breakEvenMinutes).toBe(120)
    expect(comparison.sentence).toBe(
      "A year's membership for all 8 sites, £30,000, costs the same as 2 h without power at one site at £15,000 an hour.",
    )
    expect(compareDowntime(5, 10_000, 1).sentence).toMatch(/^A year's membership for your site,/)
    expect(() => compareDowntime(3, -1, 1)).toThrow(RangeError)
  })
})

describe('onboardingPlan', () => {
  it('follows the customer checklist from Onboarding & compliance', () => {
    const plan = onboardingPlan(3)
    expect(plan.map((s) => s.label)).toEqual(CHECKLISTS.customer.map((i) => i.label))
    expect(plan.at(-1)?.when).toBe('Week 3')
  })

  it('allows an extra week for larger estates', () => {
    expect(onboardingPlan(LONG_ONBOARDING_SITES).at(-1)?.when).toBe('Week 3')
    expect(onboardingPlan(LONG_ONBOARDING_SITES + 1).at(-1)?.when).toBe('Week 4')
  })
})

describe('buildProposal', () => {
  const ours = lead('LEAD-001')
  const theirs = lead('LEAD-002')
  const sites = [
    site('LEAD-001', 1),
    site('LEAD-002', 1),
    site('LEAD-001', 2, plymouth),
    site('LEAD-002', 2),
  ]
  const responders = [
    responder('R1', 5),
    responder('R2', 10, false),
    responder('R3', reachKm() + 50),
  ]
  const input: ProposalInput = {
    lead: ours,
    stage: 'proposal',
    sites,
    responders,
    asOf: AT,
    recommendation: recommendTier(TIERS, 3, PAY_PER_CALL_OUT),
    downtimeScore: 5,
  }

  it("uses only the lead's own sites", () => {
    const proposal = buildProposal(input)
    expect(proposal.sites.map((s) => s.site.id)).toEqual(['LEAD-001-S1', 'LEAD-001-S2'])
    expect(proposal.sites.every((s) => s.site.leadId === 'LEAD-001')).toBe(true)
    expect(proposal.coverage.sites).toBe(2)
    expect(proposal.annualCost).toBe(2 * 3_180)

    const other = buildProposal({ ...input, lead: theirs })
    expect(other.sites.map((s) => s.site.id)).toEqual(['LEAD-002-S1', 'LEAD-002-S2'])
  })

  it('counts eligible responders within reach by day and overnight, with the best ETA', () => {
    const [near, far] = buildProposal(input).sites
    expect(near).toMatchObject({
      number: 1,
      inReach: 2,
      inReachOvernight: 1,
      status: 'covered',
      overnightStatus: 'thin',
    })
    expect(near?.bestMinutes).toBeGreaterThan(0)
    expect(far).toMatchObject({ number: 2, inReach: 0, status: 'uncovered' })
    expect(far?.bestMinutes).toBeGreaterThan(75)
  })

  it('lists the responders in reach of any site once each', () => {
    expect(buildProposal(input).responders.map((r) => r.id).sort()).toEqual(['R1', 'R2'])
  })

  it('has no best ETA when no responder is eligible', () => {
    const proposal = buildProposal({ ...input, responders: [] })
    expect(proposal.sites.every((s) => s.bestMinutes === null && s.status === 'uncovered')).toBe(
      true,
    )
  })

  it('prices downtime from the sector score and plans onboarding for the site count', () => {
    const proposal = buildProposal(input)
    expect(proposal.downtime.perHour).toBe(40_000)
    expect(proposal.downtime.membership).toBe(proposal.annualCost)
    expect(proposal.plan).toHaveLength(CHECKLISTS.customer.length)
  })

  it('names the sites short of cover in the next steps', () => {
    const steps = buildProposal(input).nextSteps
    expect(steps[0]).toBe('Review this proposal with your estates and finance leads.')
    expect(steps).toContain(
      'Agree cover for Site 2 of LEAD-001: 1 of 2 sites has fewer than two eligible responders within 75 minutes today.',
    )
  })

  it('throws for a lead with no sites on record', () => {
    expect(() => buildProposal({ ...input, lead: lead('LEAD-999') })).toThrow(RangeError)
  })
})

describe('nextSteps', () => {
  it('opens with a step for the stage and lists at most two gap sites by name', () => {
    const gap = (n: number) => ({
      site: site('L', n),
      number: n,
      inReach: 0,
      inReachOvernight: 0,
      bestMinutes: null,
      status: 'uncovered' as const,
      overnightStatus: 'uncovered' as const,
    })
    const steps = nextSteps('discovery', [gap(1), gap(2), gap(3), gap(4)])
    expect(steps[0]).toMatch(/^Book a 30-minute demo/)
    expect(steps[2]).toBe(
      'Agree cover for Site 1 of L, Site 2 of L and 2 more: 4 of 4 sites have fewer than two eligible responders within 75 minutes today.',
    )
    expect(nextSteps('live', [])).toHaveLength(3)
  })
})
