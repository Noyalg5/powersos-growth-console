import { CheckIcon } from '@/components/icons'
import { formatTime } from '@/lib/format'
import type { Screen, ScreenTone, SideId, StepId } from '@/lib/scenario'

const SIDE_LABELS: Record<SideId, string> = {
  customer: 'Customer',
  responder: 'Responder',
  supplier: 'Supplier',
  partner: 'Partner',
}

const TONE_STYLES: Record<ScreenTone, { card: string; dot: string; label: string }> = {
  alert: { card: 'border-accent bg-accent-soft', dot: 'bg-accent', label: 'Urgent' },
  warning: { card: 'border-accent', dot: 'bg-accent', label: 'Needs action' },
  danger: { card: 'border-danger bg-danger-soft', dot: 'bg-danger', label: 'Late' },
  success: { card: 'border-line', dot: 'bg-ink-muted', label: 'Done' },
  info: { card: 'border-line', dot: 'bg-line', label: 'Update' },
}

interface SidePanelProps {
  side: SideId
  /** Who this side is in the scenario. */
  who: string
  workingDefinition: boolean
  step: StepId
  stepLabel: string
  at: number
  screens: readonly Screen[]
}

/** One side's phone at the current step: its notifications, or a quiet "No action". */
export function SidePanel({
  side,
  who,
  workingDefinition,
  step,
  stepLabel,
  at,
  screens,
}: SidePanelProps) {
  const headingId = `side-${side}`
  return (
    <section aria-labelledby={headingId} className="flex min-w-0 flex-col">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={headingId} className="text-sm font-semibold text-ink">
          {SIDE_LABELS[side]}
        </h3>
        {workingDefinition && (
          <span className="text-[11px] whitespace-nowrap text-ink-subtle">Working definition</span>
        )}
      </div>
      <p className="mt-0.5 truncate text-xs text-ink-muted" title={who}>
        {who}
      </p>

      <div className="mt-3 flex flex-1 flex-col rounded-[1.75rem] border border-line bg-surface-muted p-1.5">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[1.4rem] border border-line bg-surface">
          <div
            className="flex items-center justify-between px-4 pt-2.5 pb-1 text-[11px] font-medium text-ink-subtle tabular-nums"
            aria-hidden="true"
          >
            <span>{formatTime(at)}</span>
            <span className="h-1.5 w-12 rounded-full bg-line" />
            <span>{stepLabel}</span>
          </div>
          <div key={step} className="flex flex-1 flex-col gap-2 p-3 motion-safe:animate-screen-in">
            {screens.length > 0 ? (
              screens.map((screen, i) => <ScreenCard key={i} screen={screen} />)
            ) : (
              <NoAction side={side} />
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function ScreenCard({ screen }: { screen: Screen }) {
  const tone = TONE_STYLES[screen.tone]
  return (
    <article className={`rounded-xl border-l-[3px] border-y border-r p-3 ${tone.card}`}>
      <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
        <span className={`size-1.5 shrink-0 rounded-full ${tone.dot}`} aria-hidden="true" />
        <span className="sr-only">{tone.label}: </span>
        <span className="truncate">{screen.org}</span>
      </p>
      <h4 className="mt-1 text-sm leading-snug font-semibold text-ink">{screen.title}</h4>
      {screen.body && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{screen.body}</p>}
      {screen.rows && screen.rows.length > 0 && (
        <dl className="mt-2 space-y-1 text-xs">
          {screen.rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <dt className="min-w-0 text-ink-subtle">{row.label}</dt>
              <dd className="min-w-0 text-right text-ink tabular-nums">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {screen.action && (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-md px-2.5 py-1 font-medium ${
              screen.done ? 'bg-surface-muted text-ink-subtle' : 'bg-accent text-on-accent'
            }`}
          >
            {screen.action}
          </span>
        </p>
      )}
      {screen.done && (
        <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-muted">
          <CheckIcon width={14} height={14} className="mt-px shrink-0" />
          {screen.done}
        </p>
      )}
    </article>
  )
}

function NoAction({ side }: { side: SideId }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      <span className="size-8 rounded-full border border-dashed border-line" aria-hidden="true" />
      <p className="text-sm font-medium text-ink-subtle">No action</p>
      <p className="max-w-[14rem] text-xs text-ink-subtle">
        Nothing for the {SIDE_LABELS[side].toLowerCase()} to do at this step.
      </p>
    </div>
  )
}
