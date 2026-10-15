import { formatNumber, formatPercent } from '@/lib/format'
import {
  ACTIVE_WINDOW_DAYS,
  ACTIVITY,
  MOVE_ON,
  STEP_LABELS,
  type Funnel,
  type FunnelTransition,
  type Leak,
} from '@/lib/onboarding'

interface FunnelViewProps {
  funnel: Funnel
  leak: Leak | null
}

const count = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

/** What happens to the organisations at a stage: how many move on, and where the rest are. */
function Outgoing({ t, isLeak }: { t: FunnelTransition; isLeak: boolean }) {
  const toActive = t.to === 'active'
  const split = toActive
    ? [
        t.left > 0 && `${formatNumber(t.left)} cancelled`,
        t.waiting > 0 && `${formatNumber(t.waiting)} quiet`,
      ]
    : [
        t.left > 0 && `${formatNumber(t.left)} lost`,
        t.waiting > 0 && `${formatNumber(t.waiting)} still here`,
      ]
  return (
    <div className="mt-4 border-t border-line pt-3 text-xs leading-relaxed">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium text-ink">
          <span aria-hidden="true">→ </span>
          {t.conversion === null ? '–' : formatPercent(t.conversion)} {MOVE_ON[t.to]}
        </span>
        {isLeak && (
          <span className="rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-medium text-on-accent">
            Biggest leak
          </span>
        )}
      </p>
      <p className="text-ink-muted">
        {t.dropped === 0
          ? 'No drop-off'
          : `${count(t.dropped, 'drops off', 'drop off')}: ${split.filter(Boolean).join(', ')}`}
      </p>
      <p className="text-ink-subtle">
        {toActive
          ? `Measured over the last ${ACTIVE_WINDOW_DAYS} days`
          : t.medianDays === null
            ? 'No one has moved on yet'
            : `Median ${count(t.medianDays, 'day')} at this stage`}
      </p>
    </div>
  )
}

/** One side's funnel: a card per stage, each with what happens next. */
export function FunnelView({ funnel, leak }: FunnelViewProps) {
  return (
    <ol className="grid gap-3 lg:grid-cols-5">
      {funnel.steps.map((step, i) => {
        const outgoing = funnel.transitions[i]
        const isLeak = outgoing !== undefined && leak?.transition === outgoing
        return (
          <li
            key={step.step}
            className={`flex flex-col rounded-xl border bg-surface p-4 ${isLeak ? 'border-accent' : 'border-line'}`}
          >
            <p className="text-xs text-ink-subtle">
              <span className="font-mono">{i + 1}</span> · {STEP_LABELS[step.step]}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">
              {formatNumber(step.reached)}
            </p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-ink-muted"
                style={{ width: `${step.shareOfTop * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-muted">
              {i === 0
                ? 'Every organisation in touch'
                : `${formatPercent(step.shareOfTop)} of aware`}
            </p>
            <div className="mt-auto">
              {outgoing ? (
                <Outgoing t={outgoing} isLeak={isLeak} />
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-xs leading-relaxed text-ink-subtle">
                  Live members that {ACTIVITY[funnel.side]} in the last {ACTIVE_WINDOW_DAYS} days.
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
