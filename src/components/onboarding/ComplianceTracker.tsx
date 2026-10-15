import { useMemo, useState } from 'react'
import { ExportButton } from '@/components/ExportButton'
import { StatTile } from '@/components/StatTile'
import { demoTarget } from '@/demo'
import {
  CHECK_LABELS,
  CHECKS,
  complianceCounts,
  complianceSummary,
  complianceTable,
  EXPIRY_STATUSES,
  filterCompliance,
  STATUS_LABELS,
  type CheckFilter,
  type CheckStatus,
  type ComplianceCheck,
  type ComplianceFilters,
  type ExpiryStatus,
  type ResponderCompliance,
} from '@/lib/compliance'
import { formatDate, formatNumber } from '@/lib/format'

interface ComplianceTrackerProps {
  rows: readonly ResponderCompliance[]
  asOf: number
}

const CHECK_FILTERS: { id: CheckFilter; label: string }[] = [
  { id: 'any', label: 'All checks' },
  ...CHECKS.map((c) => ({ id: c, label: CHECK_LABELS[c] })),
]

const BADGE: Record<ExpiryStatus, string> = {
  missing: 'border-danger bg-danger-soft text-danger-ink',
  expired: 'border-danger bg-danger-soft text-danger-ink',
  'due-30': 'border-accent bg-accent-soft text-accent-ink',
  'due-60': 'border-accent text-accent-ink',
  'due-90': 'border-line text-ink-muted',
  ok: 'border-transparent text-ink-subtle',
}

/** An audit past its due date is overdue rather than expired; across all checks it may be either. */
function statusLabel(status: ExpiryStatus, check: CheckFilter): string {
  if (status !== 'expired' || check === 'authorisation' || check === 'insurance') {
    return STATUS_LABELS[status]
  }
  return check === 'audit' ? 'Overdue' : 'Expired or overdue'
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

function CheckCell({ check, status }: { check: ComplianceCheck; status: CheckStatus }) {
  const { due, days } = status
  const when =
    due === null || days === null
      ? 'Nothing on file'
      : days <= 0
        ? `${check === 'audit' ? 'Due' : 'Expired'} ${formatDate(due)}`
        : `${check === 'audit' ? 'Due' : 'Runs to'} ${formatDate(due)}`
  return (
    <td className="px-3 py-3 align-top">
      <span
        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${BADGE[status.status]}`}
      >
        {statusLabel(status.status, check)}
      </span>
      <span className="mt-1 block text-xs whitespace-nowrap text-ink-muted">{when}</span>
    </td>
  )
}

/** HV authorisation, insurance and audits for every responder, and who matching leaves out. */
export function ComplianceTracker({ rows, asOf }: ComplianceTrackerProps) {
  const [filters, setFilters] = useState<ComplianceFilters>({
    check: 'any',
    status: null,
    excludedOnly: false,
  })
  const summary = useMemo(() => complianceSummary(rows), [rows])
  const counts = useMemo(() => complianceCounts(rows, filters.check), [rows, filters.check])
  const shown = useMemo(() => filterCompliance(rows, filters), [rows, filters])
  const firstExcluded = shown.find((row) => row.exclusions.length > 0)
  const set = (patch: Partial<ComplianceFilters>) => setFilters((f) => ({ ...f, ...patch }))

  const reasons = [
    summary.reasons['authorisation-expired'] &&
      `${plural(summary.reasons['authorisation-expired'], 'expired HV authorisation')}`,
    summary.reasons['insurance-expired'] &&
      `${plural(summary.reasons['insurance-expired'], 'expired insurance policy', 'expired insurance policies')}`,
    summary.reasons['authorisation-missing'] &&
      `${plural(summary.reasons['authorisation-missing'], 'missing authorisation expiry', 'missing authorisation expiries')}`,
  ].filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile
          label="Excluded from matching"
          tip="Left out of every job today by the simulator's own eligibility rule: HV authorisation or insurance expired, or no authorisation expiry on file."
          value={formatNumber(summary.excluded)}
          caption={reasons.length > 0 ? reasons.join(', ') : 'Nobody is excluded'}
        />
        <StatTile
          label="Running out within 90 days"
          tip="At least one of HV authorisation, insurance or audit runs out in the next 90 days, and nothing has lapsed yet. Chase these before they become exclusions."
          value={formatNumber(summary.dueSoon)}
          caption={`of ${plural(summary.responders, 'responder')}`}
        />
        <StatTile
          label="Audits overdue"
          tip="Responders are audited for competence and safety at least once a year. An overdue audit does not stop matching today, so it needs following up by hand."
          value={formatNumber(summary.auditsOverdue)}
          caption="Still matched: audits do not affect eligibility"
        />
        <StatTile
          label="Fully in date"
          tip="HV authorisation, insurance and audit all have more than 90 days to run."
          value={formatNumber(summary.clear)}
          caption={`of ${plural(summary.responders, 'responder')}`}
        />
      </div>

      <section
        aria-label="Compliance filters"
        className="rounded-xl border border-line bg-surface p-4 sm:p-5"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span id="compliance-check" className="text-xs text-ink-subtle">
            Check
          </span>
          <div
            role="group"
            aria-labelledby="compliance-check"
            className="flex flex-wrap rounded-lg border border-line bg-surface p-0.5"
          >
            {CHECK_FILTERS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-pressed={filters.check === id}
                onClick={() => set({ check: id })}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  filters.check === id
                    ? 'bg-accent-soft font-medium text-ink'
                    : 'text-ink-subtle hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span id="compliance-status" className="mr-1 text-xs text-ink-subtle">
            Status
          </span>
          <div role="group" aria-labelledby="compliance-status" className="flex flex-wrap gap-2">
            {[null, ...EXPIRY_STATUSES].map((status) => {
              const active = filters.status === status
              const n = status === null ? rows.length : counts[status]
              return (
                <button
                  key={status ?? 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set({ status })}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                    active
                      ? 'border-accent bg-accent-soft font-medium text-ink'
                      : 'border-line text-ink-muted hover:bg-surface-muted hover:text-ink'
                  }`}
                >
                  {status === null ? 'All' : statusLabel(status, filters.check)}
                  <span className="text-xs text-ink-subtle tabular-nums">{formatNumber(n)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={filters.excludedOnly}
              onChange={(e) => set({ excludedOnly: e.target.checked })}
              className="size-4 accent-accent"
            />
            Only responders excluded from matching
          </label>
          <ExportButton
            title="Responder compliance"
            asOf={asOf}
            rows={shown.length}
            table={() => complianceTable(shown)}
          />
        </div>
      </section>

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <caption className="sr-only">
              Responder compliance as at {formatDate(asOf)}, worst first:{' '}
              {plural(shown.length, 'responder')} shown
            </caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Responder
                </th>
                {CHECKS.map((c) => (
                  <th key={c} scope="col" className="px-3 py-2.5 font-medium">
                    {CHECK_LABELS[c]}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Matching
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((row) => (
                <tr
                  key={row.responder.id}
                  {...(row === firstExcluded && demoTarget('excluded-responder'))}
                >
                  <th scope="row" className="px-4 py-3 text-left align-top font-normal">
                    <span className="block font-medium text-ink">{row.responder.name}</span>
                    <span className="block text-xs text-ink-subtle">
                      <span className="font-mono">{row.responder.id}</span> · {row.responder.town}
                    </span>
                  </th>
                  {CHECKS.map((c) => (
                    <CheckCell key={c} check={c} status={row.checks[c]} />
                  ))}
                  <td className="px-4 py-3 align-top">
                    {row.exclusions.length === 0 ? (
                      <span className="text-xs text-ink-muted">Eligible</span>
                    ) : (
                      <>
                        <span className="inline-block rounded-full border border-danger bg-danger-soft px-2 py-0.5 text-xs font-medium whitespace-nowrap text-danger-ink">
                          Excluded from matching
                        </span>
                        <ul className="mt-1 text-xs text-ink-muted">
                          {row.exclusions.map((e) => (
                            <li key={e.code}>{e.label}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {shown.length === 0 && (
          <p className="border-t border-line px-4 py-5 text-sm text-ink-muted">
            No responders match these filters.
          </p>
        )}
      </div>
    </div>
  )
}
