/**
 * Early-adopter CRM and events planner.
 *
 * The leads sit on a board of seven deal stages. Each deal is valued at what the lead
 * would pay a year on its recommended tier, at the pricing defaults, and weighted by
 * how likely deals at its stage are to close. The stages, probabilities and
 * thresholds are assumptions. Time is measured to the data date, never the real
 * clock, so the board reads the same on every load.
 *
 * Where a lead starts: its recorded stage maps onto the board, and the last recorded
 * contact is taken as the day it entered that stage (the day it joined, for leads
 * nobody has contacted). Lost leads leave the board but still count in conversion.
 */
import type {
  EventObjective,
  EventPlan,
  EventStatus,
  Lead,
  LeadSource,
  SectorId,
  Timestamp,
} from '@/types'
import { DAY_MS } from './time'

export type PipelineStage =
  'lead' | 'discovery' | 'demo' | 'proposal' | 'negotiation' | 'onboarding' | 'live'

export interface StageInfo {
  id: PipelineStage
  label: string
  /** Assumption: the share of deals at this stage that go live. */
  probability: number
  nextAction: string
}

export const PIPELINE_STAGES: readonly StageInfo[] = [
  { id: 'lead', label: 'Lead', probability: 0.05, nextAction: 'Book a discovery call' },
  {
    id: 'discovery',
    label: 'Discovery',
    probability: 0.15,
    nextAction: 'Get the full site list and book a demo',
  },
  { id: 'demo', label: 'Demo', probability: 0.3, nextAction: 'Send a tailored proposal' },
  {
    id: 'proposal',
    label: 'Proposal',
    probability: 0.5,
    nextAction: 'Follow up on the proposal',
  },
  {
    id: 'negotiation',
    label: 'Negotiation',
    probability: 0.7,
    nextAction: 'Agree the site count and start date',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    probability: 0.9,
    nextAction: 'Load sites and log equipment',
  },
  { id: 'live', label: 'Live', probability: 1, nextAction: 'Book the 90-day review' },
]

/** Proposal or later: the point at which a lead counts as converted. */
export const CONVERTED_FROM: PipelineStage = 'proposal'
/** Days in a stage before a deal is slowing (amber) and stuck (red). */
export const AMBER_AFTER_DAYS = 14
export const RED_AFTER_DAYS = 30

export const LEAD_SOURCES: readonly LeadSource[] = [
  'partner-referral',
  'trade-show',
  'inbound',
  'outbound',
]

export function stageInfo(id: PipelineStage): StageInfo {
  const stage = PIPELINE_STAGES.find((s) => s.id === id)
  if (!stage) throw new Error(`Unknown pipeline stage: ${id}`)
  return stage
}

const stageIndex = (id: PipelineStage) => PIPELINE_STAGES.findIndex((s) => s.id === id)

export function isPipelineStage(value: unknown): value is PipelineStage {
  return PIPELINE_STAGES.some((s) => s.id === value)
}

/** Where a deal is and since when. */
export interface CardState {
  stage: PipelineStage
  enteredAt: Timestamp
}

/** Cards moved on the board, by lead ID. Leads not in here are where the data puts them. */
export type BoardMoves = Readonly<Record<string, CardState>>

/** Where a lead sits before anyone moves it, or null for a lost lead, which leaves the board. */
export function startingCard(lead: Lead, demoHeld: boolean): CardState | null {
  const enteredAt = lead.lastContactAt ?? lead.createdAt
  switch (lead.stage) {
    case 'wait-list':
    case 'contacted':
      return { stage: 'lead', enteredAt }
    case 'discovery':
      return { stage: demoHeld ? 'demo' : 'discovery', enteredAt }
    case 'proposal':
    case 'negotiation':
      return { stage: lead.stage, enteredAt }
    case 'lost':
      return null
  }
}

/** Whole days from `from` to `to`; zero if `from` is later. */
export function daysBetween(from: Timestamp, to: Timestamp): number {
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    throw new RangeError(`daysBetween() needs finite times, got ${from} and ${to}`)
  }
  return Math.max(0, Math.floor((to - from) / DAY_MS))
}

export type StageAge = 'ok' | 'slowing' | 'stuck'

/** Amber after 14 days in a stage, red after 30. */
export function stageAge(days: number): StageAge {
  if (!Number.isFinite(days) || days < 0) {
    throw new RangeError(`days must be a non-negative number, got ${days}`)
  }
  if (days > RED_AFTER_DAYS) return 'stuck'
  return days > AMBER_AFTER_DAYS ? 'slowing' : 'ok'
}

/** The next thing to do for a deal. Leads nobody has contacted yet need a first contact. */
export function nextAction(stage: PipelineStage, lead: Lead, partnerName?: string): string {
  if (stage === 'lead' && lead.lastContactAt === null) {
    return partnerName ? `Ask ${partnerName} for an introduction` : 'Make first contact'
  }
  return stageInfo(stage).nextAction
}

export interface PipelineCard {
  lead: Lead
  stage: PipelineStage
  enteredAt: Timestamp
  daysInStage: number
  age: StageAge
  /** What the lead would pay a year on its recommended tier. */
  annualValue: number
  /** Annual value × the stage's probability. */
  weightedValue: number
  /** Moved on the board rather than where the data puts it. */
  moved: boolean
}

export interface Board {
  /** In stage order, longest in the stage first. */
  cards: PipelineCard[]
  /** Leads recorded as lost: off the board. */
  lost: Lead[]
}

export interface BoardOptions {
  asOf: Timestamp
  /** Whether a lead in discovery has already seen a demo. */
  demoHeld: (lead: Lead) => boolean
  annualValue: (lead: Lead) => number
}

export function buildBoard(
  leads: readonly Lead[],
  moves: BoardMoves,
  { asOf, demoHeld, annualValue }: BoardOptions,
): Board {
  const cards: PipelineCard[] = []
  const lost: Lead[] = []
  for (const lead of leads) {
    const starting = startingCard(lead, demoHeld(lead))
    if (!starting) {
      lost.push(lead)
      continue
    }
    const moved = moves[lead.id]
    const { stage, enteredAt } = moved ?? starting
    const value = annualValue(lead)
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${lead.id}: annual value must be a non-negative number, got ${value}`)
    }
    const daysInStage = daysBetween(enteredAt, asOf)
    cards.push({
      lead,
      stage,
      enteredAt,
      daysInStage,
      age: stageAge(daysInStage),
      annualValue: value,
      weightedValue: value * stageInfo(stage).probability,
      moved: moved !== undefined,
    })
  }
  cards.sort(
    (a, b) =>
      stageIndex(a.stage) - stageIndex(b.stage) ||
      b.daysInStage - a.daysInStage ||
      a.lead.id.localeCompare(b.lead.id),
  )
  return { cards, lost }
}

/**
 * The moves after sending a lead to `to` on day `at`. Sending it back to where the
 * data puts it drops the move, so its original date returns; sending it to the stage
 * it is already in changes nothing.
 */
export function moveCard(
  moves: BoardMoves,
  leadId: string,
  to: PipelineStage,
  at: Timestamp,
  starting: CardState | null,
): BoardMoves {
  if (!isPipelineStage(to)) throw new RangeError(`Unknown pipeline stage: ${String(to)}`)
  if (!Number.isFinite(at)) throw new RangeError(`at must be a finite time, got ${at}`)
  const current = moves[leadId]?.stage ?? starting?.stage
  if (current === to) return moves
  const { [leadId]: _previous, ...rest } = moves
  return to === starting?.stage ? rest : { ...rest, [leadId]: { stage: to, enteredAt: at } }
}

/** Saved moves, keeping only valid ones for leads that still exist. */
export function restoreBoardMoves(raw: unknown, leadIds: ReadonlySet<string>): BoardMoves {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const moves: Record<string, CardState> = {}
  for (const [id, value] of Object.entries(raw)) {
    if (!leadIds.has(id) || typeof value !== 'object' || value === null) continue
    const { stage, enteredAt } = value as Record<string, unknown>
    if (isPipelineStage(stage) && typeof enteredAt === 'number' && Number.isFinite(enteredAt)) {
      moves[id] = { stage, enteredAt }
    }
  }
  return moves
}

export interface BoardFilters {
  sector: SectorId | 'all'
  source: LeadSource | 'all'
}

/** The cards and lost leads that match the filters. */
export function filterBoard(board: Board, { sector, source }: BoardFilters): Board {
  const keep = (lead: Lead) =>
    (sector === 'all' || lead.sector === sector) && (source === 'all' || lead.source === source)
  return {
    cards: board.cards.filter((card) => keep(card.lead)),
    lost: board.lost.filter(keep),
  }
}

/** Probability-weighted value of every card on the board, per year. */
export function weightedPipelineValue(cards: readonly PipelineCard[]): number {
  return cards.reduce((total, card) => total + card.weightedValue, 0)
}

/** What every card on the board would be worth a year if all of them went live. */
export function unweightedPipelineValue(cards: readonly PipelineCard[]): number {
  return cards.reduce((total, card) => total + card.annualValue, 0)
}

export interface StageTotal {
  stage: StageInfo
  cards: number
  value: number
  weightedValue: number
}

export function stageTotals(cards: readonly PipelineCard[]): StageTotal[] {
  return PIPELINE_STAGES.map((stage) => {
    const inStage = cards.filter((c) => c.stage === stage.id)
    return {
      stage,
      cards: inStage.length,
      value: unweightedPipelineValue(inStage),
      weightedValue: weightedPipelineValue(inStage),
    }
  })
}

export interface SourceConversion {
  source: LeadSource
  /** On the board or lost. */
  leads: number
  /** At proposal or later. */
  converted: number
  /** Onboarding or live. */
  won: number
  lost: number
  /** Converted ÷ leads; null with no leads. */
  rate: number | null
}

/**
 * Lead-to-proposal conversion for each source. Lost leads count as not converted:
 * the data doesn't say how far they got.
 */
export function conversionBySource(board: Board): SourceConversion[] {
  const from = stageIndex(CONVERTED_FROM)
  const wonFrom = stageIndex('onboarding')
  return LEAD_SOURCES.map((source) => {
    const cards = board.cards.filter((c) => c.lead.source === source)
    const lost = board.lost.filter((l) => l.source === source).length
    const converted = cards.filter((c) => stageIndex(c.stage) >= from).length
    const leads = cards.length + lost
    return {
      source,
      leads,
      converted,
      won: cards.filter((c) => stageIndex(c.stage) >= wonFrom).length,
      lost,
      rate: leads === 0 ? null : converted / leads,
    }
  })
}

/** Deals over 30 days in their stage, most weighted value at risk first. Live deals are done. */
export function stuckDeals(cards: readonly PipelineCard[]): PipelineCard[] {
  return cards
    .filter((c) => c.age === 'stuck' && c.stage !== 'live')
    .sort(
      (a, b) =>
        b.weightedValue - a.weightedValue ||
        b.daysInStage - a.daysInStage ||
        a.lead.id.localeCompare(b.lead.id),
    )
}

/** Where the proposal generator opens: the deal at Proposal worth most a year, or the first deal. */
export function defaultProposalLead(cards: readonly PipelineCard[]): PipelineCard | undefined {
  const atProposal = cards.filter((c) => c.stage === 'proposal')
  const best = atProposal.reduce<PipelineCard | undefined>(
    (top, c) => (top === undefined || c.annualValue > top.annualValue ? c : top),
    undefined,
  )
  return best ?? cards[0]
}

// Events planner

export const EVENT_OBJECTIVES: readonly EventObjective[] = [
  'leads',
  'responder-recruitment',
  'partner-meetings',
]
export const EVENT_STATUSES: readonly EventStatus[] = [
  'idea',
  'researching',
  'booked',
  'attended',
  'not-going',
]
export const EVENT_BUDGET_MAX = 100_000
export const EVENT_TEXT_MAX_LENGTH = 80

export interface EventBudget {
  /** Every event not ruled out. */
  planned: number
  booked: number
  byObjective: Record<EventObjective, number>
  /** Events whose name and date still need checking. */
  toVerify: number
}

/** Budget for the events still in the plan, by objective. "Not going" counts for nothing. */
export function eventBudget(events: readonly EventPlan[]): EventBudget {
  const inPlan = events.filter((e) => e.status !== 'not-going')
  const total = (list: readonly EventPlan[]) => list.reduce((sum, e) => sum + e.budget, 0)
  return {
    planned: total(inPlan),
    booked: total(inPlan.filter((e) => e.status === 'booked' || e.status === 'attended')),
    byObjective: Object.fromEntries(
      EVENT_OBJECTIVES.map((o) => [o, total(inPlan.filter((e) => e.objective === o))]),
    ) as Record<EventObjective, number>,
    toVerify: inPlan.filter((e) => !e.verified).length,
  }
}

/**
 * Saved events, matched to the defaults by ID. The editable fields are checked one by
 * one and fall back to the default when invalid; the event types themselves always
 * come from the defaults.
 */
export function restoreEvents(raw: unknown, defaults: readonly EventPlan[]): EventPlan[] {
  if (!Array.isArray(raw)) return [...defaults]
  const saved = new Map<string, Record<string, unknown>>()
  for (const item of raw) {
    if (typeof item === 'object' && item !== null && typeof item.id === 'string') {
      saved.set(item.id, item as Record<string, unknown>)
    }
  }
  const text = (value: unknown, fallback: string) =>
    typeof value === 'string' ? value.slice(0, EVENT_TEXT_MAX_LENGTH) : fallback
  return defaults.map((event) => {
    const s = saved.get(event.id)
    if (!s) return event
    return {
      ...event,
      name: text(s.name, event.name),
      date: text(s.date, event.date),
      objective: EVENT_OBJECTIVES.includes(s.objective as EventObjective)
        ? (s.objective as EventObjective)
        : event.objective,
      status: EVENT_STATUSES.includes(s.status as EventStatus)
        ? (s.status as EventStatus)
        : event.status,
      budget:
        typeof s.budget === 'number' && s.budget >= 0 && s.budget <= EVENT_BUDGET_MAX
          ? s.budget
          : event.budget,
      verified: typeof s.verified === 'boolean' ? s.verified : event.verified,
    }
  })
}
