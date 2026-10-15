import { describe, expect, it } from 'vitest'
import { isOnMainland } from '@/lib/mainland'
import { buildBoard, unweightedPipelineValue, weightedPipelineValue } from '@/lib/pipeline'
import { createRng, seedFor } from '@/lib/rng'
import { THEME_IDS } from '@/lib/rice'
import { SIDES } from '@/lib/scenario'
import type { SideId } from '@/types'
import { DEFAULT_EVENTS } from './events'
import { FEEDBACK, FEEDBACK_SOURCES } from './feedback'
import {
  customers,
  DATA_AS_OF,
  DEMO_NOTE,
  EVENT_CATEGORY_LABELS,
  hadDemo,
  leads,
  leadSites,
  partners,
  responders,
  SECTORS,
  suppliers,
  THEME_LABELS,
} from './index'
import { generateLeadSites } from './leadSites'
import { BOARD_OPTIONS, NO_MOVES, restoreMoves, SECTOR_TERMS } from './pipeline'
import { DEFAULT_PROGRESS, FEATURE_REQUESTS } from './roadmap'

const expectUnique = (ids: readonly string[]) => expect(new Set(ids).size).toBe(ids.length)

describe('lead sites', () => {
  it('gives every lead as many sites as it estimated, numbered from 1', () => {
    for (const lead of leads) {
      const own = leadSites.filter((s) => s.leadId === lead.id)
      expect(own).toHaveLength(lead.estimatedSites)
      expect(own.map((s) => s.id)).toEqual(
        own.map((_, i) => `${lead.id}-S${i + 1}`),
      )
    }
    expectUnique(leadSites.map((s) => s.id))
  })

  it('puts every site on the mainland, in a distinct town, the first at the lead', () => {
    for (const lead of leads) {
      const own = leadSites.filter((s) => s.leadId === lead.id)
      expect(own[0]?.town).toBe(lead.town)
      expectUnique(own.map((s) => s.town))
    }
    for (const site of leadSites) {
      expect(isOnMainland(site)).toBe(true)
      expect(site.criticality).toBeGreaterThanOrEqual(1)
      expect(site.criticality).toBeLessThanOrEqual(5)
    }
  })

  it('comes out the same every time from its own stream', () => {
    const again = generateLeadSites({ rng: createRng(seedFor('lead-sites')), leads })
    expect(again).toEqual(leadSites)
  })
})

describe('demos', () => {
  it('marks only discovery leads whose notes record a walk-through', () => {
    const demoed = leads.filter(hadDemo)
    expect(demoed.length).toBeGreaterThan(0)
    for (const lead of demoed) {
      expect(lead.stage).toBe('discovery')
      expect(lead.notes.endsWith(DEMO_NOTE)).toBe(true)
    }
    expect(leads.some((l) => l.stage === 'discovery' && !hadDemo(l))).toBe(true)
  })
})

describe('feedback', () => {
  const datasets: Record<SideId, readonly { id: string; name: string }[]> = {
    customer: [...customers, ...leads.map((l) => ({ id: l.id, name: l.organisation }))],
    responder: responders,
    supplier: suppliers,
    partner: partners,
  }

  it('holds about twenty entries, from every side, newest first', () => {
    expect(FEEDBACK.length).toBeGreaterThanOrEqual(18)
    expect(FEEDBACK.length).toBeLessThanOrEqual(24)
    for (const side of SIDES) expect(FEEDBACK.some((f) => f.side === side)).toBe(true)
    expectUnique(FEEDBACK.map((f) => f.id))
    const dates = FEEDBACK.map((f) => f.date)
    expect(dates).toEqual([...dates].sort((a, b) => b - a))
  })

  it('quotes organisations from the synthetic data, on the side they belong to', () => {
    for (const entry of FEEDBACK) {
      const orgId = FEEDBACK_SOURCES.get(entry.id)
      const org = datasets[entry.side].find((o) => o.id === orgId)
      expect(org?.name, `${entry.id} (${orgId})`).toBe(entry.organisation)
    }
  })

  it('is dated on or before the data date, within the last six months', () => {
    for (const entry of FEEDBACK) {
      expect(entry.date).toBeLessThanOrEqual(DATA_AS_OF)
      expect(DATA_AS_OF - entry.date).toBeLessThan(183 * 86_400_000)
    }
  })

  it('tags every entry with a theme that a feature request answers', () => {
    const answered = new Set(FEATURE_REQUESTS.flatMap((f) => f.themes))
    for (const entry of FEEDBACK) expect(answered.has(entry.theme)).toBe(true)
  })
})

describe('roadmap', () => {
  it('has RICE inputs and a UAT result for every feature request, and nothing else', () => {
    expect(Object.keys(DEFAULT_PROGRESS).sort()).toEqual(FEATURE_REQUESTS.map((f) => f.id).sort())
    expectUnique(FEATURE_REQUESTS.map((f) => f.id))
    expectUnique(FEATURE_REQUESTS.map((f) => f.story.id))
  })

  it('covers every theme, each with a labelled name', () => {
    const covered = new Set(FEATURE_REQUESTS.flatMap((f) => f.themes))
    for (const theme of THEME_IDS) {
      expect(covered.has(theme)).toBe(true)
      expect(THEME_LABELS[theme]).toBeTruthy()
    }
  })

  it('gives every story at least two Given/When/Then criteria', () => {
    for (const { story } of FEATURE_REQUESTS) {
      expect(story.criteria.length).toBeGreaterThanOrEqual(2)
      for (const c of story.criteria) {
        expect(c.given && c.when && c.then).toBeTruthy()
        // Each criterion reads as one sentence, so no part ends in a full stop
        for (const part of [c.given, c.when, c.then]) expect(part).not.toMatch(/\.$/)
      }
    }
  })

  it('records a test note for every story that has been through UAT', () => {
    for (const progress of Object.values(DEFAULT_PROGRESS)) {
      if (progress.uat !== 'not-started') expect(progress.testNote).not.toBe('')
    }
  })
})

describe('events', () => {
  it('covers each kind of event once by ID, with names and dates left to verify', () => {
    expectUnique(DEFAULT_EVENTS.map((e) => e.id))
    for (const category of Object.keys(EVENT_CATEGORY_LABELS)) {
      expect(DEFAULT_EVENTS.some((e) => e.category === category)).toBe(true)
    }
    for (const event of DEFAULT_EVENTS) {
      expect(event.name).toBe('')
      expect(event.date).toBe('')
      expect(event.verified).toBe(false)
      expect(event.sides.length).toBeGreaterThan(0)
      expect(event.budget).toBeGreaterThan(0)
    }
  })
})

describe('pipeline valuation', () => {
  it('gives every sector a recommended tier and a downtime score', () => {
    for (const sector of SECTORS) {
      const terms = SECTOR_TERMS[sector.id]
      expect(terms.recommendation.tier.name).not.toBe('')
      expect(terms.downtimeScore).toBeGreaterThanOrEqual(1)
      expect(terms.downtimeScore).toBeLessThanOrEqual(5)
      expect(terms.rateBasis).toMatch(/average/)
    }
  })

  it('values every lead and weights the board the same way wherever it is built', () => {
    const board = buildBoard(leads, NO_MOVES, BOARD_OPTIONS)
    expect(board.cards.every((c) => c.annualValue > 0)).toBe(true)
    expect(weightedPipelineValue(board.cards)).toBeGreaterThan(0)
    expect(weightedPipelineValue(board.cards)).toBeLessThan(unweightedPipelineValue(board.cards))
  })

  it('keeps saved moves only for leads that exist', () => {
    const lead = leads[0]?.id ?? ''
    const moves = restoreMoves({
      [lead]: { stage: 'live', enteredAt: DATA_AS_OF },
      'LEAD-999': { stage: 'live', enteredAt: DATA_AS_OF },
    })
    expect(Object.keys(moves)).toEqual([lead])
  })
})
