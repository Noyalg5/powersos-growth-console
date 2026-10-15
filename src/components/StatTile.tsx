import type { ReactNode } from 'react'
import { InfoTip } from './InfoTip'

/** A headline figure with a label, a "what this means" tip and a caption underneath. */
export function StatTile({
  label,
  tip,
  value,
  caption,
  compact = false,
  children,
}: {
  label: string
  tip: string
  value: string
  caption: string
  /** Tighter, for a summary that has to fit on one screen. */
  compact?: boolean
  children?: ReactNode
}) {
  return (
    <div className={`relative rounded-xl border border-line bg-surface p-4 ${compact ? '' : 'sm:p-5'}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs leading-snug text-ink-subtle">{label}</h3>
        <InfoTip topic={label.toLowerCase()}>{tip}</InfoTip>
      </div>
      <p
        className={`font-semibold tracking-tight text-ink ${compact ? 'mt-1 text-xl' : 'mt-2 text-2xl'}`}
      >
        {value}
      </p>
      {children}
      {caption && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{caption}</p>}
    </div>
  )
}
