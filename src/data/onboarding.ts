import { eligibleWindow } from '@/lib/matching'
import { ACTIVE_WINDOW_DAYS, CHECKLISTS } from '@/lib/onboarding'
import type { Rng } from '@/lib/rng'
import { SIDES } from '@/lib/scenario'
import { DAY_MS } from '@/lib/time'
import type {
  CallOut,
  ChecklistEntry,
  ChecklistItemId,
  Customer,
  Lead,
  OnboardingRecord,
  OnboardingStage,
  Partner,
  PartnerKind,
  Responder,
  SectorId,
  SideId,
  Supplier,
  SupplierCategory,
  Timestamp,
} from '@/types'
import { SECTOR_PROFILES } from './customers'
import { daysFrom, makeId } from './helpers'
import {
  PROSPECT_CUSTOMER_STEMS,
  PROSPECT_PARTNER_STEMS,
  PROSPECT_RESPONDER_STEMS,
  PROSPECT_SUPPLIER_STEMS,
} from './names'
import { PARTNER_PROFILES } from './partners'
import { responderName } from './responders'
import { CATEGORY_PROFILES } from './suppliers'
import { TOWNS } from './towns'

type Range = readonly [min: number, max: number]

interface SidePlan {
  /**
   * New organisations that stopped at a stage, still there or lost. Customer
   * prospects are the leads instead, so the pipeline has one source.
   */
  prospects: {
    aware: number
    awareLost: number
    engaged: number
    engagedLost: number
    signedLost: number
  }
  /** Organisations onboarding now, by the first checklist item still outstanding. */
  onboarding: Partial<Record<ChecklistItemId, number>>
  /** Days spent at each stage by organisations that moved on from it. */
  days: Record<Exclude<OnboardingStage, 'onboarded'>, Range>
  /**
   * Live organisations that cancelled. Only customers do: a responder, supplier or
   * partner that left would have to leave the network data too, and the simulator
   * and coverage map rely on it.
   */
  churned: number
  /** Live members that have not used the platform for over 90 days. */
  quiet: number
}

/**
 * The story each funnel tells: responders stall on competence audits before going
 * live, suppliers are hard to get to a demo, and customers and partners go quiet
 * once they are on the platform.
 */
export const ONBOARDING_PLANS: Record<SideId, SidePlan> = {
  customer: {
    prospects: { aware: 0, awareLost: 0, engaged: 0, engagedLost: 0, signedLost: 1 },
    onboarding: {
      'equipment-logged': 2,
      'emergency-contacts': 1,
      'cost-approval-limits': 4,
      'first-test-call-out': 2,
    },
    days: { aware: [7, 60], engaged: [14, 75], signed: [10, 40] },
    churned: 9,
    quiet: 6,
  },
  responder: {
    prospects: { aware: 5, awareLost: 6, engaged: 3, engagedLost: 5, signedLost: 2 },
    onboarding: {
      'hv-authorisation': 2,
      insurance: 3,
      'competence-audit': 8,
      'rates-agreed': 1,
      'app-training': 1,
    },
    days: { aware: [5, 40], engaged: [7, 40], signed: [20, 50] },
    churned: 0,
    quiet: 3,
  },
  supplier: {
    prospects: { aware: 4, awareLost: 7, engaged: 2, engagedLost: 2, signedLost: 0 },
    onboarding: { 'stock-levels': 1, 'delivery-slas': 2, 'regions-served': 1 },
    days: { aware: [10, 70], engaged: [10, 45], signed: [7, 30] },
    churned: 0,
    quiet: 1,
  },
  partner: {
    prospects: { aware: 3, awareLost: 2, engaged: 2, engagedLost: 1, signedLost: 0 },
    onboarding: { 'referral-code': 1, 'co-marketing-pack': 2 },
    days: { aware: [7, 45], engaged: [14, 60], signed: [7, 35] },
    churned: 0,
    quiet: 5,
  },
}

/** Members cancel no sooner than this after going live. */
const MIN_TENURE_DAYS = 60
/** Only members with this long between their last job and today are picked to cancel. */
const CHURN_WINDOW_DAYS = 90
/** Onboardings open now signed within this many days, so none has gone stale. */
const OPEN_SINCE_DAYS: Record<SideId, Range> = {
  customer: [7, 90],
  responder: [10, 110],
  supplier: [7, 90],
  partner: [7, 90],
}

const ID_PREFIXES: Record<SideId, string> = {
  customer: 'CUS',
  responder: 'RSP',
  supplier: 'SUP',
  partner: 'PTN',
}

const STEMS: Record<SideId, readonly string[]> = {
  customer: PROSPECT_CUSTOMER_STEMS,
  responder: PROSPECT_RESPONDER_STEMS,
  supplier: PROSPECT_SUPPLIER_STEMS,
  partner: PROSPECT_PARTNER_STEMS,
}

/** Trade bodies have fixed names, so new partners are any other kind. */
const PROSPECT_PARTNER_KINDS: readonly PartnerKind[] = [
  'facilities-management',
  'icp-idno',
  'insurer',
  'consultant',
]

type Draft = Omit<OnboardingRecord, 'id'>

/** A live organisation and the bounds its last activity must fall within. */
interface LiveOrg {
  side: SideId
  orgId: string
  name: string
  town: string
  onboarded: Timestamp
  /** Nothing it did on record can come after its last activity: jobs, referrals. */
  floor: Timestamp
  /** Today, or the day before a responder's paperwork lapsed. */
  ceiling: Timestamp
}

export interface OnboardingOptions {
  rng: Rng
  asOf: Timestamp
  customers: readonly Customer[]
  responders: readonly Responder[]
  suppliers: readonly Supplier[]
  partners: readonly Partner[]
  leads: readonly Lead[]
  callOuts: readonly CallOut[]
  /** Customers that must stay active members, because the simulator's scenarios run today. */
  keepActive?: ReadonlySet<string>
}

/**
 * Onboarding records for every organisation in the other datasets, plus the
 * prospects and organisations still onboarding that only appear here. Live
 * organisations went live on the day they joined; their earlier stages are worked
 * back from that, and their activity is kept consistent with their call-outs,
 * referrals and paperwork.
 */
export function generateOnboarding({
  rng,
  asOf,
  customers,
  responders,
  suppliers,
  partners,
  leads,
  callOuts,
  keepActive = new Set(),
}: OnboardingOptions): OnboardingRecord[] {
  const today = daysFrom(asOf, 0)
  const daysAgo = (n: number) => daysFrom(asOf, -n)
  const dayOf = (at: Timestamp) => daysFrom(at, 0)
  /** A random day from `from` to `to`, both 00:00 UTC and inclusive. */
  const between = (from: Timestamp, to: Timestamp) =>
    from + rng.int(0, Math.max(0, Math.round((to - from) / DAY_MS))) * DAY_MS
  const before = (at: Timestamp, [min, max]: Range) => at - rng.int(min, max) * DAY_MS

  const latest = (values: readonly Timestamp[]) => Math.max(-Infinity, ...values)
  const lastCallOut = (key: 'customerId' | 'responderId', id: string) =>
    latest(callOuts.filter((c) => c[key] === id).map((c) => dayOf(c.requestedAt)))

  const liveBySide: Record<SideId, LiveOrg[]> = {
    customer: customers.map((c) => ({
      side: 'customer',
      orgId: c.id,
      name: c.name,
      town: c.headOffice,
      onboarded: c.joinedAt,
      floor: Math.max(c.joinedAt, lastCallOut('customerId', c.id)),
      ceiling: today,
    })),
    responder: responders.map((r) => {
      const window = eligibleWindow(r)
      // Off the rota from the day authorisation or insurance lapses
      const lapsed = window !== null && window.until <= asOf
      return {
        side: 'responder',
        orgId: r.id,
        name: r.name,
        town: r.town,
        onboarded: r.joinedAt,
        floor: Math.max(r.joinedAt, lastCallOut('responderId', r.id)),
        ceiling: lapsed ? dayOf(window.until) - DAY_MS : today,
      }
    }),
    supplier: suppliers.map((s) => ({
      side: 'supplier',
      orgId: s.id,
      name: s.name,
      town: s.town,
      onboarded: s.joinedAt,
      floor: s.joinedAt,
      ceiling: today,
    })),
    partner: partners.map((p) => ({
      side: 'partner',
      orgId: p.id,
      name: p.name,
      town: p.town,
      onboarded: p.since,
      floor: Math.max(
        p.since,
        latest(leads.filter((l) => l.partnerId === p.id).map((l) => l.createdAt)),
        // Referred someone in the last 12 months
        p.referrals > 0 ? daysAgo(364) : -Infinity,
      ),
      ceiling: today,
    })),
  }

  /** Who cancelled, who went quiet, and everyone's last activity. */
  function activity(side: SideId, orgs: readonly LiveOrg[]) {
    const plan = ONBOARDING_PLANS[side]
    const out = new Map<string, { lastActiveAt: Timestamp; churnedAt: Timestamp | null }>()

    const churnFrom = (o: LiveOrg) =>
      Math.max(o.onboarded + MIN_TENURE_DAYS * DAY_MS, o.floor + DAY_MS)
    // Members who cancel had been quiet a while, so cancellations spread across the year
    const canChurn = orgs.filter(
      (o) => !keepActive.has(o.orgId) && churnFrom(o) <= daysAgo(CHURN_WINDOW_DAYS),
    )
    if (canChurn.length < plan.churned) {
      throw new Error(`Only ${canChurn.length} ${side}s can cancel; the plan needs ${plan.churned}`)
    }
    for (const o of rng.shuffle(canChurn).slice(0, plan.churned)) {
      const churnedAt = between(churnFrom(o), today - DAY_MS)
      out.set(o.orgId, { churnedAt, lastActiveAt: between(o.floor, churnedAt) })
    }

    const quietBy = (o: LiveOrg) => Math.min(o.ceiling, daysAgo(ACTIVE_WINDOW_DAYS + 1))
    const canQuieten = orgs.filter(
      (o) => !out.has(o.orgId) && !keepActive.has(o.orgId) && o.floor <= quietBy(o),
    )
    if (canQuieten.length < plan.quiet) {
      throw new Error(
        `Only ${canQuieten.length} ${side}s can go quiet; the plan needs ${plan.quiet}`,
      )
    }
    for (const o of rng.shuffle(canQuieten).slice(0, plan.quiet)) {
      out.set(o.orgId, { churnedAt: null, lastActiveAt: between(o.floor, quietBy(o)) })
    }

    for (const o of orgs) {
      if (out.has(o.orgId)) continue
      const from = Math.min(o.ceiling, Math.max(o.floor, o.ceiling - 30 * DAY_MS))
      out.set(o.orgId, { churnedAt: null, lastActiveAt: between(from, o.ceiling) })
    }
    return out
  }

  const checklistOf = (
    side: SideId,
    doneAt: (item: ChecklistItemId, i: number) => Timestamp | null,
  ) =>
    CHECKLISTS[side].map((info, i): ChecklistEntry => ({
      item: info.id,
      doneAt: doneAt(info.id, i),
    }))

  function liveRecords(side: SideId): Draft[] {
    const { days } = ONBOARDING_PLANS[side]
    const orgs = liveBySide[side]
    const acts = activity(side, orgs)
    return orgs.map((o): Draft => {
      const signed = before(o.onboarded, days.signed)
      const engaged = before(signed, days.engaged)
      const aware = before(engaged, days.aware)
      // Going live is the day the last item was done
      const last = rng.int(0, CHECKLISTS[side].length - 1)
      const checklist = checklistOf(side, (_, i) =>
        i === last ? o.onboarded : between(signed, o.onboarded),
      )
      const act = acts.get(o.orgId) ?? { lastActiveAt: null, churnedAt: null }
      return {
        side,
        orgId: o.orgId,
        name: o.name,
        town: o.town,
        stage: 'onboarded',
        entered: { aware, engaged, signed, onboarded: o.onboarded },
        checklist,
        ...act,
      }
    })
  }

  function prospectName(side: SideId, stem: string): string {
    switch (side) {
      case 'customer': {
        const sector = rng.pick(Object.keys(SECTOR_PROFILES) as SectorId[])
        return rng.pick(SECTOR_PROFILES[sector].names)(stem)
      }
      case 'responder':
        return responderName(rng, stem)
      case 'supplier': {
        const category = rng.pick(Object.keys(CATEGORY_PROFILES) as SupplierCategory[])
        return rng.pick(CATEGORY_PROFILES[category].names)(stem)
      }
      case 'partner':
        return rng.pick(PARTNER_PROFILES[rng.pick(PROSPECT_PARTNER_KINDS)].names)(stem)
    }
  }

  type Situation =
    | { kind: 'aware' | 'awareLost' | 'engaged' | 'engagedLost' | 'signedLost' }
    | { kind: 'onboarding'; blocker: ChecklistItemId }

  function newRecords(side: SideId, firstNumber: number): Draft[] {
    const plan = ONBOARDING_PLANS[side]
    const situations: Situation[] = [
      ...CHECKLISTS[side].flatMap(({ id }) =>
        Array.from({ length: plan.onboarding[id] ?? 0 }, () => ({
          kind: 'onboarding' as const,
          blocker: id,
        })),
      ),
      ...(['aware', 'awareLost', 'engaged', 'engagedLost', 'signedLost'] as const).flatMap((kind) =>
        Array.from({ length: plan.prospects[kind] }, () => ({ kind })),
      ),
    ]
    const stems = rng.shuffle(STEMS[side])
    if (stems.length < situations.length)
      throw new Error(`Not enough prospect name stems for ${side}s`)
    const empty = () => checklistOf(side, () => null)

    return rng.shuffle(situations).map((situation, index): Draft => {
      const name = prospectName(side, stems[index] as string)
      const town = rng.pick(TOWNS).name
      const base = {
        side,
        orgId: makeId(ID_PREFIXES[side], firstNumber + index),
        name,
        town,
        lastActiveAt: null,
      }
      const lostAfter = (at: Timestamp, range: Range) =>
        Math.min(today - DAY_MS, at + rng.int(...range) * DAY_MS)

      switch (situation.kind) {
        case 'aware':
        case 'awareLost': {
          const lost = situation.kind === 'awareLost'
          const aware = daysAgo(lost ? rng.int(90, 600) : rng.int(3, 120))
          return {
            ...base,
            stage: 'aware',
            entered: { aware, engaged: null, signed: null, onboarded: null },
            checklist: empty(),
            churnedAt: lost ? lostAfter(aware, [14, 75]) : null,
          }
        }
        case 'engaged':
        case 'engagedLost': {
          const lost = situation.kind === 'engagedLost'
          const engaged = daysAgo(lost ? rng.int(60, 500) : rng.int(3, 75))
          return {
            ...base,
            stage: 'engaged',
            entered: {
              aware: before(engaged, plan.days.aware),
              engaged,
              signed: null,
              onboarded: null,
            },
            checklist: empty(),
            churnedAt: lost ? lostAfter(engaged, [14, 60]) : null,
          }
        }
        case 'signedLost': {
          const signed = daysAgo(rng.int(60, 400))
          const engaged = before(signed, plan.days.engaged)
          const churnedAt = lostAfter(signed, [20, 70])
          const done = rng.int(0, 2)
          return {
            ...base,
            stage: 'signed',
            entered: { aware: before(engaged, plan.days.aware), engaged, signed, onboarded: null },
            checklist: checklistOf(side, (_, i) => (i < done ? between(signed, churnedAt) : null)),
            churnedAt,
          }
        }
        case 'onboarding': {
          const signed = daysAgo(rng.int(...OPEN_SINCE_DAYS[side]))
          const engaged = before(signed, plan.days.engaged)
          const stuckAt = CHECKLISTS[side].findIndex((item) => item.id === situation.blocker)
          // Everything before the blocker is done, in order; a few later items are done early
          const earlier = Array.from({ length: stuckAt }, () => between(signed, today)).sort(
            (a, b) => a - b,
          )
          return {
            ...base,
            stage: 'signed',
            entered: { aware: before(engaged, plan.days.aware), engaged, signed, onboarded: null },
            checklist: checklistOf(side, (_, i) =>
              i < stuckAt
                ? (earlier[i] as Timestamp)
                : i > stuckAt && rng.chance(0.3)
                  ? between(signed, today)
                  : null,
            ),
            churnedAt: null,
          }
        }
      }
    })
  }

  /** Leads are the customer prospects: aware until a demo, engaged from discovery on. */
  function leadRecords(): Draft[] {
    return leads.map((lead): Draft => {
      const contacted = lead.lastContactAt ?? lead.createdAt
      const engaged =
        lead.stage === 'discovery' ||
        lead.stage === 'proposal' ||
        lead.stage === 'negotiation' ||
        (lead.stage === 'lost' && rng.chance(0.5))
      return {
        side: 'customer',
        orgId: lead.id,
        name: lead.organisation,
        town: lead.town,
        stage: engaged ? 'engaged' : 'aware',
        entered: {
          aware: lead.createdAt,
          engaged: engaged ? between(lead.createdAt, contacted) : null,
          signed: null,
          onboarded: null,
        },
        checklist: checklistOf('customer', () => null),
        lastActiveAt: null,
        churnedAt: lead.stage === 'lost' ? contacted : null,
      }
    })
  }

  const drafts = SIDES.flatMap((side) => [
    ...liveRecords(side),
    ...newRecords(side, liveBySide[side].length + 1),
    ...(side === 'customer' ? leadRecords() : []),
  ])
  return drafts.map((draft, i) => ({ id: makeId('ONB', i + 1), ...draft }))
}
