import { describe, expect, it } from 'vitest'
import type { Responder } from '@/types'
import {
  auditDueAt,
  complianceCounts,
  complianceRows,
  complianceSummary,
  complianceTable,
  daysUntil,
  expiryStatus,
  filterCompliance,
  paperworkContext,
  responderCompliance,
  statusFor,
} from './compliance'
import { eligibilityExclusions } from './matching'
import { DAY_MS, HOUR_MS } from './time'

// 09:00 on Wednesday 14 Oct 2026, London time
const AS_OF = Date.UTC(2026, 9, 14, 8, 0)
const inDays = (days: number) => Date.UTC(2026, 9, 14) + days * DAY_MS

function responder(id: string, overrides: Partial<Responder> = {}): Responder {
  return {
    id,
    name: `Responder ${id}`,
    town: 'Leeds',
    region: 'Yorkshire and the Humber',
    lat: 53.8,
    lng: -1.55,
    engineers: 8,
    authorisationLevel: 'authorised-person',
    maxVoltageKv: 11,
    authorisationExpiry: inDays(400),
    insuranceExpiry: inDays(300),
    lastAuditAt: inDays(-100),
    rating: 4.4,
    // No overnight or weekend cover: paperwork alone decides matching here
    availability: { weekends: false, overnight: false, onCallEngineers: 2 },
    rates: { callOutFee: 300, hourlyRate: 100, outOfHoursMultiplier: 1.5 },
    joinedAt: inDays(-500),
    contact: { name: 'Test Person', role: 'Operations director', phone: '07700 900000' },
    ...overrides,
  }
}

describe('expiryStatus', () => {
  it('counts part of a day as a day left', () => {
    expect(daysUntil(inDays(1), AS_OF)).toBe(1)
    expect(daysUntil(AS_OF, AS_OF)).toBe(0)
    expect(daysUntil(inDays(-3), AS_OF)).toBe(-3)
  })

  it('bands by days left, expiring at the moment itself as matching does', () => {
    expect(expiryStatus(null, AS_OF)).toBe('missing')
    expect(expiryStatus(AS_OF, AS_OF)).toBe('expired')
    expect(expiryStatus(AS_OF + 1, AS_OF)).toBe('due-30')
    expect(expiryStatus(inDays(30), AS_OF)).toBe('due-30')
    expect(expiryStatus(inDays(30) + 9 * HOUR_MS, AS_OF)).toBe('due-60')
    expect(expiryStatus(inDays(60), AS_OF)).toBe('due-60')
    expect(expiryStatus(inDays(90), AS_OF)).toBe('due-90')
    expect(expiryStatus(inDays(91), AS_OF)).toBe('ok')
  })

  it('makes an audit due a year after the last one', () => {
    expect(auditDueAt(inDays(-365))).toBe(inDays(0))
  })
})

describe('responderCompliance', () => {
  it('uses the matching rule, judged on paperwork alone', () => {
    const lapsed = responder('RSP-001', { authorisationExpiry: inDays(-12) })
    const row = responderCompliance(lapsed, AS_OF)
    expect(row.exclusions).toEqual(eligibilityExclusions(lapsed, paperworkContext(AS_OF)))
    expect(row.exclusions.map((e) => e.label)).toEqual(['Authorisation expired 2 Oct 2026'])
    expect(row.checks.authorisation).toMatchObject({ status: 'expired', days: -12 })
    expect(row.worst).toBe('expired')
  })

  it('excludes a missing authorisation or expired insurance, but not an overdue audit', () => {
    const codes = (r: Responder) => responderCompliance(r, AS_OF).exclusions.map((e) => e.code)
    expect(codes(responder('RSP-001'))).toEqual([])
    expect(codes(responder('RSP-001', { authorisationExpiry: null }))).toEqual([
      'authorisation-missing',
    ])
    expect(codes(responder('RSP-001', { insuranceExpiry: inDays(-1) }))).toEqual([
      'insurance-expired',
    ])
    const overdue = responderCompliance(responder('RSP-001', { lastAuditAt: inDays(-400) }), AS_OF)
    expect(overdue.exclusions).toEqual([])
    expect(overdue.checks.audit).toMatchObject({ status: 'expired', due: inDays(-35) })
  })
})

describe('rows, counts and filters', () => {
  const rows = complianceRows(
    [
      responder('RSP-001'),
      responder('RSP-002', { insuranceExpiry: inDays(20) }),
      responder('RSP-003', { authorisationExpiry: null }),
      responder('RSP-004', { authorisationExpiry: inDays(-5) }),
      responder('RSP-005', { lastAuditAt: inDays(-320) }),
    ],
    AS_OF,
  )

  it('puts the worst first', () => {
    expect(rows.map((r) => [r.responder.id, r.worst])).toEqual([
      ['RSP-003', 'missing'],
      ['RSP-004', 'expired'],
      ['RSP-002', 'due-30'],
      ['RSP-005', 'due-60'],
      ['RSP-001', 'ok'],
    ])
  })

  it('counts by one check or by the worst of all three', () => {
    expect(complianceCounts(rows, 'any')).toEqual({
      missing: 1,
      expired: 1,
      'due-30': 1,
      'due-60': 1,
      'due-90': 0,
      ok: 1,
    })
    expect(complianceCounts(rows, 'insurance')).toMatchObject({ 'due-30': 1, ok: 4 })
    expect(statusFor(rows[3] as (typeof rows)[number], 'audit')).toBe('due-60')
  })

  it('sums up who is excluded, why, and what is due', () => {
    expect(complianceSummary(rows)).toEqual({
      responders: 5,
      excluded: 2,
      reasons: { 'authorisation-missing': 1, 'authorisation-expired': 1 },
      dueSoon: 2,
      auditsOverdue: 0,
      clear: 1,
    })
  })

  it('filters by status and by exclusion from matching', () => {
    const ids = (f: Parameters<typeof filterCompliance>[1]) =>
      filterCompliance(rows, f).map((r) => r.responder.id)
    expect(ids({ check: 'any', status: null, excludedOnly: false })).toHaveLength(5)
    expect(ids({ check: 'insurance', status: 'due-30', excludedOnly: false })).toEqual(['RSP-002'])
    expect(ids({ check: 'any', status: null, excludedOnly: true })).toEqual(['RSP-003', 'RSP-004'])
    expect(ids({ check: 'audit', status: 'ok', excludedOnly: true })).toEqual([
      'RSP-003',
      'RSP-004',
    ])
  })

  it('exports dates in ISO 8601 with the matching decision and its reasons', () => {
    const lines = complianceTable(rows.slice(0, 2)).split('\r\n')
    expect(lines[0]).toBe(
      'Responder ID,Responder,Base,HV authorisation status,HV authorisation due,Insurance status,Insurance due,Competence audit status,Competence audit due,Last audit,Matching,Reasons',
    )
    expect(lines[1]).toBe(
      'RSP-003,Responder RSP-003,Leeds,Missing,,OK,2027-08-10,OK,2027-07-06,2026-07-06,Excluded from matching,No authorisation expiry on file',
    )
    expect(lines[2]).toContain('Expired,2026-10-09')
    expect(lines.at(-1)).toBe('')
  })
})
