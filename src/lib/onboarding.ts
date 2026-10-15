/**
 * Onboarding funnels and checklists for the four sides of the ecosystem.
 *
 * Every organisation moves through four dated stages: aware, engaged (had a demo),
 * signed and onboarded (finished its checklist and went live). The funnel adds a
 * fifth step, active in the last 90 days, measured as at the data date.
 *
 * Funnels count from the stage dates, not the recorded stage: an organisation has
 * reached a stage when it, or any later stage, has a date on or before the data date.
 * The recorded stage is checked against the dates by the data-quality rules.
 */
import type {
  ChecklistEntry,
  ChecklistItemId,
  OnboardingRecord,
  OnboardingStage,
  SideId,
  Timestamp,
} from '@/types'
import { median } from './costs'
import { formatNumber, formatPercent } from './format'
import { DAY_MS } from './time'

export const STAGES: readonly OnboardingStage[] = ['aware', 'engaged', 'signed', 'onboarded']

export type FunnelStep = OnboardingStage | 'active'
export const FUNNEL_STEPS: readonly FunnelStep[] = [...STAGES, 'active']

export const STEP_LABELS: Record<FunnelStep, string> = {
  aware: 'Aware',
  engaged: 'Demo / engaged',
  signed: 'Signed',
  onboarded: 'Onboarded',
  active: 'Active in last 90 days',
}

/** Shorter names for sentences: "between Signed and Onboarded". */
const STEP_NAMES: Record<FunnelStep, string> = { ...STEP_LABELS, engaged: 'Demo', active: 'Active' }

/** Organisations count as active if they used the platform within this many days. */
export const ACTIVE_WINDOW_DAYS = 90

export const SIDE_LABELS: Record<SideId, { one: string; many: string }> = {
  customer: { one: 'Customer', many: 'Customers' },
  responder: { one: 'Responder', many: 'Responders' },
  supplier: { one: 'Supplier', many: 'Suppliers' },
  partner: { one: 'Partner', many: 'Partners' },
}

/** What counts as using the platform, for each side: "members that ... in the last 90 days". */
export const ACTIVITY: Record<SideId, string> = {
  customer: 'signed in, raised a call-out or updated site details',
  responder: 'were on call or on a job',
  supplier: 'confirmed stock or fulfilled an order',
  partner: 'referred an organisation or signed in',
}

export interface ChecklistItemInfo {
  id: ChecklistItemId
  label: string
  /** What an organisation stuck on this item is waiting for: "waiting on competence audits". */
  waitingOn: string
}

/** Each side's onboarding checklist, in the order the items are normally done. */
export const CHECKLISTS: Record<SideId, readonly ChecklistItemInfo[]> = {
  customer: [
    { id: 'sites-added', label: 'Sites added', waitingOn: 'site lists' },
    { id: 'equipment-logged', label: 'Equipment logged', waitingOn: 'equipment details' },
    { id: 'emergency-contacts', label: 'Emergency contacts', waitingOn: 'emergency contacts' },
    {
      id: 'cost-approval-limits',
      label: 'Cost-approval limits',
      waitingOn: 'cost-approval limits',
    },
    { id: 'first-test-call-out', label: 'First test call-out', waitingOn: 'test call-outs' },
  ],
  responder: [
    {
      id: 'hv-authorisation',
      label: 'HV authorisation uploaded',
      waitingOn: 'HV authorisation certificates',
    },
    { id: 'insurance', label: 'Insurance', waitingOn: 'insurance certificates' },
    { id: 'competence-audit', label: 'Competence audit', waitingOn: 'competence audits' },
    { id: 'rates-agreed', label: 'Rates agreed', waitingOn: 'agreed rates' },
    { id: 'app-training', label: 'App training', waitingOn: 'app training' },
  ],
  supplier: [
    { id: 'catalogue', label: 'Catalogue', waitingOn: 'catalogues' },
    { id: 'stock-levels', label: 'Stock levels', waitingOn: 'stock levels' },
    { id: 'delivery-slas', label: 'Delivery SLAs', waitingOn: 'delivery SLAs' },
    { id: 'regions-served', label: 'Regions served', waitingOn: 'regions served' },
  ],
  partner: [
    { id: 'agreement-signed', label: 'Agreement signed', waitingOn: 'signed agreements' },
    { id: 'referral-code', label: 'Referral code', waitingOn: 'referral codes' },
    { id: 'co-marketing-pack', label: 'Co-marketing pack', waitingOn: 'co-marketing packs' },
  ],
}

const ITEM_INFO = new Map<ChecklistItemId, ChecklistItemInfo>(
  Object.values(CHECKLISTS).flatMap((items) => items.map((item) => [item.id, item] as const)),
)

export function checklistItem(id: ChecklistItemId): ChecklistItemInfo {
  const info = ITEM_INFO.get(id)
  if (!info) throw new Error(`Unknown checklist item: ${id}`)
  return info
}

/** The item's label, or its ID if it is not on any checklist. */
export function checklistLabel(id: string): string {
  return ITEM_INFO.get(id as ChecklistItemId)?.label ?? id
}

/** Done on or before `asOf`. A date after it is a booking, not a completion. */
export function isDone(entry: ChecklistEntry, asOf: Timestamp): boolean {
  return entry.doneAt !== null && entry.doneAt <= asOf
}

/** The furthest stage with a date on or before `asOf`. */
export function stageReached(record: OnboardingRecord, asOf: Timestamp): OnboardingStage | null {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    const stage = STAGES[i] as OnboardingStage
    const at = record.entered[stage]
    if (at !== null && at <= asOf) return stage
  }
  return null
}

function reached(record: OnboardingRecord, stage: OnboardingStage, asOf: Timestamp): boolean {
  const furthest = stageReached(record, asOf)
  return furthest !== null && STAGES.indexOf(furthest) >= STAGES.indexOf(stage)
}

/** Live, still a member and used the platform in the last 90 days. */
export function isActive(record: OnboardingRecord, asOf: Timestamp): boolean {
  if (!reached(record, 'onboarded', asOf) || record.churnedAt !== null) return false
  const { lastActiveAt } = record
  return lastActiveAt !== null && lastActiveAt > asOf - ACTIVE_WINDOW_DAYS * DAY_MS
}

/** Signed, not live yet and not lost: working through the checklist now. */
export function isOnboarding(record: OnboardingRecord, asOf: Timestamp): boolean {
  return stageReached(record, asOf) === 'signed' && record.churnedAt === null
}

export interface FunnelStepCount {
  step: FunnelStep
  reached: number
  /** Share of the organisations that reached the first stage. */
  shareOfTop: number
}

export interface FunnelTransition {
  from: OnboardingStage
  to: Exclude<FunnelStep, 'aware'>
  /** Organisations that reached `from`. */
  entered: number
  /** Of those, how many reached `to`. */
  converted: number
  /** Converted as a share of entered; null when nobody entered. */
  conversion: number | null
  /** Entered but not converted. */
  dropped: number
  /** Dropped and gone: lost prospects, or members that cancelled. */
  left: number
  /** Dropped but still there: waiting at `from`, or live but quiet for 90 days. */
  waiting: number
  /** Median days from entering `from` to entering `to`, for those that made it. */
  medianDays: number | null
}

export interface Funnel {
  side: SideId
  steps: FunnelStepCount[]
  transitions: FunnelTransition[]
}

const daysBetween = (from: Timestamp, to: Timestamp) => (to - from) / DAY_MS

/** One side's funnel from aware to active, as at `asOf`. */
export function buildFunnel(
  records: readonly OnboardingRecord[],
  side: SideId,
  asOf: Timestamp,
): Funnel {
  const own = records.filter((r) => r.side === side)
  const at = (step: FunnelStep) =>
    own.filter((r) => (step === 'active' ? isActive(r, asOf) : reached(r, step, asOf)))
  const groups = FUNNEL_STEPS.map(at)
  const top = groups[0]?.length ?? 0

  const steps = FUNNEL_STEPS.map((step, i) => {
    const count = groups[i]?.length ?? 0
    return { step, reached: count, shareOfTop: top === 0 ? 0 : count / top }
  })

  const transitions = STAGES.map((from, i): FunnelTransition => {
    const to = FUNNEL_STEPS[i + 1] as FunnelTransition['to']
    const entered = groups[i] ?? []
    const next = new Set(groups[i + 1])
    const dropped = entered.filter((r) => !next.has(r))
    const left = dropped.filter((r) => r.churnedAt !== null).length
    const durations =
      to === 'active'
        ? []
        : entered.flatMap((r) => {
            const start = r.entered[from]
            const end = r.entered[to]
            return next.has(r) && start !== null && end !== null ? [daysBetween(start, end)] : []
          })
    return {
      from,
      to,
      entered: entered.length,
      converted: next.size,
      conversion: entered.length === 0 ? null : next.size / entered.length,
      dropped: dropped.length,
      left,
      waiting: dropped.length - left,
      medianDays: durations.length === 0 ? null : Math.round(median(durations)),
    }
  })

  return { side, steps, transitions }
}

export interface OnboardingItem extends ChecklistItemInfo {
  doneAt: Timestamp | null
  done: boolean
}

export interface OnboardingProgress {
  record: OnboardingRecord
  items: OnboardingItem[]
  done: number
  total: number
  /** The first outstanding item in checklist order. */
  next: OnboardingItem | null
  signedAt: Timestamp
  daysSinceSigned: number
  /** The signing date or the latest item done, whichever is later. */
  lastProgressAt: Timestamp
}

/** The latest of the signing date and any checklist item done by `asOf`. */
export function lastProgressAt(record: OnboardingRecord, asOf: Timestamp): Timestamp | null {
  const dates = [
    record.entered.signed,
    ...record.checklist.filter((e) => isDone(e, asOf)).map((e) => e.doneAt),
  ].filter((d): d is Timestamp => d !== null && d <= asOf)
  return dates.length === 0 ? null : Math.max(...dates)
}

/** How far one signed organisation has got with its checklist. */
export function onboardingProgress(record: OnboardingRecord, asOf: Timestamp): OnboardingProgress {
  const signedAt = record.entered.signed
  if (signedAt === null) throw new Error(`${record.id} has not signed, so has no onboarding yet`)
  const byItem = new Map(record.checklist.map((e) => [e.item, e]))
  const items = CHECKLISTS[record.side].map((info): OnboardingItem => {
    const entry = byItem.get(info.id) ?? { item: info.id, doneAt: null }
    return { ...info, doneAt: entry.doneAt, done: isDone(entry, asOf) }
  })
  const done = items.filter((i) => i.done).length
  return {
    record,
    items,
    done,
    total: items.length,
    next: items.find((i) => !i.done) ?? null,
    signedAt,
    daysSinceSigned: Math.floor(daysBetween(signedAt, asOf)),
    lastProgressAt: lastProgressAt(record, asOf) ?? signedAt,
  }
}

/** One side's organisations onboarding now, longest since signing first. */
export function onboardingQueue(
  records: readonly OnboardingRecord[],
  side: SideId,
  asOf: Timestamp,
): OnboardingProgress[] {
  return records
    .filter((r) => r.side === side && isOnboarding(r, asOf))
    .map((r) => onboardingProgress(r, asOf))
    .sort((a, b) => a.signedAt - b.signedAt || a.record.id.localeCompare(b.record.id))
}

export interface Leak {
  transition: FunnelTransition
  sentence: string
}

/** Leaks are only called out where enough organisations entered to make a rate meaningful. */
export const MIN_LEAK_ENTRANTS = 3

const count = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

/** The commonest next item among organisations onboarding now, and whether most share it. */
function topBlocker(side: SideId, queue: readonly OnboardingProgress[]) {
  let best: { item: ChecklistItemInfo; n: number } | null = null
  // In checklist order, so a tie goes to the earlier item, which holds up everything after it
  for (const item of CHECKLISTS[side]) {
    const n = queue.filter((p) => p.next?.id === item.id).length
    if (n > 0 && (!best || n > best.n)) best = { item, n }
  }
  return best && { item: best.item, majority: best.n * 2 > queue.length }
}

/** What moving on to each step means: "67% go live". */
export const MOVE_ON: Record<FunnelTransition['to'], string> = {
  engaged: 'get to a demo',
  signed: 'sign',
  onboarded: 'go live',
  active: 'stay active',
}

/** Where the organisations that never reached a stage were lost. */
const LOST_WHERE: Record<Exclude<OnboardingStage, 'aware'>, string> = {
  engaged: 'before one',
  signed: 'after their demo',
  onboarded: 'during onboarding',
}

function describe(side: SideId, t: FunnelTransition, queue: readonly OnboardingProgress[]): string {
  const who = SIDE_LABELS[side].many
  if (t.to === 'active') {
    const cancelled = t.left > 0 ? `, ${formatNumber(t.left)} of them cancelled` : ''
    return `${who} go quiet after onboarding: ${formatNumber(t.dropped)} of ${formatNumber(t.entered)} not active in the last ${ACTIVE_WINDOW_DAYS} days${cancelled}.`
  }

  const between = `between ${STEP_NAMES[t.from]} and ${STEP_NAMES[t.to]}`
  if (t.left > t.waiting) {
    const rate =
      t.conversion === null ? '' : `only ${formatPercent(t.conversion)} ${MOVE_ON[t.to]}, and `
    return `${who} drop out ${between}: ${rate}${formatNumber(t.left)} ${t.left === 1 ? 'was' : 'were'} lost ${LOST_WHERE[t.to]}.`
  }

  const clauses = t.medianDays === null ? [] : [`median ${count(t.medianDays, 'day')}`]
  if (t.to === 'onboarded') {
    const blocker = topBlocker(side, queue)
    if (blocker) {
      clauses.push(
        `${blocker.majority ? 'mostly' : 'most often'} waiting on ${blocker.item.waitingOn}`,
      )
    }
  } else {
    const waiting = t.to === 'engaged' ? 'still waiting for a demo' : 'still deciding after a demo'
    clauses.push(`${formatNumber(t.waiting)} ${waiting}`)
  }
  return `${who} stall ${between}: ${clauses.join(', ')}.`
}

/**
 * The step with the lowest conversion, in one sentence. Ties go to the step that
 * loses more organisations, then the earlier one. Null when no step has enough
 * entrants or nothing is lost.
 */
export function biggestLeak(
  funnel: Funnel,
  records: readonly OnboardingRecord[],
  asOf: Timestamp,
): Leak | null {
  let worst: FunnelTransition | null = null
  for (const t of funnel.transitions) {
    if (t.conversion === null || t.entered < MIN_LEAK_ENTRANTS || t.dropped === 0) continue
    if (
      !worst ||
      t.conversion < (worst.conversion ?? 1) ||
      (t.conversion === worst.conversion && t.dropped > worst.dropped)
    ) {
      worst = t
    }
  }
  if (!worst) return null
  const queue = onboardingQueue(records, funnel.side, asOf)
  return { transition: worst, sentence: describe(funnel.side, worst, queue) }
}
