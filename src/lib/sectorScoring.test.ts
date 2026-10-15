import { describe, expect, it } from 'vitest'
import type { CallOut, Customer, SectorId } from '@/types'
import { YEAR_MS } from './demand'
import {
  CRITERIA,
  DEFAULT_SCORES,
  DEFAULT_SECTOR_INPUTS,
  DEFAULT_WEIGHTS,
  effectiveScore,
  formatScore,
  goFirst,
  hasWeight,
  normaliseWeights,
  quadrantOf,
  rankSectors,
  restoreSectorInputs,
  sectorEvidence,
  sensitivity,
  type CriterionId,
  type SectorInfo,
  type SectorScores,
  type Weights,
} from './sectorScoring'

const NINE: SectorInfo[] = [
  { id: 'medical', label: 'Medical' },
  { id: 'education', label: 'Education' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'manufacturing', label: 'Manufacturing' },
  { id: 'aviation', label: 'Aviation' },
  { id: 'warehousing', label: 'Warehousing' },
  { id: 'agriculture', label: 'Agriculture' },
  { id: 'power', label: 'Power generation & distribution' },
  { id: 'telecoms', label: 'Telecoms & data centres' },
]

const NONE: Weights = {
  downtime: 0,
  'hv-prevalence': 0,
  regulation: 0,
  'decision-speed': 0,
  'partner-access': 0,
  'in-house': 0,
}

/** Only these weights count; every other criterion weighs nothing. */
const only = (weights: Partial<Weights>): Weights => ({ ...NONE, ...weights })

/** Default scores with some sectors' downtime and decision speed replaced. */
function scoresWith(rows: Partial<Record<SectorId, [downtime: number, speed: number]>>) {
  const scores: SectorScores = structuredClone(DEFAULT_SCORES)
  for (const [sector, [downtime, speed]] of Object.entries(rows) as [
    SectorId,
    [number, number],
  ][]) {
    scores[sector] = { ...scores[sector], downtime, 'decision-speed': speed }
  }
  return scores
}

const ids = (results: { sector: SectorId }[]) => results.map((r) => r.sector)

describe('normaliseWeights', () => {
  it('scales the weights to add up to 1, keeping their proportions', () => {
    const normalised = normaliseWeights(DEFAULT_WEIGHTS)
    const total = CRITERIA.reduce((sum, c) => sum + normalised[c.id], 0)
    expect(total).toBeCloseTo(1, 12)
    // 5 of a total of 20
    expect(normalised.downtime).toBeCloseTo(0.25, 12)
    expect(normalised['in-house']).toBeCloseTo(0.1, 12)
  })

  it('gives the same result for weights at any scale', () => {
    const tripled = Object.fromEntries(
      CRITERIA.map((c) => [c.id, DEFAULT_WEIGHTS[c.id] * 3]),
    ) as Weights
    expect(normaliseWeights(tripled)).toEqual(normaliseWeights(DEFAULT_WEIGHTS))
  })

  it('lets a single weight carry everything', () => {
    expect(normaliseWeights(only({ regulation: 2 }))).toEqual(only({ regulation: 1 }))
  })

  it('rejects negative, non-finite and all-zero weights', () => {
    expect(() => normaliseWeights({ ...DEFAULT_WEIGHTS, downtime: -1 })).toThrow(RangeError)
    expect(() => normaliseWeights({ ...DEFAULT_WEIGHTS, regulation: Number.NaN })).toThrow(
      RangeError,
    )
    expect(() => normaliseWeights(NONE)).toThrow(/above zero/)
  })
})

describe('hasWeight', () => {
  it('is true while any criterion has weight', () => {
    expect(hasWeight(DEFAULT_WEIGHTS)).toBe(true)
    expect(hasWeight(only({ 'in-house': 0.5 }))).toBe(true)
    expect(hasWeight(NONE)).toBe(false)
  })
})

describe('effectiveScore', () => {
  it('counts most criteria as scored and inverts competition from in-house teams', () => {
    expect(effectiveScore('downtime', 4)).toBe(4)
    expect(effectiveScore('in-house', 5)).toBe(1)
    expect(effectiveScore('in-house', 1)).toBe(5)
    expect(effectiveScore('in-house', 3)).toBe(3)
  })

  it('rejects scores outside 1–5 or between whole numbers', () => {
    expect(() => effectiveScore('downtime', 0)).toThrow(RangeError)
    expect(() => effectiveScore('downtime', 6)).toThrow(RangeError)
    expect(() => effectiveScore('downtime', 2.5)).toThrow(RangeError)
  })
})

describe('quadrantOf', () => {
  it('counts the midpoint as high on either axis', () => {
    expect(quadrantOf(3, 3)).toBe('prioritise')
    expect(quadrantOf(4.5, 2.9)).toBe('build-access')
    expect(quadrantOf(2.9, 4)).toBe('opportunistic')
    expect(quadrantOf(1, 1)).toBe('deprioritise')
  })
})

describe('rankSectors', () => {
  const ranked = rankSectors(NINE, DEFAULT_SCORES, DEFAULT_WEIGHTS)

  it('ranks every sector best first, with ranks from 1', () => {
    expect(ranked).toHaveLength(9)
    expect(ranked.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (const [a, b] of ranked.slice(1).map((r, i) => [ranked[i], r] as const)) {
      expect(a?.score ?? 0).toBeGreaterThanOrEqual(b.score)
    }
  })

  it('puts telecoms and data centres first on the default assumptions', () => {
    expect(ids(ranked).slice(0, 3)).toEqual(['telecoms', 'power', 'medical'])
    // 5×.25 + 5×.2 + 4×.15 + 4×.15 + 4×.15 + (6 − 3)×.1
    expect(ranked[0]?.score).toBeCloseTo(4.35, 12)
  })

  it('scores on a 1–5 scale whatever the weights add up to', () => {
    const tripled = Object.fromEntries(
      CRITERIA.map((c) => [c.id, DEFAULT_WEIGHTS[c.id] * 3]),
    ) as Weights
    const again = rankSectors(NINE, DEFAULT_SCORES, tripled)
    expect(ids(again)).toEqual(ids(ranked))
    again.forEach((r, i) => expect(r.score).toBeCloseTo(ranked[i]?.score ?? 0, 12))
  })

  it('changes the ranking when the weights change', () => {
    // All weight on regulation: medical and aviation score 5
    expect(ids(rankSectors(NINE, DEFAULT_SCORES, only({ regulation: 1 }))).slice(0, 2)).toEqual([
      'medical',
      'aviation',
    ])
    // All weight on in-house competition: the sectors with fewest HV staff win
    const byCompetition = rankSectors(NINE, DEFAULT_SCORES, only({ 'in-house': 1 }))
    expect(ids(byCompetition).slice(0, 2)).toEqual(['hospitality', 'agriculture'])
    expect(byCompetition[0]?.score).toBe(5)
  })

  it('splits each sector into market attractiveness and ability to win', () => {
    const telecoms = ranked.find((r) => r.sector === 'telecoms')
    // (5×5 + 4×5 + 3×4) ÷ 12 and (3×4 + 3×4 + 2×3) ÷ 8
    expect(telecoms?.attractiveness).toBeCloseTo(57 / 12, 12)
    expect(telecoms?.ability).toBeCloseTo(30 / 8, 12)
    expect(telecoms?.quadrant).toBe('prioritise')
    expect(ranked.find((r) => r.sector === 'medical')?.quadrant).toBe('build-access')
  })

  it('has contributions that add up to the score', () => {
    for (const r of ranked) {
      const total = CRITERIA.reduce((sum, c) => sum + r.contributions[c.id], 0)
      expect(total).toBeCloseTo(r.score, 12)
    }
  })

  it('leaves an axis unplaced when all its weight is zero', () => {
    const [first] = rankSectors(NINE, DEFAULT_SCORES, only({ downtime: 1 }))
    expect(first?.attractiveness).toBe(5)
    expect(first?.ability).toBeNull()
    expect(first?.quadrant).toBeNull()
  })

  it('breaks ties on attractiveness, then on the order given', () => {
    // Equal on score: 4 and 2 against 2 and 4, with equal weights
    const scores = scoresWith({ medical: [2, 4], education: [4, 2], hospitality: [4, 2] })
    const three = NINE.slice(0, 3)
    const tied = rankSectors(three, scores, only({ downtime: 1, 'decision-speed': 1 }))
    expect(tied.map((r) => r.score)).toEqual([3, 3, 3])
    expect(ids(tied)).toEqual(['education', 'hospitality', 'medical'])
  })

  it('rejects all-zero weights and invalid scores', () => {
    expect(() => rankSectors(NINE, DEFAULT_SCORES, NONE)).toThrow(RangeError)
    const broken = scoresWith({ medical: [7, 3] })
    expect(() => rankSectors(NINE, broken, DEFAULT_WEIGHTS)).toThrow(RangeError)
  })

  it('copes with no sectors', () => {
    expect(rankSectors([], DEFAULT_SCORES, DEFAULT_WEIGHTS)).toEqual([])
  })
})

describe('formatScore', () => {
  it('rounds to one decimal place', () => {
    expect(formatScore(4.35)).toBe('4.4')
    expect(formatScore(4)).toBe('4.0')
    expect(formatScore(3.04)).toBe('3.0')
  })
})

describe('sectorEvidence', () => {
  const FROM = Date.UTC(2025, 9, 14)
  const site = (id: string, customerId: string, criticality: 1 | 2 | 3 | 4 | 5) => ({
    id,
    customerId,
    name: id,
    town: 'Leeds',
    region: 'Yorkshire and the Humber' as const,
    lat: 53.8,
    lng: -1.55,
    postcodeArea: 'LS',
    criticality,
    equipment: [],
    contacts: [],
  })
  const customers: Customer[] = [
    {
      id: 'CUS-1',
      name: 'One',
      sector: 'medical',
      headOffice: 'Leeds',
      joinedAt: FROM - YEAR_MS,
      sites: [site('S1', 'CUS-1', 5), site('S2', 'CUS-1', 4)],
    },
    {
      id: 'CUS-2',
      name: 'Two',
      sector: 'education',
      headOffice: 'Leeds',
      joinedAt: FROM - YEAR_MS,
      sites: [site('S3', 'CUS-2', 2)],
    },
  ]
  const callOut = (siteId: string): CallOut => ({
    id: `CO-${siteId}`,
    siteId,
    customerId: 'CUS-1',
    responderId: 'RSP-1',
    faultType: 'cable',
    requestedAt: FROM + 1000,
    acceptedAt: FROM + 1000,
    arrivedAt: FROM + 1000,
    resolvedAt: FROM + 1000,
    distanceMiles: 5,
    cost: { callOutFee: 1, labour: 1, parts: 1, generatorHire: 1 },
    rating: 5,
  })
  const evidence = sectorEvidence(
    NINE.slice(0, 3),
    customers,
    [callOut('S1'), callOut('S1'), callOut('S2'), callOut('S3')],
    { from: FROM, to: FROM + YEAR_MS },
  )

  it('counts sites, criticality and call-outs per site-year by sector', () => {
    expect(evidence.medical).toEqual({
      sector: 'medical',
      customers: 1,
      sites: 2,
      averageCriticality: 4.5,
      callOuts: 3,
      callOutsPerSiteYear: 1.5,
    })
    expect(evidence.education.callOutsPerSiteYear).toBe(1)
  })

  it('has nothing to average for a sector with no customers', () => {
    expect(evidence.hospitality).toEqual({
      sector: 'hospitality',
      customers: 0,
      sites: 0,
      averageCriticality: null,
      callOuts: 0,
      callOutsPerSiteYear: null,
    })
  })
})

describe('goFirst', () => {
  const ranked = rankSectors(NINE, DEFAULT_SCORES, DEFAULT_WEIGHTS)

  it('names the leader, its lead and what puts it ahead of the runner-up', () => {
    const pick = goFirst(ranked)
    expect(pick?.sector).toBe('telecoms')
    expect(pick?.runnerUp?.sector).toBe('power')
    // Downtime: (5 − 4) × .25 = .25; decision speed: (4 − 3) × .15 = .15
    expect(pick?.drivers).toEqual(['downtime', 'decision-speed'])
    expect(pick?.sentence).toBe(
      'Telecoms & data centres scores 4.4 of 5, 0.4 ahead of Power generation & distribution, mostly on cost of downtime and decision speed.',
    )
  })

  it('adds what the network already holds in the sector', () => {
    const evidence = Object.fromEntries(
      NINE.map((s) => [
        s.id,
        {
          sector: s.id,
          customers: 1,
          sites: s.id === 'telecoms' ? 32 : 10,
          averageCriticality: 3,
          callOuts: 0,
          callOutsPerSiteYear: 0,
        },
      ]),
    ) as Parameters<typeof goFirst>[1]
    expect(goFirst(ranked, evidence)?.sentence).toMatch(
      /; the network already has 32 of its sites, more than any other sector \(synthetic\)\.$/,
    )
  })

  it('says "just ahead" when rounding hides the lead, and handles a tie', () => {
    const scores = scoresWith({ medical: [4, 3], education: [3, 4] })
    const two = NINE.slice(0, 2)
    // 4 × .51 + 3 × .49 = 3.51 against 3.49: both print as 3.5
    const close = rankSectors(two, scores, only({ downtime: 51, 'decision-speed': 49 }))
    expect(goFirst(close)?.sentence).toBe(
      'Medical scores 3.5 of 5, just ahead of Education, mostly on cost of downtime.',
    )
    const tied = rankSectors(two, scores, only({ downtime: 1, 'decision-speed': 1 }))
    expect(goFirst(tied)?.sentence).toBe(
      'Medical ties with Education on 3.5 of 5 and goes first on market attractiveness.',
    )
  })

  it('has nothing to recommend with no sectors', () => {
    expect(goFirst([])).toBeNull()
  })
})

describe('sensitivity', () => {
  const [a, b, c, d] = NINE as [SectorInfo, SectorInfo, SectorInfo, SectorInfo]
  const weights = only({ downtime: 3, 'decision-speed': 2 })

  it('is robust on the default assumptions', () => {
    const result = sensitivity(NINE, DEFAULT_SCORES, DEFAULT_WEIGHTS)
    expect(result.baseline).toEqual(['telecoms', 'power', 'medical'])
    expect(result.cases).toHaveLength(12)
    expect(result.cases.every((x) => x.change === 'none')).toBe(true)
    expect(result.verdict).toBe('robust')
    expect(result.sentence).toBe(
      'Robust: Telecoms & data centres stays #1, and the top 3 stays the same, under every ±20% change to a single weight.',
    )
  })

  it('moves one weight at a time, by 20% each way, skipping zero weights', () => {
    const result = sensitivity([a, b], DEFAULT_SCORES, weights)
    expect(result.cases.map((x) => [x.criterion, x.direction])).toEqual([
      ['downtime', 'up'],
      ['downtime', 'down'],
      ['decision-speed', 'up'],
      ['decision-speed', 'down'],
    ])
  })

  it('reports a change of leader', () => {
    // A: (3×5 + 2×1) ÷ 5 = 3.4. B: (3×2 + 2×5) ÷ 5 = 3.2. 20% more on speed: 3.22 against 3.33
    const scores = scoresWith({ [a.id]: [5, 1], [b.id]: [2, 5], [c.id]: [1, 1] })
    const result = sensitivity([a, b, c], scores, weights)
    expect(result.verdict).toBe('leader-changes')
    const flipped = result.cases.filter((x) => x.top[0] === b.id)
    expect(flipped.map((x) => [x.criterion, x.direction])).toEqual([
      ['downtime', 'down'],
      ['decision-speed', 'up'],
    ])
    expect(flipped[0]?.change).toBe('order')
    expect(flipped[0]?.description).toBe('Education takes #1 from Medical')
    expect(result.sentence).toBe(
      'Sensitive: Medical loses #1 to Education with 20% less weight on cost of downtime, and in 1 other change. The top 3 shifts in 2 of 4 changes.',
    )
  })

  it('reports a shift below a leader that holds', () => {
    const scores = scoresWith({ [a.id]: [5, 5], [b.id]: [5, 1], [c.id]: [2, 5], [d.id]: [1, 1] })
    const result = sensitivity([a, b, c, d], scores, weights)
    expect(result.verdict).toBe('leader-holds')
    expect(result.sentence).toBe(
      'Medical stays #1 under every ±20% change to a single weight, but the rest of the top 3 shifts in 2 of 4: with 20% less weight on cost of downtime, Hospitality moves above Education.',
    )
  })

  it('says which sector drops out of the top when one moves in', () => {
    const scores = scoresWith({ [a.id]: [5, 5], [b.id]: [5, 1], [c.id]: [2, 5], [d.id]: [1, 1] })
    const result = sensitivity([a, b, c, d], scores, weights, { top: 2 })
    expect(result.baseline).toEqual([a.id, b.id])
    const swapped = result.cases.find((x) => x.change === 'members')
    expect(swapped?.description).toBe('Hospitality moves into the top 2 in place of Education')
  })
})

describe('restoreSectorInputs', () => {
  it('returns the defaults for anything that is not a saved object', () => {
    for (const raw of [null, undefined, 'weights', 42, []]) {
      expect(restoreSectorInputs(raw, DEFAULT_SECTOR_INPUTS)).toBe(DEFAULT_SECTOR_INPUTS)
    }
  })

  it('keeps valid saved values and replaces the rest with defaults', () => {
    const restored = restoreSectorInputs(
      {
        weights: { downtime: 8, regulation: -1, 'decision-speed': 'fast', 'in-house': 11 },
        scores: { medical: { downtime: 2, regulation: 6, 'decision-speed': 2.5 }, unknown: {} },
      },
      DEFAULT_SECTOR_INPUTS,
    )
    expect(restored.weights).toEqual({ ...DEFAULT_WEIGHTS, downtime: 8 })
    expect(restored.scores.medical).toEqual({ ...DEFAULT_SCORES.medical, downtime: 2 })
    expect(restored.scores.telecoms).toEqual(DEFAULT_SCORES.telecoms)
    expect(Object.keys(restored.scores)).toEqual(Object.keys(DEFAULT_SCORES))
  })

  it('round-trips through JSON', () => {
    const edited = {
      weights: { ...DEFAULT_WEIGHTS, 'partner-access': 7.5 },
      scores: { ...DEFAULT_SCORES, power: { ...DEFAULT_SCORES.power, regulation: 1 } },
    }
    const raw: unknown = JSON.parse(JSON.stringify(edited))
    expect(restoreSectorInputs(raw, DEFAULT_SECTOR_INPUTS)).toEqual(edited)
  })

  it('covers every criterion', () => {
    const restored = restoreSectorInputs({}, DEFAULT_SECTOR_INPUTS)
    expect(Object.keys(restored.weights).sort()).toEqual(
      CRITERIA.map((c): CriterionId => c.id).sort(),
    )
  })
})
