import { CheckIcon } from '@/components/icons'
import { formatGBP, formatPercent, formatTime } from '@/lib/format'
import type { CostLine, CostLineStatus, CostSnapshot } from '@/lib/scenario'

interface CostPanelProps {
  cost: CostSnapshot
  /** Index of the current step, and of the customer's approval step. */
  step: number
  approvalStep: number
  approvedAt: number
  approver: string
}

function statusLabel(line: CostLine, status: CostLineStatus): string {
  if (status === 'pending') return 'Predicted at the match'
  if (line.amount === 0) return 'Not needed'
  if (status === 'committed') return line.committedAt === 'source' ? 'Approved' : 'Committed'
  if (line.committedAt === 'source') return 'Estimate, awaiting approval'
  return line.key === 'labour' ? 'Estimate, billed when resolved' : 'Estimate'
}

/** The running cost of the job, building up as each charge is committed. */
export function CostPanel({ cost, step, approvalStep, approvedAt, approver }: CostPanelProps) {
  const share = cost.predicted ? cost.committed / cost.predicted : 0
  const approved = step >= approvalStep

  return (
    <section aria-labelledby="cost-heading" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="cost-heading" className="text-sm font-semibold text-ink">
          Running cost
        </h2>
        <span className="text-xs text-ink-subtle tabular-nums">
          {cost.predicted === null ? 'No prediction yet' : `Predicted ${formatGBP(cost.predicted)}`}
        </span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">
        {formatGBP(cost.committed)}
      </p>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={`${formatPercent(share)} of the predicted cost committed`}
      >
        <div
          className="h-full rounded-full bg-ink-muted transition-[width] duration-500 motion-reduce:transition-none"
          style={{ width: `${share * 100}%` }}
        />
      </div>

      <ul className="mt-4 divide-y divide-line">
        {cost.lines.map(({ line, status }) => (
          <li key={line.key} className="py-2.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className={status === 'committed' ? 'text-ink' : 'text-ink-muted'}>
                {line.label}
              </span>
              <span
                className={`tabular-nums ${
                  status === 'committed' ? 'font-medium text-ink' : 'text-ink-subtle'
                }`}
              >
                {status === 'pending' ? '—' : formatGBP(line.amount)}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-ink-subtle">{statusLabel(line, status)}</p>
            {status !== 'pending' && line.amount > 0 && (
              <p className="mt-0.5 text-xs leading-relaxed text-ink-subtle">{line.basis}</p>
            )}
          </li>
        ))}
      </ul>

      <p
        className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
          approved ? 'bg-surface-muted text-ink-muted' : 'bg-accent-soft text-accent-ink'
        }`}
      >
        {approved && <CheckIcon width={14} height={14} className="mt-px shrink-0" />}
        {approved
          ? `Approved by ${approver} at ${formatTime(approvedAt)}. Parts and hire were ordered after approval.`
          : 'Parts and hire are only ordered once the customer approves the estimate.'}
      </p>
    </section>
  )
}
