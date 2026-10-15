/**
 * Alternatives and positioning: how organisations handle an HV emergency today,
 * rated Strong, Partial or Weak on six factors against PowerSOS, and a positioning
 * statement built from the result. The alternatives are generic categories, never
 * named companies. Ratings and notes are assumptions, to test with customers.
 */
import type { SectorId } from '@/types'
import { formatList } from './format'

export type AlternativeId = 'in-house' | 'maintenance-contract' | 'framework' | 'ad-hoc'
export type OptionId = AlternativeId | 'powersos'

export interface OptionInfo {
  id: OptionId
  label: string
  /** As it reads after "unlike": "an in-house authorised person". */
  phrase: string
}

export const ALTERNATIVES: readonly (OptionInfo & { id: AlternativeId })[] = [
  {
    id: 'in-house',
    label: 'In-house authorised person',
    phrase: 'an in-house authorised person',
  },
  {
    id: 'maintenance-contract',
    label: 'Annual maintenance contract with an HV contractor',
    phrase: 'an annual maintenance contract with an HV contractor',
  },
  {
    id: 'framework',
    label: 'Term or framework contractor',
    phrase: 'a term or framework contractor',
  },
  { id: 'ad-hoc', label: 'Ad-hoc phone search', phrase: 'an ad-hoc phone search' },
]

export const OPTIONS: readonly OptionInfo[] = [
  ...ALTERNATIVES,
  { id: 'powersos', label: 'PowerSOS', phrase: 'PowerSOS' },
]

export type FactorId =
  'response' | 'cost-certainty' | 'cover' | 'visibility' | 'compliance' | 'setup'

export interface Factor {
  id: FactorId
  label: string
  /** The label as it reads mid-sentence. */
  phrase: string
  /** What Strong means, so every factor reads the same way round. */
  strong: string
  /** What PowerSOS does, as it reads after "that", when it wins on this factor. */
  benefit: string
}

export const FACTORS: readonly Factor[] = [
  {
    id: 'response',
    label: 'Response time',
    phrase: 'response time',
    strong: 'An authorised engineer on site fast',
    benefit: 'gets a vetted, HV-authorised responder to site against a 75-minute target',
  },
  {
    id: 'cost-certainty',
    label: 'Cost certainty',
    phrase: 'cost certainty',
    strong: 'The cost is known and agreed up front',
    benefit: 'predicts the cost for approval before work starts',
  },
  {
    id: 'cover',
    label: '24/7 cover',
    phrase: '24/7 cover',
    strong: 'Cover at any hour, every day',
    benefit: 'answers at any hour, every day of the year',
  },
  {
    id: 'visibility',
    label: 'Multi-site visibility',
    phrase: 'multi-site visibility',
    strong: 'Every site, job and cost in one view',
    benefit: 'shows every site, its equipment and its spend in one place',
  },
  {
    id: 'compliance',
    label: 'Compliance evidence',
    phrase: 'compliance evidence',
    strong: 'Authorisation, insurance and audits on record',
    benefit: 'checks authorisation and insurance before every match',
  },
  {
    id: 'setup',
    label: 'Set-up effort',
    phrase: 'set-up effort',
    strong: 'Little to do before it works',
    benefit: 'is ready as soon as the sites are loaded',
  },
]

export type Rating = 'strong' | 'partial' | 'weak'

export const RATINGS: readonly Rating[] = ['strong', 'partial', 'weak']

export const RATING_LABELS: Record<Rating, string> = {
  strong: 'Strong',
  partial: 'Partial',
  weak: 'Weak',
}

const RATING_VALUE: Record<Rating, number> = { weak: 0, partial: 1, strong: 2 }

export const NOTE_MAX_LENGTH = 90

export interface Cell {
  rating: Rating
  note: string
}

export type Comparison = Record<OptionId, Record<FactorId, Cell>>

const cell = (rating: Rating, note: string): Cell => ({ rating, note })

/** Assumptions, to test with customers. PowerSOS's notes rest only on its public claims. */
export const DEFAULT_COMPARISON: Comparison = {
  'in-house': {
    response: cell('partial', 'Fast when on site; slow at night or at remote sites'),
    'cost-certainty': cell('partial', 'Salaried, but overtime and contractor top-ups vary'),
    cover: cell('weak', 'One or two people cannot cover every hour'),
    visibility: cell('partial', 'Knows the home sites well; little view across an estate'),
    compliance: cell('strong', 'Own authorisation records and safety rules'),
    setup: cell('weak', 'Recruit, train and authorise staff'),
  },
  'maintenance-contract': {
    response: cell('partial', 'Emergency response often best endeavours'),
    'cost-certainty': cell('partial', 'Fixed fee for planned work; call-outs charged extra'),
    cover: cell('partial', "Depends on the contractor's on-call rota"),
    visibility: cell('partial', 'Reports per site, rarely joined up'),
    compliance: cell('strong', 'Maintenance and test records kept by the contractor'),
    setup: cell('partial', 'Tender, contract and site surveys'),
  },
  framework: {
    response: cell('partial', 'Response times set in the contract, from one supplier'),
    'cost-certainty': cell('partial', 'Agreed schedule of rates; the final bill varies'),
    cover: cell('partial', 'On-call cover where the contract includes it'),
    visibility: cell('partial', 'One contractor per region or lot'),
    compliance: cell('strong', 'Vetted at procurement; records held under the contract'),
    setup: cell('weak', 'A procurement process that takes months'),
  },
  'ad-hoc': {
    response: cell('weak', 'Time lost finding someone available and authorised'),
    'cost-certainty': cell('weak', 'Emergency rates agreed under pressure'),
    cover: cell('weak', 'Hardest to find anyone at night or at weekends'),
    visibility: cell('weak', 'Nothing joined up'),
    compliance: cell('weak', 'Authorisation and insurance checked in a hurry, if at all'),
    setup: cell('strong', 'Nothing to set up until something goes wrong'),
  },
  powersos: {
    response: cell('strong', 'Nearest available authorised responder; 75-minute target'),
    'cost-certainty': cell('strong', 'Membership, plus cost prediction and approval per job'),
    cover: cell('strong', '24/7 across mainland UK'),
    visibility: cell('strong', 'Every site, its equipment and spend in one place'),
    compliance: cell('strong', 'Vetted, HV-authorised responders, audited for competence'),
    setup: cell('partial', 'Load sites, equipment, contacts and approval limits'),
  },
}

export type Outcome = 'wins' | 'level' | 'behind'

export interface FactorVerdict {
  factor: FactorId
  powersos: Rating
  /** The best rating any alternative has. */
  best: Rating
  /** Alternatives rated above PowerSOS, best first. */
  ahead: AlternativeId[]
  outcome: Outcome
}

/** PowerSOS against the best alternative on each factor. */
export function factorVerdicts(comparison: Comparison): FactorVerdict[] {
  return FACTORS.map((f) => {
    const own = RATING_VALUE[comparison.powersos[f.id].rating]
    const rated = ALTERNATIVES.map((a) => ({
      id: a.id,
      value: RATING_VALUE[comparison[a.id][f.id].rating],
    }))
    const bestValue = Math.max(...rated.map((r) => r.value))
    const ahead = rated
      .filter((r) => r.value > own)
      .sort((a, b) => b.value - a.value)
      .map((r) => r.id)
    return {
      factor: f.id,
      powersos: comparison.powersos[f.id].rating,
      best: RATINGS.find((r) => RATING_VALUE[r] === bestValue) ?? 'weak',
      ahead,
      outcome: own > bestValue ? 'wins' : own === bestValue ? 'level' : 'behind',
    }
  })
}

export interface ComparisonSummary {
  wins: FactorId[]
  level: FactorId[]
  behind: FactorId[]
  /** Where PowerSOS is furthest behind, or its lowest-rated factors when it is never behind. */
  weakest: FactorId[]
  winsSentence: string
  weakestSentence: string
}

const factor = (id: FactorId): Factor => {
  const found = FACTORS.find((f) => f.id === id)
  if (!found) throw new Error(`Unknown factor: ${id}`)
  return found
}
const alternative = (id: AlternativeId) => ALTERNATIVES.find((a) => a.id === id)?.phrase ?? id
const phrases = (ids: readonly FactorId[]) => formatList(ids.map((id) => factor(id).phrase))

/** Where PowerSOS wins and where it is weakest, in a sentence each. */
export function summariseComparison(comparison: Comparison): ComparisonSummary {
  const verdicts = factorVerdicts(comparison)
  const pick = (outcome: Outcome) => verdicts.filter((v) => v.outcome === outcome)
  const wins = pick('wins').map((v) => v.factor)
  const level = pick('level').map((v) => v.factor)
  const behindVerdicts = pick('behind').sort(
    (a, b) =>
      RATING_VALUE[b.best] -
      RATING_VALUE[b.powersos] -
      (RATING_VALUE[a.best] - RATING_VALUE[a.powersos]),
  )
  const behind = behindVerdicts.map((v) => v.factor)

  const winsSentence =
    wins.length === 0
      ? 'In the current ratings, PowerSOS does not beat every alternative on any factor.'
      : `PowerSOS wins on ${phrases(wins)}: no alternative is rated as highly.${
          level.length > 0 ? ` It matches the best alternative on ${phrases(level)}.` : ''
        }`

  let weakest: FactorId[]
  let weakestSentence: string
  if (behindVerdicts.length > 0) {
    weakest = behind
    weakestSentence = `Weakest on ${formatList(
      behindVerdicts.map(
        (v) =>
          `${factor(v.factor).phrase} (${RATING_LABELS[v.powersos]}, behind ${formatList(
            v.ahead.map(alternative),
          )})`,
      ),
    )}.`
  } else {
    const lowest = Math.min(...verdicts.map((v) => RATING_VALUE[v.powersos]))
    weakest =
      lowest === RATING_VALUE.strong
        ? []
        : verdicts.filter((v) => RATING_VALUE[v.powersos] === lowest).map((v) => v.factor)
    weakestSentence =
      weakest.length === 0
        ? 'No weak spots in the current ratings: worth testing them with customers.'
        : `Never behind an alternative, but only ${RATING_LABELS[verdicts.find((v) => v.factor === weakest[0])?.powersos ?? 'weak'].toLowerCase()} on ${phrases(weakest)}.`
  }

  return { wins, level, behind, weakest, winsSentence, weakestSentence }
}

export type PositioningField = 'segment' | 'need' | 'category' | 'benefit' | 'alternative'

export const POSITIONING_FIELDS: readonly {
  id: PositioningField
  label: string
  /** The words before the field, as a label. */
  lead: string
  /** The same words as they sit in the sentence. */
  before: string
}[] = [
  { id: 'segment', label: 'Segment', lead: 'For', before: 'For ' },
  { id: 'need', label: 'Need', lead: 'who', before: ' who ' },
  { id: 'category', label: 'Category', lead: 'PowerSOS is', before: ', PowerSOS is ' },
  { id: 'benefit', label: 'Benefit', lead: 'that', before: ' that ' },
  { id: 'alternative', label: 'Alternative', lead: 'unlike', before: ', unlike ' },
]

export const POSITIONING_MAX_LENGTH = 160

export type Positioning = Record<PositioningField, string>

/** Who each sector's buyers are, what they need, and what they mostly rely on today. */
export const SECTOR_POSITIONING: Record<
  SectorId,
  { segment: string; need: string; alternative: AlternativeId }
> = {
  medical: {
    segment: 'hospital and healthcare estates teams',
    need: 'must restore power to clinical services safely at any hour',
    alternative: 'in-house',
  },
  education: {
    segment: 'university and college estates teams',
    need: 'run campus HV networks with a small team and no night cover',
    alternative: 'maintenance-contract',
  },
  hospitality: {
    segment: 'hotel and leisure groups',
    need: 'own HV equipment but have nobody authorised to work on it',
    alternative: 'ad-hoc',
  },
  manufacturing: {
    segment: 'manufacturers',
    need: 'lose production and stock for every hour a line stands still',
    alternative: 'maintenance-contract',
  },
  aviation: {
    segment: 'airport tenants such as cargo and aircraft maintenance operators',
    need: 'cannot let a power fault stop operations',
    alternative: 'in-house',
  },
  warehousing: {
    segment: 'logistics and cold-storage operators',
    need: 'run many sites with no electrical staff on any of them',
    alternative: 'ad-hoc',
  },
  agriculture: {
    segment: 'farms and growers',
    need: 'are a long way from the nearest HV contractor',
    alternative: 'ad-hoc',
  },
  power: {
    segment: 'solar, wind and battery storage operators',
    need: 'lose export revenue for every hour a site is off',
    alternative: 'framework',
  },
  telecoms: {
    segment: 'data centre and telecoms operators',
    need: 'cannot risk a single site losing power',
    alternative: 'maintenance-contract',
  },
}

export const DEFAULT_CATEGORY = 'a 24/7 emergency response platform for private HV networks'

/**
 * A statement filled from a sector: its buyers, their need and the alternative they
 * rely on today. The benefit is where PowerSOS beats that alternative by most: up to
 * two factors, read in table order. If it beats it on nothing, the benefit falls back
 * to where PowerSOS is rated Strong.
 */
export function suggestedPositioning(sector: SectorId, comparison: Comparison): Positioning {
  const seed = SECTOR_POSITIONING[sector]
  const value = (option: OptionId, id: FactorId) => RATING_VALUE[comparison[option][id].rating]
  const versus = FACTORS.map((f) => ({
    id: f.id,
    gap: value('powersos', f.id) - value(seed.alternative, f.id),
  }))
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .map((g) => g.id)
  const strongest = FACTORS.filter((f) => comparison.powersos[f.id].rating === 'strong').map(
    (f) => f.id,
  )
  const chosen = (versus.length > 0 ? versus : strongest).slice(0, 2)
  const lead = FACTORS.filter((f) => chosen.includes(f.id))
  return {
    segment: seed.segment,
    need: seed.need,
    category: DEFAULT_CATEGORY,
    benefit:
      lead.length === 0
        ? 'connects private HV networks with vetted, HV-authorised responders'
        : formatList(lead.map((f) => f.benefit)),
    alternative: ALTERNATIVES.find((a) => a.id === seed.alternative)?.phrase ?? '',
  }
}

/** The fields with any edits applied over the suggestion, blank edits ignored. */
export function applyEdits(suggested: Positioning, edits: Partial<Positioning>): Positioning {
  return Object.fromEntries(
    POSITIONING_FIELDS.map(({ id }) => {
      const edit = edits[id]?.trim()
      return [id, edit ? edit : suggested[id]]
    }),
  ) as Positioning
}

export interface StatementPart {
  field: PositioningField
  before: string
  /** The field's text, trimmed of stray punctuation so the sentence stays well formed. */
  text: string
}

/** The statement in order: the fixed words before each field, then the field. */
export function positioningParts(p: Positioning): StatementPart[] {
  return POSITIONING_FIELDS.map(({ id, before }) => ({
    field: id,
    before,
    text: p[id].trim().replace(/[.,;:]+$/, ''),
  }))
}

/** "For [segment] who [need], PowerSOS is [category] that [benefit], unlike [alternative]." */
export function positioningStatement(p: Positioning): string {
  return `${positioningParts(p)
    .map((part) => part.before + part.text)
    .join('')}.`
}

export interface AlternativesInputs {
  comparison: Comparison
  /** Fields the viewer has rewritten; the rest follow the current top sector. */
  positioning: Partial<Positioning>
}

export const DEFAULT_ALTERNATIVES_INPUTS: AlternativesInputs = {
  comparison: DEFAULT_COMPARISON,
  positioning: {},
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isRating = (value: unknown): value is Rating => RATINGS.some((r) => r === value)

/** Saved inputs, checked cell by cell; anything invalid falls back to its default. */
export function restoreAlternativesInputs(
  raw: unknown,
  defaults: AlternativesInputs,
): AlternativesInputs {
  if (!isRecord(raw)) return defaults
  const comparison = isRecord(raw.comparison) ? raw.comparison : {}
  const positioning = isRecord(raw.positioning) ? raw.positioning : {}
  return {
    comparison: Object.fromEntries(
      OPTIONS.map((o) => {
        const column = isRecord(comparison[o.id])
          ? (comparison[o.id] as Record<string, unknown>)
          : {}
        return [
          o.id,
          Object.fromEntries(
            FACTORS.map((f) => {
              const saved = column[f.id]
              const fallback = defaults.comparison[o.id][f.id]
              if (!isRecord(saved)) return [f.id, fallback]
              return [
                f.id,
                {
                  rating: isRating(saved.rating) ? saved.rating : fallback.rating,
                  note:
                    typeof saved.note === 'string'
                      ? saved.note.slice(0, NOTE_MAX_LENGTH)
                      : fallback.note,
                },
              ]
            }),
          ),
        ]
      }),
    ) as Comparison,
    positioning: Object.fromEntries(
      POSITIONING_FIELDS.flatMap(({ id }) => {
        const saved = positioning[id]
        return typeof saved === 'string' && saved.trim() !== ''
          ? [[id, saved.slice(0, POSITIONING_MAX_LENGTH)]]
          : []
      }),
    ),
  }
}
