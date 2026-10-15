import { describe, expect, it } from 'vitest'
import type { EventPlan, Lead } from '@/types'
import {
  AMBER_AFTER_DAYS,
  buildBoard,
  conversionBySource,
  daysBetween,
  defaultProposalLead,
  eventBudget,
  filterBoard,
  moveCard,
  nextAction,
  PIPELINE_STAGES,
  RED_AFTER_DAYS,
  restoreBoardMoves,
  restoreEvents,
  stageAge,
  stageInfo,
  stageTotals,
  startingCard,
  stuckDeals,
  unweightedPipelineValue,
  weightedPipelineValue,
  type BoardMoves,
  type BoardOptions,
} from './pipeline'
import { DAY_MS } from './time'

const AS_OF = Date.UTC(2026, 9, 14, 8, 0)
const daysAgo = (n: number) => AS_OF - n * DAY_MS

function lead(id: string, overrides: Partial<Lead> = {}): Lead {
  return {
    id,
    organisation: `Org ${id}`,
    sector: 'medical',
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    stage: 'discovery',
    estimatedSites: 2,
    source: 'inbound',
    partnerId: null,
    contact: { name: 'Test Person', role: 'Director of estates', phone: '07700 900000' },
    createdAt: daysAgo(100),
    lastContactAt: daysAgo(5),
    notes: '',
    ...overrides,
  }
}

/** Every lead is worth £1,000 a year, and none has had a demo. */
const OPTIONS: BoardOptions = { asOf: AS_OF, demoHeld: () => false, annualValue: () => 1_000 }

describe('stages', () => {
  it('runs from lead to live with rising probabilities', () => {
    expect(PIPELINE_STAGES.map((s) => s.id)).toEqual([
      'lead',
      'discovery',
      'demo',
      'proposal',
      'negotiation',
      'onboarding',
      'live',
    ])
    const probabilities = PIPELINE_STAGES.map((s) => s.probability)
    expect(probabilities).toEqual([...probabilities].sort((a, b) => a - b))
    expect(stageInfo('live').probability).toBe(1)
  })

  it('throws for an unknown stage', () => {
    expect(() => stageInfo('won' as never)).toThrow()
  })
})

describe('startingCard', () => {
  it('maps recorded stages onto the board', () => {
    expect(startingCard(lead('A', { stage: 'wait-list', lastContactAt: null }), false)?.stage).toBe(
      'lead',
    )
    expect(startingCard(lead('A', { stage: 'contacted' }), false)?.stage).toBe('lead')
    expect(startingCard(lead('A', { stage: 'discovery' }), false)?.stage).toBe('discovery')
    expect(startingCard(lead('A', { stage: 'discovery' }), true)?.stage).toBe('demo')
    expect(startingCard(lead('A', { stage: 'proposal' }), true)?.stage).toBe('proposal')
    expect(startingCard(lead('A', { stage: 'negotiation' }), false)?.stage).toBe('negotiation')
  })

  it('takes lost leads off the board', () => {
    expect(startingCard(lead('A', { stage: 'lost' }), false)).toBeNull()
  })

  it('dates the stage from the last contact, or from joining when nobody has been in touch', () => {
    expect(startingCard(lead('A'), false)?.enteredAt).toBe(daysAgo(5))
    expect(
      startingCard(lead('A', { stage: 'wait-list', lastContactAt: null }), false)?.enteredAt,
    ).toBe(daysAgo(100))
  })
})

describe('days in stage', () => {
  it('counts whole days and never goes below zero', () => {
    expect(daysBetween(daysAgo(3), AS_OF)).toBe(3)
    expect(daysBetween(AS_OF - DAY_MS / 2, AS_OF)).toBe(0)
    expect(daysBetween(AS_OF + DAY_MS, AS_OF)).toBe(0)
    expect(() => daysBetween(Number.NaN, AS_OF)).toThrow(RangeError)
  })

  it('turns amber after 14 days and red after 30', () => {
    expect(stageAge(0)).toBe('ok')
    expect(stageAge(AMBER_AFTER_DAYS)).toBe('ok')
    expect(stageAge(AMBER_AFTER_DAYS + 1)).toBe('slowing')
    expect(stageAge(RED_AFTER_DAYS)).toBe('slowing')
    expect(stageAge(RED_AFTER_DAYS + 1)).toBe('stuck')
    expect(() => stageAge(-1)).toThrow(RangeError)
  })
})

describe('nextAction', () => {
  it('asks for a first contact, through the referring partner when there is one', () => {
    const waiting = lead('A', { stage: 'wait-list', lastContactAt: null })
    expect(nextAction('lead', waiting)).toBe('Make first contact')
    expect(nextAction('lead', waiting, 'Maplehythe FM')).toBe(
      'Ask Maplehythe FM for an introduction',
    )
  })

  it("otherwise follows the stage's next action", () => {
    expect(nextAction('lead', lead('A', { stage: 'contacted' }))).toBe('Book a discovery call')
    expect(nextAction('negotiation', lead('A'))).toBe(stageInfo('negotiation').nextAction)
  })
})

describe('buildBoard', () => {
  const leads = [
    lead('A', { stage: 'wait-list', lastContactAt: null }),
    lead('B', { stage: 'discovery', lastContactAt: daysAgo(20) }),
    lead('C', { stage: 'proposal', lastContactAt: daysAgo(40) }),
    lead('D', { stage: 'lost' }),
  ]

  it('places each lead, values it and sets lost leads aside', () => {
    const board = buildBoard(leads, {}, OPTIONS)
    expect(board.cards.map((c) => [c.lead.id, c.stage, c.daysInStage, c.age])).toEqual([
      ['A', 'lead', 100, 'stuck'],
      ['B', 'discovery', 20, 'slowing'],
      ['C', 'proposal', 40, 'stuck'],
    ])
    expect(board.lost.map((l) => l.id)).toEqual(['D'])
    expect(board.cards.map((c) => c.weightedValue)).toEqual([50, 150, 500])
  })

  it('applies moves and marks the moved cards', () => {
    const moves: BoardMoves = { B: { stage: 'live', enteredAt: AS_OF } }
    const card = buildBoard(leads, moves, OPTIONS).cards.find((c) => c.lead.id === 'B')
    expect(card).toMatchObject({ stage: 'live', daysInStage: 0, weightedValue: 1_000, moved: true })
  })

  it('orders cards by stage, then longest in the stage first', () => {
    const many = [
      lead('X', { stage: 'proposal', lastContactAt: daysAgo(1) }),
      lead('Y', { stage: 'proposal', lastContactAt: daysAgo(9) }),
      lead('Z', { stage: 'contacted' }),
    ]
    expect(buildBoard(many, {}, OPTIONS).cards.map((c) => c.lead.id)).toEqual(['Z', 'Y', 'X'])
  })

  it('rejects an invalid annual value', () => {
    expect(() => buildBoard(leads, {}, { ...OPTIONS, annualValue: () => -1 })).toThrow(RangeError)
    expect(() => buildBoard(leads, {}, { ...OPTIONS, annualValue: () => Number.NaN })).toThrow(
      RangeError,
    )
  })
})

describe('pipeline value', () => {
  it('sums stage probability × annual value across every card', () => {
    const leads = [
      lead('A', { stage: 'contacted' }),
      lead('B', { stage: 'discovery' }),
      lead('C', { stage: 'proposal' }),
      lead('D', { stage: 'negotiation' }),
    ]
    const values: Record<string, number> = { A: 10_000, B: 4_000, C: 2_000, D: 3_000 }
    const board = buildBoard(leads, { D: { stage: 'live', enteredAt: AS_OF } }, {
      ...OPTIONS,
      annualValue: (l) => values[l.id] ?? 0,
    })
    // 10,000 × 5% + 4,000 × 15% + 2,000 × 50% + 3,000 × 100%
    expect(weightedPipelineValue(board.cards)).toBeCloseTo(500 + 600 + 1_000 + 3_000, 9)
    expect(unweightedPipelineValue(board.cards)).toBe(19_000)
  })

  it('is zero for an empty board', () => {
    expect(weightedPipelineValue([])).toBe(0)
  })

  it('totals each stage, empty stages included', () => {
    const board = buildBoard([lead('A'), lead('B')], {}, OPTIONS)
    const totals = stageTotals(board.cards)
    expect(totals).toHaveLength(PIPELINE_STAGES.length)
    expect(totals.find((t) => t.stage.id === 'discovery')).toMatchObject({
      cards: 2,
      value: 2_000,
      weightedValue: 300,
    })
    expect(totals.find((t) => t.stage.id === 'live')).toMatchObject({ cards: 0, value: 0 })
    expect(totals.reduce((sum, t) => sum + t.weightedValue, 0)).toBeCloseTo(
      weightedPipelineValue(board.cards),
      9,
    )
  })
})

describe('moveCard', () => {
  const starting = { stage: 'discovery' as const, enteredAt: daysAgo(20) }

  it('records the new stage from the day of the move', () => {
    expect(moveCard({}, 'A', 'demo', AS_OF, starting)).toEqual({
      A: { stage: 'demo', enteredAt: AS_OF },
    })
  })

  it('changes nothing when the card is already in that stage', () => {
    const moves = {}
    expect(moveCard(moves, 'A', 'discovery', AS_OF, starting)).toBe(moves)
    const moved: BoardMoves = { A: { stage: 'demo', enteredAt: daysAgo(2) } }
    expect(moveCard(moved, 'A', 'demo', AS_OF, starting)).toBe(moved)
  })

  it('drops the move when a card goes back to where the data puts it', () => {
    const moved: BoardMoves = { A: { stage: 'demo', enteredAt: AS_OF }, B: starting }
    expect(moveCard(moved, 'A', 'discovery', AS_OF, starting)).toEqual({ B: starting })
  })

  it('leaves the original moves untouched', () => {
    const moves: BoardMoves = {}
    moveCard(moves, 'A', 'live', AS_OF, starting)
    expect(moves).toEqual({})
  })

  it('rejects an unknown stage or time', () => {
    expect(() => moveCard({}, 'A', 'won' as never, AS_OF, starting)).toThrow(RangeError)
    expect(() => moveCard({}, 'A', 'live', Number.NaN, starting)).toThrow(RangeError)
  })
})

describe('restoreBoardMoves', () => {
  const ids = new Set(['A', 'B'])

  it('keeps valid moves for leads that exist', () => {
    const raw = {
      A: { stage: 'live', enteredAt: AS_OF },
      B: { stage: 'won', enteredAt: AS_OF },
      C: { stage: 'demo', enteredAt: AS_OF },
    }
    expect(restoreBoardMoves(raw, ids)).toEqual({ A: { stage: 'live', enteredAt: AS_OF } })
  })

  it('returns no moves for anything that is not an object of moves', () => {
    for (const raw of [null, 'moves', 3, [], { A: null }, { A: { stage: 'demo' } }]) {
      expect(restoreBoardMoves(raw, ids)).toEqual({})
    }
  })
})

describe('filters, conversion and stuck deals', () => {
  const leads = [
    lead('A', { source: 'partner-referral', stage: 'proposal', sector: 'telecoms' }),
    lead('B', { source: 'partner-referral', stage: 'discovery' }),
    lead('C', { source: 'partner-referral', stage: 'lost' }),
    lead('D', { source: 'trade-show', stage: 'negotiation', lastContactAt: daysAgo(45) }),
    lead('E', { source: 'inbound', stage: 'wait-list', lastContactAt: null }),
  ]
  const board = buildBoard(leads, { B: { stage: 'onboarding', enteredAt: daysAgo(31) } }, OPTIONS)

  it('filters cards and lost leads by sector and source', () => {
    expect(filterBoard(board, { sector: 'telecoms', source: 'all' }).cards.map((c) => c.lead.id)).toEqual(['A'])
    const referrals = filterBoard(board, { sector: 'all', source: 'partner-referral' })
    expect(referrals.cards).toHaveLength(2)
    expect(referrals.lost.map((l) => l.id)).toEqual(['C'])
    expect(filterBoard(board, { sector: 'all', source: 'all' })).toEqual(board)
  })

  it('counts proposal or later as converted, and lost leads as not', () => {
    const [referral, tradeShow, inbound, outbound] = conversionBySource(board)
    expect(referral).toMatchObject({ leads: 3, converted: 2, won: 1, lost: 1 })
    expect(referral?.rate).toBeCloseTo(2 / 3, 9)
    expect(tradeShow).toMatchObject({ leads: 1, converted: 1, rate: 1 })
    expect(inbound).toMatchObject({ leads: 1, converted: 0, rate: 0 })
    expect(outbound).toMatchObject({ source: 'outbound', leads: 0, rate: null })
  })

  it('lists deals over 30 days in a stage, most weighted value first, leaving out live deals', () => {
    const stuck = stuckDeals(board.cards)
    // B: onboarding 90% · D: negotiation 70% · E: lead 5%
    expect(stuck.map((c) => c.lead.id)).toEqual(['B', 'D', 'E'])
    const live = buildBoard(leads, { D: { stage: 'live', enteredAt: daysAgo(60) } }, OPTIONS)
    expect(stuckDeals(live.cards).map((c) => c.lead.id)).not.toContain('D')
  })
})

describe('defaultProposalLead', () => {
  it('picks the deal at Proposal worth most, or the first deal when none is at Proposal', () => {
    const values: Record<string, number> = { A: 9_000, B: 2_000, C: 5_000 }
    const options = { ...OPTIONS, annualValue: (l: Lead) => values[l.id] ?? 0 }
    const leads = [
      lead('A', { stage: 'negotiation' }),
      lead('B', { stage: 'proposal' }),
      lead('C', { stage: 'proposal' }),
    ]
    expect(defaultProposalLead(buildBoard(leads, {}, options).cards)?.lead.id).toBe('C')
    const none = buildBoard([lead('A', { stage: 'contacted' })], {}, options).cards
    expect(defaultProposalLead(none)?.lead.id).toBe('A')
    expect(defaultProposalLead([])).toBeUndefined()
  })
})

describe('events', () => {
  const event = (id: string, overrides: Partial<EventPlan> = {}): EventPlan => ({
    id,
    category: 'facilities',
    type: 'Trade exhibition',
    sides: ['partner'],
    objective: 'leads',
    budget: 1_000,
    status: 'idea',
    name: '',
    date: '',
    verified: false,
    ...overrides,
  })
  const events = [
    event('a'),
    event('b', { objective: 'partner-meetings', budget: 500, status: 'booked', verified: true }),
    event('c', { budget: 2_000, status: 'not-going' }),
  ]

  it('totals the budget of events still in the plan', () => {
    expect(eventBudget(events)).toEqual({
      planned: 1_500,
      booked: 500,
      byObjective: { leads: 1_000, 'responder-recruitment': 0, 'partner-meetings': 500 },
      toVerify: 1,
    })
    expect(eventBudget([]).planned).toBe(0)
  })

  it('restores valid edits by ID and falls back to the defaults for the rest', () => {
    const raw = [
      { id: 'a', name: 'Checked name', date: 'Mar 2027', status: 'booked', budget: 1_200, verified: true },
      { id: 'b', status: 'cancelled', budget: -5, objective: 'fun', verified: 'yes' },
      { id: 'zzz', name: 'Unknown event' },
      'junk',
    ]
    const restored = restoreEvents(raw, events)
    expect(restored.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    expect(restored[0]).toMatchObject({
      name: 'Checked name',
      date: 'Mar 2027',
      status: 'booked',
      budget: 1_200,
      verified: true,
      type: 'Trade exhibition',
    })
    expect(restored[1]).toEqual(events[1])
    expect(restored[2]).toEqual(events[2])
    expect(restoreEvents(null, events)).toEqual(events)
  })

  it('cuts saved text down to length', () => {
    const [first] = restoreEvents([{ id: 'a', name: 'x'.repeat(500) }], events)
    expect(first?.name.length).toBe(80)
  })
})
