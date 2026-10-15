import { describe, expect, it } from 'vitest'
import {
  ALTERNATIVES,
  applyEdits,
  DEFAULT_ALTERNATIVES_INPUTS,
  DEFAULT_CATEGORY,
  DEFAULT_COMPARISON,
  factorVerdicts,
  FACTORS,
  NOTE_MAX_LENGTH,
  OPTIONS,
  positioningParts,
  positioningStatement,
  restoreAlternativesInputs,
  SECTOR_POSITIONING,
  suggestedPositioning,
  summariseComparison,
  type Comparison,
  type FactorId,
  type OptionId,
  type Rating,
} from './positioning'

/** The default comparison with some ratings changed. */
function rated(changes: [OptionId, FactorId, Rating][]): Comparison {
  const comparison = structuredClone(DEFAULT_COMPARISON)
  for (const [option, factor, rating] of changes) {
    comparison[option][factor] = { ...comparison[option][factor], rating }
  }
  return comparison
}

/** Every option rated the same on every factor. */
function flat(rating: Rating): Comparison {
  return Object.fromEntries(
    OPTIONS.map((o) => [
      o.id,
      Object.fromEntries(FACTORS.map((f) => [f.id, { rating, note: '' }])),
    ]),
  ) as Comparison
}

describe('the default comparison', () => {
  it('rates every option on every factor with a short note', () => {
    for (const o of OPTIONS) {
      for (const f of FACTORS) {
        const cell = DEFAULT_COMPARISON[o.id][f.id]
        expect(cell.note.length).toBeGreaterThan(0)
        expect(cell.note.length).toBeLessThanOrEqual(NOTE_MAX_LENGTH)
      }
    }
  })

  it('compares generic categories, not named companies', () => {
    expect(ALTERNATIVES.map((a) => a.label)).toEqual([
      'In-house authorised person',
      'Annual maintenance contract with an HV contractor',
      'Term or framework contractor',
      'Ad-hoc phone search',
    ])
  })
})

describe('factorVerdicts', () => {
  it('compares PowerSOS with the best alternative on each factor', () => {
    const verdicts = factorVerdicts(DEFAULT_COMPARISON)
    expect(verdicts.map((v) => [v.factor, v.outcome])).toEqual([
      ['response', 'wins'],
      ['cost-certainty', 'wins'],
      ['cover', 'wins'],
      ['visibility', 'wins'],
      ['compliance', 'level'],
      ['setup', 'behind'],
    ])
    expect(verdicts.find((v) => v.factor === 'setup')).toMatchObject({
      powersos: 'partial',
      best: 'strong',
      ahead: ['ad-hoc'],
    })
  })

  it('lists the alternatives ahead best first', () => {
    const comparison = rated([
      ['powersos', 'cover', 'weak'],
      ['in-house', 'cover', 'partial'],
      ['framework', 'cover', 'strong'],
    ])
    const cover = factorVerdicts(comparison).find((v) => v.factor === 'cover')
    expect(cover?.ahead).toEqual(['framework', 'in-house', 'maintenance-contract'])
  })
})

describe('summariseComparison', () => {
  it('says where PowerSOS wins and where it is weakest', () => {
    const summary = summariseComparison(DEFAULT_COMPARISON)
    expect(summary.wins).toEqual(['response', 'cost-certainty', 'cover', 'visibility'])
    expect(summary.level).toEqual(['compliance'])
    expect(summary.weakest).toEqual(['setup'])
    expect(summary.winsSentence).toBe(
      'PowerSOS wins on response time, cost certainty, 24/7 cover and multi-site visibility: no alternative is rated as highly. It matches the best alternative on compliance evidence.',
    )
    expect(summary.weakestSentence).toBe(
      'Weakest on set-up effort (Partial, behind an ad-hoc phone search).',
    )
  })

  it('puts the biggest gap first when PowerSOS is behind on several factors', () => {
    const summary = summariseComparison(
      rated([
        ['powersos', 'compliance', 'weak'],
        ['powersos', 'cost-certainty', 'partial'],
        ['in-house', 'cost-certainty', 'strong'],
      ]),
    )
    expect(summary.weakest).toEqual(['compliance', 'cost-certainty', 'setup'])
    expect(summary.weakestSentence).toMatch(
      /^Weakest on compliance evidence \(Weak, behind an in-house authorised person, an annual maintenance contract with an HV contractor and a term or framework contractor\), cost certainty/,
    )
  })

  it('falls back to the lowest ratings when PowerSOS is never behind', () => {
    const summary = summariseComparison(rated([['ad-hoc', 'setup', 'partial']]))
    expect(summary.behind).toEqual([])
    expect(summary.weakest).toEqual(['setup'])
    expect(summary.weakestSentence).toBe(
      'Never behind an alternative, but only partial on set-up effort.',
    )
  })

  it('handles ratings that are all the same', () => {
    const summary = summariseComparison(flat('strong'))
    expect(summary.wins).toEqual([])
    expect(summary.level).toHaveLength(6)
    expect(summary.winsSentence).toMatch(/^In the current ratings, PowerSOS does not beat/)
    expect(summary.weakestSentence).toBe(
      'No weak spots in the current ratings: worth testing them with customers.',
    )
  })
})

describe('suggestedPositioning', () => {
  it("fills from the sector and from where PowerSOS beats that sector's alternative most", () => {
    // Against an in-house authorised person, 24/7 cover is the biggest gap
    expect(suggestedPositioning('medical', DEFAULT_COMPARISON)).toEqual({
      segment: SECTOR_POSITIONING.medical.segment,
      need: SECTOR_POSITIONING.medical.need,
      category: DEFAULT_CATEGORY,
      benefit:
        'gets a vetted, HV-authorised responder to site against a 75-minute target and answers at any hour, every day of the year',
      alternative: 'an in-house authorised person',
    })
  })

  it('reads as one sentence', () => {
    expect(positioningStatement(suggestedPositioning('telecoms', DEFAULT_COMPARISON))).toBe(
      'For data centre and telecoms operators who cannot risk a single site losing power, PowerSOS is a 24/7 emergency response platform for private HV networks that gets a vetted, HV-authorised responder to site against a 75-minute target and predicts the cost for approval before work starts, unlike an annual maintenance contract with an HV contractor.',
    )
  })

  it('falls back to Strong ratings when PowerSOS never beats the alternative', () => {
    // Rated the same as an ad-hoc search on every factor
    const level = rated(
      FACTORS.map((f) => ['ad-hoc', f.id, DEFAULT_COMPARISON.powersos[f.id].rating]),
    )
    expect(suggestedPositioning('warehousing', level).benefit).toBe(
      'gets a vetted, HV-authorised responder to site against a 75-minute target and predicts the cost for approval before work starts',
    )
    // Strong on 24/7 cover alone
    const cover = rated([
      ...FACTORS.map((f): [OptionId, FactorId, Rating] => ['powersos', f.id, 'weak']),
      ['powersos', 'cover', 'strong'],
      ['ad-hoc', 'cover', 'strong'],
    ])
    expect(suggestedPositioning('warehousing', cover).benefit).toBe(
      'answers at any hour, every day of the year',
    )
    expect(suggestedPositioning('agriculture', flat('weak')).benefit).toBe(
      'connects private HV networks with vetted, HV-authorised responders',
    )
  })

  it('has a buyer, a need and an alternative for every sector', () => {
    for (const seed of Object.values(SECTOR_POSITIONING)) {
      expect(seed.segment).not.toBe('')
      expect(seed.need).not.toBe('')
      expect(ALTERNATIVES.some((a) => a.id === seed.alternative)).toBe(true)
    }
  })
})

describe('applyEdits and positioningStatement', () => {
  const suggested = suggestedPositioning('power', DEFAULT_COMPARISON)

  it('uses edited fields and ignores blank ones', () => {
    const p = applyEdits(suggested, { segment: '  solar farm operators ', need: '   ' })
    expect(p.segment).toBe('solar farm operators')
    expect(p.need).toBe(suggested.need)
  })

  it('trims stray punctuation so the sentence stays well formed', () => {
    expect(
      positioningStatement({
        segment: 'hospitals,',
        need: 'need power.',
        category: 'a platform',
        benefit: 'helps;',
        alternative: 'a contractor.',
      }),
    ).toBe('For hospitals who need power, PowerSOS is a platform that helps, unlike a contractor.')
  })

  it('gives the statement in parts, for showing each field', () => {
    const parts = positioningParts(suggested)
    expect(parts.map((p) => p.field)).toEqual([
      'segment',
      'need',
      'category',
      'benefit',
      'alternative',
    ])
    expect(`${parts.map((p) => p.before + p.text).join('')}.`).toBe(positioningStatement(suggested))
  })
})

describe('restoreAlternativesInputs', () => {
  it('returns the defaults for anything that is not a saved object', () => {
    for (const raw of [null, 'x', 3, [1]]) {
      expect(restoreAlternativesInputs(raw, DEFAULT_ALTERNATIVES_INPUTS)).toBe(
        DEFAULT_ALTERNATIVES_INPUTS,
      )
    }
  })

  it('keeps valid cells and edits, and replaces the rest with defaults', () => {
    const restored = restoreAlternativesInputs(
      {
        comparison: {
          powersos: {
            setup: { rating: 'strong', note: 'Ready in a day' },
            cover: { rating: 'excellent', note: 42 },
            response: 'strong',
          },
          'ad-hoc': { setup: { rating: 'weak', note: 'x'.repeat(200) } },
        },
        positioning: { segment: 'farm estates', need: '   ', benefit: 7, unknown: 'x' },
      },
      DEFAULT_ALTERNATIVES_INPUTS,
    )
    expect(restored.comparison.powersos.setup).toEqual({ rating: 'strong', note: 'Ready in a day' })
    expect(restored.comparison.powersos.cover).toEqual(DEFAULT_COMPARISON.powersos.cover)
    expect(restored.comparison.powersos.response).toEqual(DEFAULT_COMPARISON.powersos.response)
    expect(restored.comparison['ad-hoc'].setup.note).toHaveLength(NOTE_MAX_LENGTH)
    expect(restored.comparison.framework).toEqual(DEFAULT_COMPARISON.framework)
    expect(restored.positioning).toEqual({ segment: 'farm estates' })
  })

  it('round-trips through JSON', () => {
    const edited = {
      comparison: rated([['framework', 'setup', 'partial']]),
      positioning: { category: 'an HV emergency service' },
    }
    const raw: unknown = JSON.parse(JSON.stringify(edited))
    expect(restoreAlternativesInputs(raw, DEFAULT_ALTERNATIVES_INPUTS)).toEqual(edited)
  })
})
