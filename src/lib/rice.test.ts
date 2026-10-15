import { describe, expect, it } from 'vitest'
import type { FeatureProgress, FeatureRequest, FeedbackEntry, RiceInputs } from '@/types'
import { toCsv } from './csv'
import {
  addFeedback,
  backlogTable,
  criterionSentence,
  mentionsOf,
  rankFeatures,
  restoreVoc,
  riceScore,
  storySentence,
  themeCounts,
  THEME_IDS,
  type VocState,
} from './rice'

const DAY = 86_400_000
const AS_OF = Date.UTC(2026, 9, 14)

function feature(id: string, overrides: Partial<FeatureRequest> = {}): FeatureRequest {
  return {
    id,
    title: `Feature ${id}`,
    themes: ['eta-updates'],
    story: {
      id: `PS-${id}`,
      asA: 'duty manager',
      iWant: 'texts',
      soThat: 'I know when the crew arrives',
      criteria: [{ given: 'a job is accepted', when: 'the ETA is set', then: 'contacts get a text' }],
    },
    ...overrides,
  }
}

const progress = (rice: RiceInputs, overrides: Partial<FeatureProgress> = {}): FeatureProgress => ({
  rice,
  uat: 'not-started',
  testNote: '',
  ...overrides,
})

function entry(id: string, overrides: Partial<FeedbackEntry> = {}): FeedbackEntry {
  return {
    id,
    organisation: `Org ${id}`,
    side: 'customer',
    quote: 'We need texts.',
    theme: 'eta-updates',
    date: AS_OF,
    ...overrides,
  }
}

describe('riceScore', () => {
  it('is reach × impact × confidence ÷ effort', () => {
    expect(riceScore({ reach: 45, impact: 2, confidence: 0.8, effort: 1.5 })).toBeCloseTo(48, 9)
    expect(riceScore({ reach: 10, impact: 1, confidence: 1, effort: 0.5 })).toBe(20)
    expect(riceScore({ reach: 0, impact: 3, confidence: 1, effort: 2 })).toBe(0)
  })

  it('returns null rather than dividing by an effort of 0', () => {
    expect(riceScore({ reach: 50, impact: 3, confidence: 1, effort: 0 })).toBeNull()
  })

  it('rejects inputs out of range', () => {
    const ok: RiceInputs = { reach: 10, impact: 1, confidence: 0.8, effort: 1 }
    for (const bad of [
      { reach: -1 },
      { reach: Number.NaN },
      { impact: -0.5 },
      { confidence: 1.2 },
      { effort: -1 },
      { effort: Number.POSITIVE_INFINITY },
    ]) {
      expect(() => riceScore({ ...ok, ...bad })).toThrow(RangeError)
    }
  })
})

describe('rankFeatures', () => {
  const features = [feature('a'), feature('b'), feature('c'), feature('d')]
  const inputs: Record<string, FeatureProgress> = {
    a: progress({ reach: 10, impact: 1, confidence: 1, effort: 1 }), // 10
    b: progress({ reach: 40, impact: 2, confidence: 0.8, effort: 2 }), // 32
    c: progress({ reach: 100, impact: 3, confidence: 1, effort: 0 }), // can't be scored
    d: progress({ reach: 30, impact: 2, confidence: 1, effort: 2 }), // 30
  }

  it('ranks by score, highest first, with unscored features last and unranked', () => {
    const ranked = rankFeatures(features, inputs, [])
    expect(ranked.map((r) => [r.feature.id, r.rank])).toEqual([
      ['b', 1],
      ['d', 2],
      ['a', 3],
      ['c', null],
    ])
    expect(ranked.map((r) => r.score)).toEqual([32, 30, 10, null])
  })

  it('breaks ties on reach, then title', () => {
    const tied = rankFeatures(
      [feature('x', { title: 'Zebra' }), feature('y', { title: 'Alpha' }), feature('z')],
      {
        x: progress({ reach: 10, impact: 2, confidence: 1, effort: 2 }), // 10
        y: progress({ reach: 10, impact: 1, confidence: 1, effort: 1 }), // 10
        z: progress({ reach: 20, impact: 0.5, confidence: 1, effort: 1 }), // 10
      },
      [],
    )
    expect(tied.map((r) => r.feature.id)).toEqual(['z', 'y', 'x'])
  })

  it('re-ranks when an input changes', () => {
    const edited = { ...inputs, a: progress({ reach: 100, impact: 3, confidence: 1, effort: 1 }) }
    expect(rankFeatures(features, edited, [])[0]?.feature.id).toBe('a')
  })

  it('handles every feature having an effort of 0', () => {
    const zero = progress({ reach: 1, impact: 1, confidence: 1, effort: 0 })
    const ranked = rankFeatures(features, { a: zero, b: zero, c: zero, d: zero }, [])
    expect(ranked.every((r) => r.score === null && r.rank === null)).toBe(true)
  })

  it('throws when a feature has no inputs', () => {
    expect(() => rankFeatures([feature('missing')], inputs, [])).toThrow(RangeError)
  })

  it('attaches the feedback for its themes, newest first', () => {
    const feedback = [
      entry('1', { date: AS_OF - 10 * DAY }),
      entry('2', { theme: 'site-data' }),
      entry('3', { date: AS_OF - DAY }),
    ]
    const [first] = rankFeatures([feature('a')], { a: inputs.a as FeatureProgress }, feedback)
    expect(first?.mentions.map((m) => m.id)).toEqual(['3', '1'])
    expect(mentionsOf(feature('b', { themes: ['site-data', 'cost-control'] }), feedback)).toHaveLength(1)
  })
})

describe('themeCounts', () => {
  it('counts every theme, zeros included', () => {
    const counts = themeCounts([entry('1'), entry('2'), entry('3', { theme: 'integrations' })])
    expect(counts['eta-updates']).toBe(2)
    expect(counts.integrations).toBe(1)
    expect(counts['site-data']).toBe(0)
    expect(Object.keys(counts)).toHaveLength(THEME_IDS.length)
  })
})

describe('addFeedback', () => {
  const draft = {
    organisation: '  Fennelby Data Centres ',
    side: 'customer' as const,
    quote: ' We need texts. ',
    theme: 'eta-updates' as const,
    date: AS_OF,
  }

  it('adds a trimmed entry with the next free ID, newest first', () => {
    const log = [entry('FB-001', { date: AS_OF - DAY }), entry('FB-U2', { date: AS_OF - 2 * DAY })]
    const next = addFeedback(log, draft)
    expect(next[0]).toEqual({
      id: 'FB-U3',
      organisation: 'Fennelby Data Centres',
      side: 'customer',
      quote: 'We need texts.',
      theme: 'eta-updates',
      date: AS_OF,
    })
    expect(next).toHaveLength(3)
    expect(addFeedback([], draft)[0]?.id).toBe('FB-U1')
  })

  it('puts a new entry above older ones logged for the same day', () => {
    const log = [entry('FB-009'), entry('FB-U9'), entry('FB-U10')]
    expect(addFeedback(log, draft).map((f) => f.id)).toEqual(['FB-U11', 'FB-U10', 'FB-U9', 'FB-009'])
  })

  it('rejects blank text, unknown sides or themes and bad dates', () => {
    expect(() => addFeedback([], { ...draft, organisation: '  ' })).toThrow(RangeError)
    expect(() => addFeedback([], { ...draft, quote: '' })).toThrow(RangeError)
    expect(() => addFeedback([], { ...draft, quote: 'x'.repeat(401) })).toThrow(RangeError)
    expect(() => addFeedback([], { ...draft, side: 'investor' as never })).toThrow(RangeError)
    expect(() => addFeedback([], { ...draft, theme: 'vibes' as never })).toThrow(RangeError)
    expect(() => addFeedback([], { ...draft, date: Number.NaN })).toThrow(RangeError)
  })
})

describe('sentences', () => {
  it('writes the user story and criteria in full', () => {
    expect(storySentence({ asA: 'duty manager', iWant: 'texts', soThat: 'I know' })).toBe(
      'As a duty manager, I want texts, so that I know.',
    )
    expect(storySentence({ asA: 'estates manager', iWant: 'x', soThat: 'y' })).toMatch(/^As an /)
    expect(criterionSentence({ given: 'a job', when: 'it is accepted', then: 'a text goes' })).toBe(
      'Given a job, when it is accepted, then a text goes.',
    )
  })
})

describe('backlogTable', () => {
  it('exports every story with its criteria, RICE inputs and UAT result in rank order', () => {
    const features = [
      feature('a'),
      feature('b', {
        title: 'Bulk import',
        themes: ['site-data', 'integrations'],
        story: {
          id: 'PS-102',
          asA: 'estates manager',
          iWant: 'to upload a spreadsheet',
          soThat: 'nobody keys it in',
          criteria: [
            { given: 'a file', when: 'I upload it', then: 'sites are added' },
            { given: 'no postcode', when: 'I upload it', then: 'the site is flagged' },
          ],
        },
      }),
    ]
    const ranked = rankFeatures(
      features,
      {
        a: progress({ reach: 1, impact: 1, confidence: 1, effort: 0 }),
        b: progress(
          { reach: 30, impact: 2, confidence: 1, effort: 2 },
          { uat: 'failed', testNote: 'AC2 failed: rejected, not flagged.' },
        ),
      },
      [entry('1', { theme: 'site-data' })],
    )
    const [header, first, second] = backlogTable(ranked, (id) => id.toUpperCase())
    expect(header).toContain('RICE score')
    expect(first).toEqual([
      1,
      'Bulk import',
      'SITE-DATA; INTEGRATIONS',
      1,
      30,
      'High (2)',
      '100%',
      2,
      30,
      'PS-102',
      'As an estates manager, I want to upload a spreadsheet, so that nobody keys it in.',
      'AC1: Given a file, when I upload it, then sites are added.\nAC2: Given no postcode, when I upload it, then the site is flagged.',
      'Failed',
      'AC2 failed: rejected, not flagged.',
    ])
    // An unscored feature exports with blank rank and score rather than failing
    expect(second?.[0]).toBeNull()
    expect(second?.[8]).toBeNull()
    expect(() => toCsv(backlogTable(ranked, (id) => id))).not.toThrow()
  })
})

describe('restoreVoc', () => {
  const defaults: VocState = {
    feedback: [entry('FB-001'), entry('FB-002', { date: AS_OF - DAY })],
    progress: {
      a: progress({ reach: 10, impact: 1, confidence: 0.8, effort: 1 }),
      b: progress({ reach: 20, impact: 2, confidence: 1, effort: 2 }, { uat: 'passed' }),
    },
  }

  it('returns the defaults for anything that is not saved state', () => {
    expect(restoreVoc(null, defaults)).toBe(defaults)
    expect(restoreVoc('saved', defaults)).toBe(defaults)
  })

  it('keeps valid feedback, drops invalid or duplicate entries, and allows an empty log', () => {
    const raw = {
      feedback: [
        entry('FB-U1', { date: AS_OF - 5 * DAY }),
        entry('FB-U1'),
        { ...entry('FB-U2'), side: 'investor' },
        { ...entry('FB-U3'), quote: '' },
        'junk',
        entry('FB-001'),
      ],
    }
    expect(restoreVoc(raw, defaults).feedback.map((f) => f.id)).toEqual(['FB-001', 'FB-U1'])
    expect(restoreVoc({ feedback: [] }, defaults).feedback).toEqual([])
    expect(restoreVoc({}, defaults).feedback).toEqual(defaults.feedback)
  })

  it('restores backlog fields one by one, falling back for anything invalid', () => {
    const raw = {
      progress: {
        a: { rice: { reach: 99, impact: 7, confidence: 0.5, effort: 0 }, uat: 'in-test', testNote: 'Retest' },
        b: { rice: 'high', uat: 'done', testNote: 4 },
        zzz: { uat: 'passed' },
      },
    }
    const { progress: restored } = restoreVoc(raw, defaults)
    expect(restored.a).toEqual({
      rice: { reach: 99, impact: 1, confidence: 0.5, effort: 0 },
      uat: 'in-test',
      testNote: 'Retest',
    })
    expect(restored.b).toEqual(defaults.progress.b)
    expect(Object.keys(restored)).toEqual(['a', 'b'])
  })
})
