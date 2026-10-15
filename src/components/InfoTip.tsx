import { useId, type ReactNode } from 'react'
import { InfoIcon } from './icons'

interface InfoTipProps {
  /** What the tip explains, for the button's accessible name. */
  topic: string
  children: ReactNode
}

/**
 * A small "what this means" tip, shown on hover or keyboard focus. The tip is
 * positioned against the nearest positioned ancestor, so put it inside a card
 * with `relative` and the tip spans the card.
 */
export function InfoTip({ topic, children }: InfoTipProps) {
  const id = useId()
  return (
    <span className="group inline-flex">
      <button
        type="button"
        aria-label={`What ${topic} means`}
        aria-describedby={id}
        className="-m-1 rounded-full p-1 text-ink-subtle transition-colors hover:text-ink focus-visible:text-ink"
      >
        <InfoIcon width={16} height={16} />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute inset-x-3 top-full z-20 mt-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs leading-relaxed text-ink-muted opacity-0 shadow-lg transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        {children}
      </span>
    </span>
  )
}
