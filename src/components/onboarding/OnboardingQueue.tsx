import { Fragment, useState } from 'react'
import { CheckIcon, ChevronDownIcon } from '@/components/icons'
import { STALE_AFTER_DAYS } from '@/lib/dataQuality'
import { formatDate, formatNumber } from '@/lib/format'
import { SIDE_LABELS, type OnboardingProgress } from '@/lib/onboarding'
import { DAY_MS } from '@/lib/time'
import type { SideId } from '@/types'

interface OnboardingQueueProps {
  side: SideId
  queue: readonly OnboardingProgress[]
  asOf: number
}

const days = (n: number) => `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`

function Checklist({ progress, asOf }: { progress: OnboardingProgress; asOf: number }) {
  return (
    <div className="grid gap-4 px-4 py-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <ol className="space-y-2">
        {progress.items.map((item) => {
          const booked = !item.done && item.doneAt !== null && item.doneAt > asOf
          return (
            <li key={item.id} className="flex items-start gap-2.5 text-sm">
              <span
                className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  item.done
                    ? 'border-ink-muted bg-ink-muted text-surface'
                    : 'border-line bg-surface'
                }`}
                aria-hidden="true"
              >
                {item.done && <CheckIcon width={14} height={14} strokeWidth={2.5} />}
              </span>
              <span className="min-w-0">
                <span className={item.done ? 'text-ink' : 'font-medium text-ink'}>
                  {item.label}
                </span>
                <span className="block text-xs text-ink-muted">
                  {item.done ? (
                    `Done ${formatDate(item.doneAt ?? 0)}`
                  ) : booked ? (
                    <span className="text-accent-ink">
                      Logged as done on {formatDate(item.doneAt ?? 0)}, after the data date
                    </span>
                  ) : item.id === progress.next?.id ? (
                    'Outstanding: next up'
                  ) : (
                    'Outstanding'
                  )}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 self-start text-xs sm:grid-cols-1">
        <div>
          <dt className="text-ink-subtle">Signed</dt>
          <dd className="text-ink">{formatDate(progress.signedAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Last progress</dt>
          <dd className="text-ink">{formatDate(progress.lastProgressAt)}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Organisation</dt>
          <dd className="font-mono text-ink">{progress.record.orgId}</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Based in</dt>
          <dd className="text-ink">{progress.record.town}</dd>
        </div>
      </dl>
    </div>
  )
}

/** Organisations signed and working through their checklist, with the full list a click away. */
export function OnboardingQueue({ side, queue, asOf }: OnboardingQueueProps) {
  const [open, setOpen] = useState<string | null>(null)
  const who = SIDE_LABELS[side].many.toLowerCase()

  if (queue.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
        No {who} are onboarding right now.
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <caption className="sr-only">
            {SIDE_LABELS[side].many} onboarding now, longest since signing first. Select a name to
            see its full checklist.
          </caption>
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              <th scope="col" className="px-4 py-2.5 font-medium">
                Organisation
              </th>
              <th scope="col" className="px-3 py-2.5 font-medium">
                Signed
              </th>
              <th scope="col" className="w-[28%] px-3 py-2.5 font-medium">
                Checklist
              </th>
              <th scope="col" className="px-4 py-2.5 font-medium">
                Next item
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {queue.map((progress) => {
              const { record } = progress
              const expanded = open === record.id
              const stale = asOf - progress.lastProgressAt > STALE_AFTER_DAYS * DAY_MS
              const panelId = `checklist-${record.id}`
              return (
                <Fragment key={record.id}>
                  <tr
                    className={`cursor-pointer align-top ${expanded ? 'bg-surface-muted' : 'hover:bg-surface-muted'}`}
                    onClick={() => setOpen(expanded ? null : record.id)}
                  >
                    <th scope="row" className="px-4 py-3 text-left font-normal">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={panelId}
                        className="inline-flex items-start gap-1.5 rounded text-left font-medium text-ink"
                      >
                        <ChevronDownIcon
                          width={16}
                          height={16}
                          className={`mt-0.5 shrink-0 text-ink-subtle transition-transform ${expanded ? '' : '-rotate-90'}`}
                        />
                        {record.name}
                      </button>
                      <span className="block pl-5.5 text-xs text-ink-subtle">{record.town}</span>
                    </th>
                    <td className="px-3 py-3 whitespace-nowrap text-ink-muted">
                      {formatDate(progress.signedAt)}
                      <span className="block text-xs text-ink-subtle">
                        {days(progress.daysSinceSigned)} ago
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
                          aria-hidden="true"
                        >
                          <div
                            className="h-full rounded-full bg-ink-muted"
                            style={{ width: `${(progress.done / progress.total) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs whitespace-nowrap text-ink tabular-nums">
                          {progress.done} of {progress.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {progress.next?.label ?? 'Ready to go live'}
                      {stale && (
                        <span className="mt-0.5 block text-xs font-medium text-accent-ink">
                          No progress for{' '}
                          {days(Math.floor((asOf - progress.lastProgressAt) / DAY_MS))}
                        </span>
                      )}
                    </td>
                  </tr>
                  {expanded && (
                    <tr id={panelId} className="bg-surface-muted/50">
                      <td colSpan={4}>
                        <Checklist progress={progress} asOf={asOf} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
