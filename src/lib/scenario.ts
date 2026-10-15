/**
 * One emergency played out step by step across the four sides. Every figure is
 * derived from the records passed in (the matched responder's rates, suppliers'
 * stock and the call-out history), so the same inputs always tell the same story.
 */
import type {
  Contact,
  CostBreakdown,
  Customer,
  Equipment,
  FaultType,
  Partner,
  Responder,
  Site,
  StockItem,
  Supplier,
  Timestamp,
} from '@/types'
import {
  billableHours,
  callOutCharge,
  costTotal,
  CREW_SIZE,
  labourCharge,
  type FaultHistory,
} from './costs'
import { formatDate, formatDuration, formatGBP, formatNumber, formatTime } from './format'
import { RESPONSE_TARGET_MINUTES } from './geo'
import { matchResponders, mobiliseMinutes, type Candidate, type MatchResult } from './matching'
import {
  describeStock,
  sourceItem,
  type ItemRequest,
  type SupplierCheck,
} from './sourcing'
import { DAY_MS, isOutOfHours, isOvernight, MINUTE_MS } from './time'

export const STEPS = [
  { id: 'request', label: 'Request' },
  { id: 'match', label: 'Match' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'source', label: 'Source parts' },
  { id: 'on-site', label: 'On site' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'review', label: 'Review' },
] as const

export type StepId = (typeof STEPS)[number]['id']

export const SIDES = ['customer', 'responder', 'supplier', 'partner'] as const
export type SideId = (typeof SIDES)[number]

/** The customer approves the estimate this long after the crew sets off. */
export const APPROVAL_MINUTES = 3
/** Rating and closing paperwork, after the job is resolved. */
export const REVIEW_MINUTES = 45
/** The ETA turns amber this many minutes before the target. */
export const NEAR_TARGET_MINUTES = 15
/** Longest a crew waits on site for parts before standing down and coming back. */
export const MAX_WAIT_MINUTES = 240
/** Making the site safe before standing down to wait for parts. */
export const MAKE_SAFE_MINUTES = 60

const stepIndex = (id: StepId) => STEPS.findIndex((step) => step.id === id)
const minutesBetween = (from: Timestamp, to: Timestamp) => Math.round((to - from) / MINUTE_MS)
const addMinutes = (at: Timestamp, minutes: number) => at + Math.round(minutes) * MINUTE_MS
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Minutes from the request to a responder accepting: longer when people are asleep. */
export function acceptMinutes(at: Timestamp): number {
  return isOvernight(at) ? 6 : 4
}

export type EtaStatus = 'on-track' | 'near-target' | 'past-target'

/** Amber from 15 minutes before the target, red once past it. */
export function etaStatus(minutes: number, target: number = RESPONSE_TARGET_MINUTES): EtaStatus {
  if (!Number.isFinite(minutes) || minutes < 0) {
    throw new RangeError(`minutes must be a non-negative number, got ${minutes}`)
  }
  if (!Number.isFinite(target) || target <= NEAR_TARGET_MINUTES) {
    throw new RangeError(`target must be more than ${NEAR_TARGET_MINUTES} minutes, got ${target}`)
  }
  if (minutes > target) return 'past-target'
  if (minutes >= target - NEAR_TARGET_MINUTES) return 'near-target'
  return 'on-track'
}

export interface ResponseProgress {
  /** Minutes since the request, stopping at arrival. */
  elapsedMinutes: number
  /** Request to arrival as now expected. Null until a responder accepts. */
  expectedMinutes: number | null
  arrived: boolean
  status: EtaStatus | null
}

export interface Timeline {
  requestedAt: Timestamp
  acceptedAt: Timestamp
  arrivedAt: Timestamp
}

/** Where the response stands at `at`. */
export function responseProgress(at: Timestamp, timeline: Timeline): ResponseProgress {
  const { requestedAt, acceptedAt, arrivedAt } = timeline
  if (at < requestedAt) throw new RangeError('at must not be before the request')
  if (at < acceptedAt) {
    return {
      elapsedMinutes: minutesBetween(requestedAt, at),
      expectedMinutes: null,
      arrived: false,
      status: null,
    }
  }
  const expected = minutesBetween(requestedAt, arrivedAt)
  const arrived = at >= arrivedAt
  return {
    elapsedMinutes: arrived ? expected : minutesBetween(requestedAt, at),
    expectedMinutes: expected,
    arrived,
    status: etaStatus(expected),
  }
}

/** The customer's rating: the responder's average, marked down for a late arrival. */
export function expectedRating(averageRating: number, responseMinutes: number): number {
  // The same adjustment the call-out history uses, without the noise
  const adjustment =
    responseMinutes > 90 ? -1 : responseMinutes > 75 ? -0.5 : responseMinutes < 45 ? 0.3 : 0
  return Math.min(5, Math.max(1, Math.round(averageRating + adjustment)))
}

export type CostKey = keyof CostBreakdown

export const COST_LABELS: Record<CostKey, string> = {
  callOutFee: 'Call-out fee',
  labour: 'Labour',
  parts: 'Parts',
  generatorHire: 'Generator hire',
}

export interface CostLine {
  key: CostKey
  label: string
  amount: number
  /** How the amount was worked out. */
  basis: string
  /** The step at which the amount is committed. */
  committedAt: StepId
}

/** Not yet predicted, predicted but awaiting its step, or committed. */
export type CostLineStatus = 'pending' | 'estimate' | 'committed'

export interface CostSnapshot {
  committed: number
  /** Null until the cost prediction appears at the match. */
  predicted: number | null
  lines: { line: CostLine; status: CostLineStatus }[]
}

const toPence = (amount: number) => Math.round(amount * 100) / 100

/** The running cost as it stands at a step. */
export function costAtStep(lines: readonly CostLine[], step: StepId): CostSnapshot {
  const now = stepIndex(step)
  if (now < 0) throw new RangeError(`Unknown step ${step}`)
  const predicting = now >= stepIndex('match')
  const states = lines.map((line): CostSnapshot['lines'][number] => ({
    line,
    status: now >= stepIndex(line.committedAt) ? 'committed' : predicting ? 'estimate' : 'pending',
  }))
  return {
    committed: toPence(
      states.reduce((sum, s) => sum + (s.status === 'committed' ? s.line.amount : 0), 0),
    ),
    predicted: predicting ? toPence(lines.reduce((sum, line) => sum + line.amount, 0)) : null,
    lines: states,
  }
}

/** A short description of a piece of plant, e.g. "1,250 kVA oil-filled transformer (1999)". */
export function describeEquipment(item: Equipment): string {
  switch (item.kind) {
    case 'transformer':
      return `${formatNumber(item.ratingKva)} kVA ${item.cooling === 'oil' ? 'oil-filled' : 'dry-type'} transformer (${item.installedYear})`
    case 'switchgear':
      return `11 kV switchboard, ${item.panels} panels (${item.installedYear})`
    case 'rmu':
      return `11 kV ring main unit (${item.installedYear})`
    case 'generator':
      return `${formatNumber(item.ratingKva)} kVA standby generator (${item.installedYear})`
  }
}

export interface ScenarioInput {
  id: string
  title: string
  customer: Customer
  site: Site
  /** The item that has failed. */
  equipment: Equipment
  faultType: FaultType
  faultLabel: string
  requestedAt: Timestamp
  /** Scenario-specific wording for what happened, what the crew does and the fix. */
  story: { request: string; onSite: string; resolved: string }
  responders: readonly Responder[]
  suppliers: readonly Supplier[]
  orders: readonly ItemRequest[]
  facilities: Partner
  insurer: Partner
  history: FaultHistory
  /** Price and time the job as the median on record, or the largest (a full replacement). */
  basis: 'typical' | 'largest'
  /** Generator hire per day. */
  hireDayRate: number
}

export interface PlacedOrder {
  request: ItemRequest
  supplier: Supplier
  item: StockItem
  miles: number
  deliveryAt: Timestamp
  /** Every supplier checked, best first. */
  checks: SupplierCheck[]
}

export type ScreenTone = 'alert' | 'info' | 'success' | 'warning' | 'danger'

/** One notification or app screen on a side's phone. */
export interface Screen {
  /** The organisation whose app or message this is. */
  org: string
  title: string
  tone: ScreenTone
  body?: string
  rows?: { label: string; value: string }[]
  /** The on-screen button. The simulator presses it. */
  action?: string
  /** What happened once the action was taken. */
  done?: string
}

export interface StepView {
  id: StepId
  label: string
  index: number
  at: Timestamp
  minutesSinceRequest: number
  response: ResponseProgress
  cost: CostSnapshot
  /** An empty list means the side has nothing to do at this step. */
  screens: Record<SideId, Screen[]>
}

export interface Simulation {
  input: ScenarioInput
  /** Who raises the request: the on-call contact out of hours. */
  contact: Contact
  match: MatchResult
  responder: Candidate
  orders: PlacedOrder[]
  outOfHours: boolean
  times: Record<StepId, Timestamp>
  responseMinutes: number
  repairMinutes: number
  /** Billable time on site, including any wait for parts or a return visit. */
  onSiteMinutes: number
  costs: CostLine[]
  cost: CostBreakdown
  total: number
  rating: number
  steps: StepView[]
}

/** Play the scenario through. Throws if nobody can respond or a part cannot be sourced. */
export function buildSimulation(input: ScenarioInput): Simulation {
  const { site, requestedAt, history, basis } = input
  const outOfHours = isOutOfHours(requestedAt)
  const contact = (outOfHours ? site.contacts[1] : undefined) ?? site.contacts[0]
  if (!contact) throw new Error(`${site.name} has no emergency contact`)

  const match = matchResponders(input.responders, site, requestedAt)
  const responder = match.chosen
  if (!responder) throw new Error(`No eligible responder for ${site.name}`)

  const acceptedAt = addMinutes(requestedAt, acceptMinutes(requestedAt))
  const departedAt = addMinutes(acceptedAt, mobiliseMinutes(requestedAt))
  const arrivedAt = addMinutes(acceptedAt, responder.etaMinutes)
  const approvedAt = addMinutes(departedAt, APPROVAL_MINUTES)

  const orders = input.orders.map((request): PlacedOrder => {
    const { checks, chosen } = sourceItem(input.suppliers, request, site, approvedAt)
    if (!chosen?.item || chosen.deliveryAt === null) {
      throw new Error(`No supplier can provide ${request.description ?? `${request.minKva} kVA`}`)
    }
    const { supplier, item, miles, deliveryAt } = chosen
    return { request, supplier, item, miles, deliveryAt, checks }
  })
  const partOrders = orders.filter((o) => o.request.purpose === 'part')
  const hireOrders = orders.filter((o) => o.request.purpose === 'hire')

  // Work finishes once the crew and every part are on site
  const repairMinutes =
    basis === 'typical' ? history.medianRepairMinutes : history.longestRepairMinutes
  const workStartsAt = Math.max(arrivedAt, ...partOrders.map((o) => o.deliveryAt))
  const resolvedAt = addMinutes(workStartsAt, repairMinutes)
  const reviewAt = addMinutes(resolvedAt, REVIEW_MINUTES)
  // A short wait for parts is spent on site; a long one means making safe and coming back
  const waitMinutes = minutesBetween(arrivedAt, workStartsAt)
  const onSiteMinutes =
    repairMinutes + (waitMinutes <= MAX_WAIT_MINUTES ? waitMinutes : MAKE_SAFE_MINUTES)

  const hireDays = (order: PlacedOrder) =>
    Math.max(1, Math.ceil((resolvedAt - order.deliveryAt) / DAY_MS))
  const totalHireDays = hireOrders.reduce((sum, o) => sum + hireDays(o), 0)

  const { rates } = responder.responder
  const cost: CostBreakdown = {
    callOutFee: callOutCharge(rates, outOfHours),
    labour: labourCharge(rates, onSiteMinutes, outOfHours),
    parts: basis === 'typical' ? history.medianParts : history.largestParts,
    generatorHire: toPence(totalHireDays * input.hireDayRate),
  }
  const total = costTotal(cost)
  const responseMinutes = minutesBetween(requestedAt, arrivedAt)

  const times: Record<StepId, Timestamp> = {
    request: requestedAt,
    match: acceptedAt,
    dispatch: departedAt,
    source: approvedAt,
    'on-site': arrivedAt,
    resolved: resolvedAt,
    review: reviewAt,
  }

  const outOfHoursNote = outOfHours
    ? ` × ${formatNumber(rates.outOfHoursMultiplier, 2)} out of hours`
    : ''
  const fault = input.faultLabel.toLowerCase()
  const partsSource =
    partOrders.length > 0
      ? `supplied by ${partOrders.map((o) => o.supplier.name).join(' and ')}`
      : `materials from the responder's van`
  const costs: CostLine[] = [
    {
      key: 'callOutFee',
      label: COST_LABELS.callOutFee,
      amount: cost.callOutFee,
      basis: `${formatGBP(rates.callOutFee)} per attendance${outOfHoursNote}`,
      committedAt: 'match',
    },
    {
      key: 'labour',
      label: COST_LABELS.labour,
      amount: cost.labour,
      basis: `${CREW_SIZE} engineers × ${formatNumber(billableHours(onSiteMinutes), 1)} h on site × ${formatGBP(rates.hourlyRate)}${outOfHoursNote}`,
      committedAt: 'resolved',
    },
    {
      key: 'parts',
      label: COST_LABELS.parts,
      amount: cost.parts,
      basis: `${basis === 'typical' ? 'Median' : 'Largest'} parts bill of ${history.jobs} ${fault} jobs on record, ${partsSource}`,
      committedAt: 'source',
    },
    {
      key: 'generatorHire',
      label: COST_LABELS.generatorHire,
      amount: cost.generatorHire,
      basis:
        totalHireDays > 0
          ? `${formatGBP(input.hireDayRate)} a day × ${plural(totalHireDays, 'day', 'days')} (median hire charge on record)`
          : site.equipment.some((e) => e.kind === 'generator')
            ? "Not needed: the site's standby generator carries the load"
            : 'Not needed on this job',
      committedAt: 'source',
    },
  ]

  const sim: Omit<Simulation, 'steps'> = {
    input,
    contact,
    match,
    responder,
    orders,
    outOfHours,
    times,
    responseMinutes,
    repairMinutes,
    onSiteMinutes,
    costs,
    cost,
    total,
    rating: expectedRating(responder.responder.rating, responseMinutes),
  }
  const timeline = { requestedAt, acceptedAt, arrivedAt }
  const steps = STEPS.map(
    (step, index): StepView => ({
      id: step.id,
      label: step.label,
      index,
      at: times[step.id],
      minutesSinceRequest: minutesBetween(requestedAt, times[step.id]),
      response: responseProgress(times[step.id], timeline),
      cost: costAtStep(costs, step.id),
      screens: screensFor(step.id, { ...sim, hireDays }),
    }),
  )
  return { ...sim, steps }
}

interface ScreenContext extends Omit<Simulation, 'steps'> {
  hireDays: (order: PlacedOrder) => number
}

/** Time, with the date as well once the job runs into another day. */
function clock(at: Timestamp, since: Timestamp): string {
  return formatDate(at) === formatDate(since)
    ? formatTime(at)
    : `${formatDate(at)}, ${formatTime(at)}`
}

function responseNote(minutes: number): { tone: ScreenTone; text: string } {
  const spare = RESPONSE_TARGET_MINUTES - minutes
  switch (etaStatus(minutes)) {
    case 'on-track':
      return { tone: 'info', text: `On track: ${formatDuration(spare)} inside the 75-minute target.` }
    case 'near-target':
      return { tone: 'warning', text: `Near the target: ${formatDuration(spare)} to spare.` }
    case 'past-target':
      return { tone: 'danger', text: `${formatDuration(-spare)} past the 75-minute target.` }
  }
}

/** What each side sees at one step. */
function screensFor(step: StepId, ctx: ScreenContext): Record<SideId, Screen[]> {
  const { input, contact, match, responder, orders, times, responseMinutes, costs, total } = ctx
  const { customer, site, equipment, faultLabel, story, facilities, insurer } = input
  const crew = responder.responder
  const at = (id: StepId) => clock(times[id], times.request)
  const response = responseNote(responseMinutes)
  const partOrders = orders.filter((o) => o.request.purpose === 'part').length
  const partsFromResponder = partOrders === 0

  switch (step) {
    case 'request':
      return {
        customer: [
          {
            org: customer.name,
            title: 'Emergency request sent',
            tone: 'alert',
            body: story.request,
            rows: [
              { label: 'Site', value: site.name },
              { label: 'Equipment', value: describeEquipment(equipment) },
              { label: 'Fault', value: faultLabel },
              { label: 'Sent', value: `${at('request')} by ${contact.name}` },
            ],
            done: 'Sent in three clicks from the pre-loaded site',
          },
        ],
        responder: [
          {
            org: crew.name,
            title: 'New emergency nearby',
            tone: 'alert',
            body: `Offered to the ${plural(match.ranked.length, 'responder', 'responders')} that pass every check.`,
            rows: [
              { label: 'Site', value: `${site.name}, ${site.town}` },
              { label: 'Fault', value: faultLabel },
              { label: 'Distance', value: `${formatNumber(responder.miles, 1)} miles from your depot` },
              { label: 'Criticality', value: `${site.criticality} of 5` },
            ],
            action: 'Accept job',
          },
        ],
        supplier: [],
        partner: [
          {
            org: facilities.name,
            title: 'Emergency at a site you manage',
            tone: 'info',
            body: 'A responder is being matched. The closing report will follow.',
            rows: [
              { label: 'Site', value: site.name },
              { label: 'Fault', value: faultLabel },
              { label: 'Logged', value: at('request') },
            ],
          },
        ],
      }

    case 'match':
      return {
        customer: [
          {
            org: customer.name,
            title: 'Choose a responder',
            tone: 'info',
            body: 'Ranked by ETA, rating, availability and compliance.',
            rows: match.ranked.slice(0, 3).map((c) => ({
              label: c.responder.name,
              value: `${formatDuration(c.etaMinutes)} · ${formatNumber(c.responder.rating, 1)} ★`,
            })),
            done: `${crew.name} accepted at ${at('match')}`,
          },
        ],
        responder: [
          {
            org: crew.name,
            title: 'Job accepted',
            tone: 'success',
            rows: [
              { label: 'Customer', value: customer.name },
              { label: 'Site contact', value: `${contact.name}, ${contact.role}` },
              { label: 'Phone', value: contact.phone },
              { label: 'On file', value: plural(site.equipment.length, 'item', 'items') + ' of equipment' },
            ],
            done: `Accepted at ${at('match')}`,
          },
        ],
        supplier: orders.map((order) => ({
          org: order.supplier.name,
          title: 'Stock check',
          tone: 'info',
          body: `${plural(order.checks.length, 'supplier', 'suppliers')} checked; ${order.checks.filter((c) => c.deliveryAt !== null).length} can supply.`,
          rows: [
            { label: 'Item', value: order.item.description },
            { label: 'Stock', value: describeStock(order.item) },
            { label: 'For', value: `${site.name}, ${formatNumber(order.miles, 1)} miles away` },
          ],
        })),
        partner: [],
      }

    case 'dispatch':
      return {
        customer: [
          {
            org: customer.name,
            title: 'Crew on the way',
            tone: response.tone,
            body: response.text,
            rows: [
              { label: 'Responder', value: crew.name },
              { label: 'Arrives', value: `${at('on-site')} (${formatDuration(responseMinutes)} after request)` },
              { label: 'Target', value: clock(addMinutes(times.request, RESPONSE_TARGET_MINUTES), times.request) },
            ],
          },
        ],
        responder: [
          {
            org: crew.name,
            title: `On the road to ${site.name}`,
            tone: 'info',
            rows: [
              { label: 'Left depot', value: at('dispatch') },
              { label: 'Drive', value: `${formatNumber(responder.miles, 1)} miles, about ${formatDuration(responder.driveMinutes)}` },
              { label: 'Crew', value: `${CREW_SIZE} engineers` },
              { label: 'Access', value: `${facilities.name} meets you at the gate` },
            ],
          },
        ],
        supplier: orders.map((order) => ({
          org: order.supplier.name,
          title: 'Reserved',
          tone: 'info',
          body: `Held for ${site.name} until the customer approves the estimate.`,
          rows: [{ label: 'Item', value: order.item.description }],
        })),
        partner: [
          {
            org: facilities.name,
            title: 'Arrange site access',
            tone: 'warning',
            rows: [
              { label: 'Crew', value: crew.name },
              { label: 'Arriving', value: at('on-site') },
            ],
            action: 'Confirm escort',
            done: 'Escort booked at the gate',
          },
        ],
      }

    case 'source':
      return {
        customer: [
          {
            org: customer.name,
            title: 'Approve the estimate',
            tone: 'warning',
            body: 'Nothing is ordered until you approve.',
            rows: [
              ...costs
                .filter((line) => line.amount > 0)
                .map((line) => ({ label: line.label, value: formatGBP(line.amount) })),
              { label: 'Total', value: formatGBP(total) },
            ],
            action: `Approve ${formatGBP(total)}`,
            done: `Approved at ${at('source')} by ${contact.name}`,
          },
        ],
        responder:
          orders.length > 0
            ? [
                {
                  org: crew.name,
                  title: 'Parts and plant ordered',
                  tone: 'info',
                  body: 'The customer approved the estimate.',
                  rows: orders.map((o) => ({
                    label: o.item.description,
                    value: `On site ${clock(o.deliveryAt, times.request)}`,
                  })),
                },
              ]
            : [],
        supplier: orders.map((order) => ({
          org: order.supplier.name,
          title: 'Order confirmed',
          tone: 'success',
          rows: [
            { label: 'Item', value: order.item.description },
            { label: 'Delivery', value: clock(order.deliveryAt, times.request) },
            { label: 'From', value: order.supplier.town },
          ],
          done: `Ordered at ${at('source')}, after the customer approved`,
        })),
        partner: [],
      }

    case 'on-site':
      return {
        customer: [
          {
            org: customer.name,
            title: 'Crew on site',
            tone: response.tone === 'info' ? 'success' : response.tone,
            body: response.text,
            rows: [
              { label: 'Arrived', value: at('on-site') },
              { label: 'Response', value: formatDuration(responseMinutes) },
            ],
          },
        ],
        responder: [
          {
            org: crew.name,
            title: 'Arrived on site',
            tone: 'info',
            body: story.onSite,
            rows: [
              { label: 'Arrived', value: at('on-site') },
              { label: 'Equipment', value: describeEquipment(equipment) },
            ],
          },
        ],
        supplier: orders.map((order): Screen => {
          const delivered = order.deliveryAt <= times['on-site']
          const sameDay = formatDate(order.deliveryAt) === formatDate(times['on-site'])
          return {
            org: order.supplier.name,
            title: delivered ? 'Delivered' : sameDay ? 'Out for delivery' : 'Delivery booked',
            tone: delivered ? 'success' : 'info',
            rows: [
              { label: 'Item', value: order.item.description },
              {
                label: delivered ? 'Delivered' : 'Arrives',
                value: clock(order.deliveryAt, times.request),
              },
            ],
          }
        }),
        partner: [],
      }

    case 'resolved':
      return {
        customer: [
          {
            org: customer.name,
            title: 'Job resolved',
            tone: 'success',
            body: story.resolved,
            rows: [
              { label: 'Resolved', value: at('resolved') },
              { label: 'Since request', value: formatDuration(minutesBetween(times.request, times.resolved)) },
              { label: 'Cost', value: formatGBP(total) },
            ],
          },
        ],
        responder: [
          {
            org: crew.name,
            title: 'Job complete',
            tone: 'success',
            rows: [
              { label: 'Resolved', value: at('resolved') },
              {
                label: 'Billed',
                value: `${formatNumber(billableHours(ctx.onSiteMinutes), 1)} h × ${CREW_SIZE} engineers`,
              },
            ],
            action: 'Submit report',
            done: 'Job report submitted',
          },
        ],
        supplier: orders.map((order): Screen =>
          order.request.purpose === 'hire'
            ? {
                org: order.supplier.name,
                title: 'Off hire',
                tone: 'info',
                rows: [
                  { label: 'Item', value: order.item.description },
                  { label: 'On hire', value: plural(ctx.hireDays(order), 'day', 'days') },
                  { label: 'Collect from', value: at('resolved') },
                ],
              }
            : {
                org: order.supplier.name,
                title: 'Part fitted',
                tone: 'success',
                rows: [
                  { label: 'Item', value: order.item.description },
                  { label: 'Delivered', value: clock(order.deliveryAt, times.request) },
                ],
              },
        ),
        partner: [
          {
            org: facilities.name,
            title: 'Job resolved',
            tone: 'success',
            rows: [
              { label: 'Site', value: site.name },
              { label: 'Resolved', value: at('resolved') },
            ],
          },
        ],
      }

    case 'review': {
      const paid = ctx.cost.callOutFee + ctx.cost.labour + (partsFromResponder ? ctx.cost.parts : 0)
      return {
        customer: [
          {
            org: customer.name,
            title: 'Rate this job',
            tone: 'info',
            rows: [
              { label: 'Responder', value: crew.name },
              { label: 'Your rating', value: `${ctx.rating} of 5 ★` },
              { label: 'Invoice', value: formatGBP(total) },
            ],
            done: 'Rating sent and invoice approved',
          },
        ],
        responder: [
          {
            org: crew.name,
            title: `Rated ${ctx.rating} of 5`,
            tone: 'success',
            rows: [
              { label: COST_LABELS.callOutFee, value: formatGBP(ctx.cost.callOutFee) },
              { label: COST_LABELS.labour, value: formatGBP(ctx.cost.labour) },
              ...(partsFromResponder
                ? [{ label: COST_LABELS.parts, value: formatGBP(ctx.cost.parts) }]
                : []),
              { label: 'Paid', value: formatGBP(paid) },
            ],
          },
        ],
        supplier: orders.map((order) => ({
          org: order.supplier.name,
          title: 'Invoice sent',
          tone: 'info',
          rows: [
            { label: 'Item', value: order.item.description },
            {
              label: 'Amount',
              value: formatGBP(
                order.request.purpose === 'hire'
                  ? toPence(ctx.hireDays(order) * input.hireDayRate)
                  : toPence(ctx.cost.parts / partOrders),
              ),
            },
          ],
        })),
        partner: [
          {
            org: facilities.name,
            title: 'Closing report',
            tone: 'info',
            body: story.resolved,
            rows: [
              {
                label: 'Response',
                value: `${formatDuration(responseMinutes)} against the 75-minute target`,
              },
              { label: 'Resolved', value: at('resolved') },
              { label: 'Cost', value: formatGBP(total) },
            ],
          },
          {
            org: insurer.name,
            title: 'Incident record filed',
            tone: 'info',
            rows: [
              { label: 'Policyholder', value: customer.name },
              { label: 'Site', value: site.name },
              { label: 'Equipment', value: describeEquipment(equipment) },
              { label: 'Open for', value: formatDuration(minutesBetween(times.request, times.resolved)) },
            ],
          },
        ],
      }
    }
  }
}
