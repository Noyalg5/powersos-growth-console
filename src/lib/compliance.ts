/**
 * Responder compliance: HV authorisation, insurance and competence audits, each
 * banded by how soon it runs out.
 *
 * Whether a responder can be matched comes from the simulator's own eligibility rule
 * (matching.ts), judged for a weekday daytime request at the data date, so only
 * paperwork can exclude: cover at night and at weekends is a separate question.
 * Audits do not affect matching today; an overdue audit is flagged for follow-up.
 */
import type { Responder, Timestamp } from '@/types'
import { toCsv, type CsvValue } from './csv'
import { formatIsoDate } from './format'
import { eligibilityExclusions, type CoverContext, type Exclusion } from './matching'
import { DAY_MS } from './time'

/** Responders are audited for competence and safety at least this often. */
export const AUDIT_INTERVAL_DAYS = 365

/** Worst first. */
export const EXPIRY_STATUSES = ['missing', 'expired', 'due-30', 'due-60', 'due-90', 'ok'] as const
export type ExpiryStatus = (typeof EXPIRY_STATUSES)[number]

export const STATUS_LABELS: Record<ExpiryStatus, string> = {
  missing: 'Missing',
  expired: 'Expired',
  'due-30': 'Within 30 days',
  'due-60': '31–60 days',
  'due-90': '61–90 days',
  ok: 'OK',
}

export const CHECKS = ['authorisation', 'insurance', 'audit'] as const
export type ComplianceCheck = (typeof CHECKS)[number]

export const CHECK_LABELS: Record<ComplianceCheck, string> = {
  authorisation: 'HV authorisation',
  insurance: 'Insurance',
  audit: 'Competence audit',
}

/** Whole days from `asOf` until `expiry`, counting part of a day as a day: 0 or less has expired. */
export function daysUntil(expiry: Timestamp, asOf: Timestamp): number {
  return Math.ceil((expiry - asOf) / DAY_MS)
}

/** Expired at or before `asOf`, the same as matching; otherwise banded by days left. */
export function expiryStatus(expiry: Timestamp | null, asOf: Timestamp): ExpiryStatus {
  if (expiry === null) return 'missing'
  const days = daysUntil(expiry, asOf)
  if (days <= 0) return 'expired'
  if (days <= 30) return 'due-30'
  if (days <= 60) return 'due-60'
  if (days <= 90) return 'due-90'
  return 'ok'
}

export function auditDueAt(lastAuditAt: Timestamp): Timestamp {
  return lastAuditAt + AUDIT_INTERVAL_DAYS * DAY_MS
}

export interface CheckStatus {
  status: ExpiryStatus
  /** When it runs out, or ran out: the expiry, or the next audit due. Null when missing. */
  due: Timestamp | null
  /** Days left until `due`; negative once past. */
  days: number | null
}

export interface ResponderCompliance {
  responder: Responder
  checks: Record<ComplianceCheck, CheckStatus>
  /** The worst of the three. */
  worst: ExpiryStatus
  /** Why matching leaves the responder out today. Empty when it can be matched. */
  exclusions: Exclusion[]
}

/** A weekday daytime request at `at`: the hour that tests paperwork alone. */
export function paperworkContext(at: Timestamp): CoverContext {
  return { at, overnight: false, weekend: false }
}

const worstOf = (statuses: readonly ExpiryStatus[]): ExpiryStatus =>
  EXPIRY_STATUSES.find((s) => statuses.includes(s)) ?? 'ok'

function check(due: Timestamp | null, asOf: Timestamp): CheckStatus {
  return {
    status: expiryStatus(due, asOf),
    due,
    days: due === null ? null : daysUntil(due, asOf),
  }
}

export function responderCompliance(responder: Responder, asOf: Timestamp): ResponderCompliance {
  const checks = {
    authorisation: check(responder.authorisationExpiry, asOf),
    insurance: check(responder.insuranceExpiry, asOf),
    audit: check(auditDueAt(responder.lastAuditAt), asOf),
  }
  return {
    responder,
    checks,
    worst: worstOf(CHECKS.map((c) => checks[c].status)),
    exclusions: eligibilityExclusions(responder, paperworkContext(asOf)),
  }
}

/** Every responder, worst first, then by the soonest date and name. */
export function complianceRows(
  responders: readonly Responder[],
  asOf: Timestamp,
): ResponderCompliance[] {
  const soonest = (row: ResponderCompliance) =>
    Math.min(...CHECKS.map((c) => row.checks[c].due ?? -Infinity))
  return responders
    .map((r) => responderCompliance(r, asOf))
    .sort(
      (a, b) =>
        EXPIRY_STATUSES.indexOf(a.worst) - EXPIRY_STATUSES.indexOf(b.worst) ||
        soonest(a) - soonest(b) ||
        a.responder.name.localeCompare(b.responder.name),
    )
}

export interface ComplianceSummary {
  responders: number
  /** Left out of matching today, for any paperwork reason. */
  excluded: number
  /** Excluded responders by reason; one can have more than one. */
  reasons: Partial<Record<Exclusion['code'], number>>
  /** At least one check runs out within 90 days, and none has run out. */
  dueSoon: number
  auditsOverdue: number
  /** Every check more than 90 days from running out. */
  clear: number
}

export function complianceSummary(rows: readonly ResponderCompliance[]): ComplianceSummary {
  const reasons: ComplianceSummary['reasons'] = {}
  for (const row of rows) {
    for (const { code } of row.exclusions) reasons[code] = (reasons[code] ?? 0) + 1
  }
  const soon = new Set<ExpiryStatus>(['due-30', 'due-60', 'due-90'])
  return {
    responders: rows.length,
    excluded: rows.filter((r) => r.exclusions.length > 0).length,
    reasons,
    dueSoon: rows.filter((r) => soon.has(r.worst)).length,
    auditsOverdue: rows.filter((r) => r.checks.audit.status === 'expired').length,
    clear: rows.filter((r) => r.worst === 'ok').length,
  }
}

/** One check, or `any` for the worst of all three. */
export type CheckFilter = ComplianceCheck | 'any'

export function statusFor(row: ResponderCompliance, filter: CheckFilter): ExpiryStatus {
  return filter === 'any' ? row.worst : row.checks[filter].status
}

export function complianceCounts(
  rows: readonly ResponderCompliance[],
  filter: CheckFilter,
): Record<ExpiryStatus, number> {
  const counts = Object.fromEntries(EXPIRY_STATUSES.map((s) => [s, 0])) as Record<
    ExpiryStatus,
    number
  >
  for (const row of rows) counts[statusFor(row, filter)]++
  return counts
}

export interface ComplianceFilters {
  check: CheckFilter
  /** Null for every status. */
  status: ExpiryStatus | null
  excludedOnly: boolean
}

export function filterCompliance(
  rows: readonly ResponderCompliance[],
  { check: which, status, excludedOnly }: ComplianceFilters,
): ResponderCompliance[] {
  return rows.filter(
    (row) =>
      (status === null || statusFor(row, which) === status) &&
      (!excludedOnly || row.exclusions.length > 0),
  )
}

/** The rows as a CSV table, dates in ISO 8601 so spreadsheets read them as dates. */
export function complianceTable(rows: readonly ResponderCompliance[]): string {
  const date = (at: Timestamp | null) => (at === null ? '' : formatIsoDate(at))
  const header: CsvValue[] = [
    'Responder ID',
    'Responder',
    'Base',
    ...CHECKS.flatMap((c) => [`${CHECK_LABELS[c]} status`, `${CHECK_LABELS[c]} due`]),
    'Last audit',
    'Matching',
    'Reasons',
  ]
  return toCsv([
    header,
    ...rows.map(({ responder, checks, exclusions }) => [
      responder.id,
      responder.name,
      responder.town,
      ...CHECKS.flatMap((c) => [STATUS_LABELS[checks[c].status], date(checks[c].due)]),
      date(responder.lastAuditAt),
      exclusions.length > 0 ? 'Excluded from matching' : 'Eligible',
      exclusions.map((e) => e.label).join('; '),
    ]),
  ])
}
