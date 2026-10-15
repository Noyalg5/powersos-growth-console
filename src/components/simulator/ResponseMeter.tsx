import { formatDuration, formatTime } from '@/lib/format'
import { RESPONSE_TARGET_MINUTES } from '@/lib/geo'
import type { EtaStatus, ResponseProgress } from '@/lib/scenario'
import { MINUTE_MS } from '@/lib/time'

const STATUS: Record<EtaStatus, { bar: string; text: string; label: string }> = {
  'on-track': { bar: 'bg-ink-muted', text: 'text-ink-muted', label: 'On track' },
  'near-target': { bar: 'bg-accent', text: 'text-accent-ink', label: 'Near the target' },
  'past-target': { bar: 'bg-danger', text: 'text-danger-ink', label: 'Past the target' },
}

/** "Near the target: 10 min to spare", "Past the target by 40 min". */
function describeResponse(expected: number | null, status: EtaStatus | null): string {
  if (expected === null || status === null) return 'Waiting for a responder to accept'
  const target = RESPONSE_TARGET_MINUTES
  const { label } = STATUS[status]
  return expected > target
    ? `${label} by ${formatDuration(expected - target)}`
    : `${label}: ${formatDuration(target - expected)} to spare`
}

interface ResponseMeterProps {
  progress: ResponseProgress
  requestedAt: number
}

/** Live ETA against the 75-minute target: amber near it, red past it. */
export function ResponseMeter({ progress, requestedAt }: ResponseMeterProps) {
  const { elapsedMinutes, expectedMinutes, arrived, status } = progress
  const target = RESPONSE_TARGET_MINUTES
  // Leave room past the target so a late arrival still fits on the bar
  const scale = Math.max(target * 1.6, (expectedMinutes ?? 0) * 1.1)
  const pct = (minutes: number) => `${Math.min(100, (minutes / scale) * 100)}%`
  const style = status ? STATUS[status] : null
  const arrivesAt = expectedMinutes === null ? null : requestedAt + expectedMinutes * MINUTE_MS

  return (
    <section aria-labelledby="response-heading" className="rounded-xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="response-heading" className="text-sm font-semibold text-ink">
          Response time
        </h2>
        <span className="text-xs text-ink-subtle">Target {formatDuration(target)}</span>
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-ink tabular-nums">
        {expectedMinutes === null ? formatDuration(elapsedMinutes) : formatDuration(expectedMinutes)}
      </p>
      <p className={`mt-1 text-sm font-medium ${style?.text ?? 'text-ink-subtle'}`}>
        {describeResponse(expectedMinutes, status)}
      </p>

      <div
        role="meter"
        aria-label="Response time against the 75-minute target"
        aria-valuemin={0}
        aria-valuemax={Math.round(scale)}
        aria-valuenow={expectedMinutes ?? elapsedMinutes}
        aria-valuetext={`${expectedMinutes === null ? 'Elapsed' : 'Expected'} ${formatDuration(expectedMinutes ?? elapsedMinutes)}, target ${formatDuration(target)}`}
        className="relative mt-4 h-3 rounded-full bg-surface-muted"
      >
        {expectedMinutes !== null && (
          <div
            className={`absolute inset-y-0 left-0 rounded-full opacity-35 transition-[width] duration-500 motion-reduce:transition-none ${style?.bar ?? ''}`}
            style={{ width: pct(expectedMinutes) }}
          />
        )}
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 motion-reduce:transition-none ${style?.bar ?? 'bg-ink-subtle'}`}
          style={{ width: pct(elapsedMinutes) }}
        />
        <div
          className="absolute -inset-y-1 w-0.5 rounded-full bg-ink"
          style={{ left: pct(target) }}
          aria-hidden="true"
        />
      </div>
      <div className="relative mt-1.5 h-4 text-[11px] text-ink-subtle tabular-nums" aria-hidden="true">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(target) }}>
          {formatDuration(target)}
        </span>
      </div>

      <dl className="mt-3 space-y-1 text-xs">
        <div className="flex justify-between gap-3">
          <dt className="text-ink-subtle">Elapsed</dt>
          <dd className="text-ink tabular-nums">{formatDuration(elapsedMinutes)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-ink-subtle">{arrived ? 'Arrived' : 'Expected on site'}</dt>
          <dd className="text-ink tabular-nums">{arrivesAt === null ? '—' : formatTime(arrivesAt)}</dd>
        </div>
      </dl>
    </section>
  )
}
