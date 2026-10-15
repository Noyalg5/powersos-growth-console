import { useEffect, useRef } from 'react'
import { CheckIcon } from '@/components/icons'
import { formatDateTime, formatDuration, formatTime } from '@/lib/format'
import type { StepView } from '@/lib/scenario'

interface StepTimelineProps {
  steps: readonly StepView[]
  current: number
  /** While playing, the current step shows how long until the next one. */
  playingFor: number | null
  onSelect: (index: number) => void
}

export function StepTimeline({ steps, current, playingFor, onSelect }: StepTimelineProps) {
  const list = useRef<HTMLOListElement>(null)

  // Keep the current step in view on narrow screens, scrolling only the timeline
  useEffect(() => {
    const container = list.current?.parentElement
    const item = list.current?.children[current] as HTMLElement | undefined
    if (!container || !item) return
    const left = item.offsetLeft - (container.clientWidth - item.clientWidth) / 2
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [current])

  return (
    <nav aria-label="Incident timeline" className="overflow-x-auto">
      <ol ref={list} className="relative flex min-w-max gap-1 p-2 lg:min-w-0">
        {steps.map((step) => {
          const active = step.index === current
          const done = step.index < current
          return (
            <li key={step.id} className="relative w-30 shrink-0 lg:w-auto lg:flex-1">
              <button
                type="button"
                onClick={() => onSelect(step.index)}
                aria-current={active ? 'step' : undefined}
                title={formatDateTime(step.at)}
                className={`w-full rounded-lg px-3 py-2.5 text-left transition-colors ${
                  active ? 'bg-accent-soft' : 'hover:bg-surface-muted'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums ${
                      active
                        ? 'bg-accent text-on-accent'
                        : done
                          ? 'bg-ink-muted text-surface'
                          : 'border border-line text-ink-subtle'
                    }`}
                  >
                    {done ? <CheckIcon width={12} height={12} strokeWidth={3} /> : step.index + 1}
                  </span>
                  <span
                    className={`truncate text-sm font-medium ${active || done ? 'text-ink' : 'text-ink-muted'}`}
                  >
                    {step.label}
                  </span>
                </span>
                <span className="mt-1 block pl-7 text-xs text-ink-subtle tabular-nums">
                  {formatTime(step.at)}
                  <span className="block">+{formatDuration(step.minutesSinceRequest)}</span>
                </span>
              </button>
              {active && playingFor !== null && (
                <span
                  key={`${step.id}-${playingFor}`}
                  aria-hidden="true"
                  className="absolute inset-x-3 bottom-0.5 h-0.5 origin-left rounded-full bg-accent motion-safe:animate-step-progress motion-reduce:hidden"
                  style={{ animationDuration: `${playingFor}ms` }}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
