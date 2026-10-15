/**
 * Voice of customer → roadmap. Feedback is tagged with a theme; themes roll up into
 * feature requests, and the requests are ranked by RICE: reach × impact × confidence
 * ÷ effort. A request with no effort estimate can't be scored, so it ranks last
 * instead of dividing by zero. Each request carries one user story, tested in UAT
 * against its Given/When/Then acceptance criteria.
 */
import type {
  FeatureProgress,
  FeatureRequest,
  FeedbackEntry,
  RiceInputs,
  SideId,
  ThemeId,
  Timestamp,
  UatStatus,
} from '@/types'
import type { CsvValue } from './csv'
import { SIDES } from './scenario'

export const THEME_IDS: readonly ThemeId[] = [
  'eta-updates',
  'site-data',
  'cost-control',
  'compliance-evidence',
  'remote-cover',
  'responder-payments',
  'parts-sourcing',
  'safety-documents',
  'integrations',
  'partner-referrals',
]

/** Intercom's RICE scale: how much the change moves things for each organisation reached. */
export const IMPACT_LEVELS: readonly { value: number; label: string }[] = [
  { value: 3, label: 'Massive' },
  { value: 2, label: 'High' },
  { value: 1, label: 'Medium' },
  { value: 0.5, label: 'Low' },
  { value: 0.25, label: 'Minimal' },
]

export const CONFIDENCE_LEVELS: readonly { value: number; label: string }[] = [
  { value: 1, label: 'High' },
  { value: 0.8, label: 'Medium' },
  { value: 0.5, label: 'Low' },
]

export const RICE_LIMITS = {
  reach: { min: 0, max: 10_000 },
  effort: { min: 0, max: 120 },
} as const

export const UAT_STATUSES: readonly UatStatus[] = ['not-started', 'in-test', 'passed', 'failed']

export const UAT_STATUS_LABELS: Record<UatStatus, string> = {
  'not-started': 'Not started',
  'in-test': 'In test',
  passed: 'Passed',
  failed: 'Failed',
}

export const TEST_NOTE_MAX_LENGTH = 280
export const QUOTE_MAX_LENGTH = 400
export const ORGANISATION_MAX_LENGTH = 80

const isLevel = (levels: readonly { value: number }[], value: unknown): value is number =>
  levels.some((l) => l.value === value)

const inRange = (value: unknown, { min, max }: { min: number; max: number }): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max

/** Reach × impact × confidence ÷ effort, or null when effort is zero and there's nothing to divide by. */
export function riceScore({ reach, impact, confidence, effort }: RiceInputs): number | null {
  if (!inRange(reach, RICE_LIMITS.reach)) {
    throw new RangeError(`reach must be from 0 to ${RICE_LIMITS.reach.max}, got ${reach}`)
  }
  if (!Number.isFinite(impact) || impact < 0) {
    throw new RangeError(`impact must be a non-negative number, got ${impact}`)
  }
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new RangeError(`confidence must be from 0 to 1, got ${confidence}`)
  }
  if (!inRange(effort, RICE_LIMITS.effort)) {
    throw new RangeError(`effort must be from 0 to ${RICE_LIMITS.effort.max}, got ${effort}`)
  }
  return effort === 0 ? null : (reach * impact * confidence) / effort
}

export interface RankedFeature {
  feature: FeatureRequest
  progress: FeatureProgress
  score: number | null
  /** 1 for the highest score; null when it can't be scored. */
  rank: number | null
  /** Feedback tagged with one of its themes, newest first. */
  mentions: FeedbackEntry[]
}

/** Newest first; on the same day, the entry logged last comes first. */
export const newestFirst = (a: FeedbackEntry, b: FeedbackEntry) =>
  b.date - a.date || b.id.localeCompare(a.id, 'en-GB', { numeric: true })

/** The feedback tagged with one of a feature's themes, newest first. */
export function mentionsOf(feature: FeatureRequest, feedback: readonly FeedbackEntry[]) {
  return feedback.filter((f) => feature.themes.includes(f.theme)).sort(newestFirst)
}

/** How often each theme comes up. */
export function themeCounts(feedback: readonly FeedbackEntry[]): Record<ThemeId, number> {
  const counts = Object.fromEntries(THEME_IDS.map((id) => [id, 0])) as Record<ThemeId, number>
  for (const entry of feedback) counts[entry.theme] += 1
  return counts
}

/**
 * Features by RICE score, highest first. Ties go to the wider reach, then the title.
 * Features that can't be scored come last, unranked.
 */
export function rankFeatures(
  features: readonly FeatureRequest[],
  progress: Readonly<Record<string, FeatureProgress>>,
  feedback: readonly FeedbackEntry[],
): RankedFeature[] {
  const rows = features.map((feature) => {
    const p = progress[feature.id]
    if (!p) throw new RangeError(`No RICE inputs for ${feature.id}`)
    return { feature, progress: p, score: riceScore(p.rice), mentions: mentionsOf(feature, feedback) }
  })
  rows.sort((a, b) => {
    if (a.score === null || b.score === null) {
      if (a.score !== b.score) return a.score === null ? 1 : -1
    } else if (a.score !== b.score) {
      return b.score - a.score
    }
    return (
      b.progress.rice.reach - a.progress.rice.reach ||
      a.feature.title.localeCompare(b.feature.title)
    )
  })
  let rank = 0
  return rows.map((row) => ({ ...row, rank: row.score === null ? null : ++rank }))
}

export interface FeedbackDraft {
  organisation: string
  side: SideId
  quote: string
  theme: ThemeId
  date: Timestamp
}

/**
 * The log with a new entry added, newest first. Entries logged here are numbered
 * FB-U1, FB-U2 … after the highest already used.
 */
export function addFeedback(log: readonly FeedbackEntry[], draft: FeedbackDraft): FeedbackEntry[] {
  const organisation = draft.organisation.trim()
  const quote = draft.quote.trim()
  if (organisation === '' || organisation.length > ORGANISATION_MAX_LENGTH) {
    throw new RangeError(`organisation must be 1 to ${ORGANISATION_MAX_LENGTH} characters`)
  }
  if (quote === '' || quote.length > QUOTE_MAX_LENGTH) {
    throw new RangeError(`quote must be 1 to ${QUOTE_MAX_LENGTH} characters`)
  }
  if (!SIDES.includes(draft.side)) throw new RangeError(`Unknown side: ${String(draft.side)}`)
  if (!THEME_IDS.includes(draft.theme)) throw new RangeError(`Unknown theme: ${String(draft.theme)}`)
  if (!Number.isFinite(draft.date)) throw new RangeError(`date must be a finite time`)
  const used = log.map((f) => /^FB-U(\d+)$/.exec(f.id)?.[1]).map(Number).filter(Number.isFinite)
  const entry: FeedbackEntry = {
    ...draft,
    organisation,
    quote,
    id: `FB-U${Math.max(0, ...used) + 1}`,
  }
  return [entry, ...log].sort(newestFirst)
}

/** "Given …, when …, then …", for one-line views and exports. */
export function criterionSentence({ given, when, then }: { given: string; when: string; then: string }) {
  return `Given ${given}, when ${when}, then ${then}.`
}

/** "a duty manager", "an estates manager". */
export function withArticle(role: string): string {
  return `${/^[aeiou]/i.test(role) ? 'an' : 'a'} ${role}`
}

/** "As a …, I want …, so that …". */
export function storySentence({ asA, iWant, soThat }: { asA: string; iWant: string; soThat: string }) {
  return `As ${withArticle(asA)}, I want ${iWant}, so that ${soThat}.`
}

const levelLabel = (levels: readonly { value: number; label: string }[], value: number) =>
  levels.find((l) => l.value === value)?.label ?? String(value)

/**
 * The backlog as a CSV table, in rank order: one row per story, with its acceptance
 * criteria in one cell, a line each.
 */
export function backlogTable(
  ranked: readonly RankedFeature[],
  themeLabel: (id: ThemeId) => string,
): CsvValue[][] {
  const header = [
    'Rank',
    'Feature request',
    'Themes',
    'Feedback mentions',
    'Reach (organisations a quarter)',
    'Impact',
    'Confidence',
    'Effort (person-months)',
    'RICE score',
    'Story ID',
    'User story',
    'Acceptance criteria',
    'UAT status',
    'Test note',
  ]
  const rows = ranked.map(({ feature, progress, score, rank, mentions }): CsvValue[] => [
    rank,
    feature.title,
    feature.themes.map(themeLabel).join('; '),
    mentions.length,
    progress.rice.reach,
    `${levelLabel(IMPACT_LEVELS, progress.rice.impact)} (${progress.rice.impact})`,
    `${Math.round(progress.rice.confidence * 100)}%`,
    progress.rice.effort,
    score === null ? null : Math.round(score * 10) / 10,
    feature.story.id,
    storySentence(feature.story),
    feature.story.criteria.map((c, i) => `AC${i + 1}: ${criterionSentence(c)}`).join('\n'),
    UAT_STATUS_LABELS[progress.uat],
    progress.testNote,
  ])
  return [header, ...rows]
}

export interface VocState {
  feedback: FeedbackEntry[]
  progress: Record<string, FeatureProgress>
}

function restoreEntry(raw: unknown): FeedbackEntry | null {
  if (typeof raw !== 'object' || raw === null) return null
  const e = raw as Record<string, unknown>
  const text = (value: unknown, max: number) =>
    typeof value === 'string' && value.trim() !== '' && value.length <= max
  if (
    typeof e.id !== 'string' ||
    !text(e.organisation, ORGANISATION_MAX_LENGTH) ||
    !text(e.quote, QUOTE_MAX_LENGTH) ||
    !SIDES.includes(e.side as SideId) ||
    !THEME_IDS.includes(e.theme as ThemeId) ||
    typeof e.date !== 'number' ||
    !Number.isFinite(e.date)
  ) {
    return null
  }
  return {
    id: e.id,
    organisation: e.organisation as string,
    side: e.side as SideId,
    quote: e.quote as string,
    theme: e.theme as ThemeId,
    date: e.date,
  }
}

function restoreProgress(raw: unknown, fallback: FeatureProgress): FeatureProgress {
  if (typeof raw !== 'object' || raw === null) return fallback
  const p = raw as Record<string, unknown>
  const rice = (typeof p.rice === 'object' && p.rice !== null ? p.rice : {}) as Record<
    string,
    unknown
  >
  return {
    rice: {
      reach: inRange(rice.reach, RICE_LIMITS.reach) ? rice.reach : fallback.rice.reach,
      impact: isLevel(IMPACT_LEVELS, rice.impact) ? rice.impact : fallback.rice.impact,
      confidence: isLevel(CONFIDENCE_LEVELS, rice.confidence)
        ? rice.confidence
        : fallback.rice.confidence,
      effort: inRange(rice.effort, RICE_LIMITS.effort) ? rice.effort : fallback.rice.effort,
    },
    uat: UAT_STATUSES.includes(p.uat as UatStatus) ? (p.uat as UatStatus) : fallback.uat,
    testNote:
      typeof p.testNote === 'string' ? p.testNote.slice(0, TEST_NOTE_MAX_LENGTH) : fallback.testNote,
  }
}

/**
 * Saved feedback and backlog edits, checked item by item. Invalid feedback entries are
 * dropped; invalid backlog fields fall back to their defaults.
 */
export function restoreVoc(raw: unknown, defaults: VocState): VocState {
  if (typeof raw !== 'object' || raw === null) return defaults
  const r = raw as Record<string, unknown>
  const entries = Array.isArray(r.feedback)
    ? r.feedback.map(restoreEntry).filter((e) => e !== null)
    : defaults.feedback
  const unique = entries.filter((e, i) => entries.findIndex((x) => x.id === e.id) === i)
  const saved = (typeof r.progress === 'object' && r.progress !== null ? r.progress : {}) as Record<
    string,
    unknown
  >
  const progress = Object.fromEntries(
    Object.entries(defaults.progress).map(([id, fallback]) => [
      id,
      restoreProgress(saved[id], fallback),
    ]),
  )
  return { feedback: unique.sort(newestFirst), progress }
}
