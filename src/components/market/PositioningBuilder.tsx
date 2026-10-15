import { useEffect, useId, useState } from 'react'
import { CheckIcon } from '@/components/icons'
import {
  applyEdits,
  POSITIONING_FIELDS,
  POSITIONING_MAX_LENGTH,
  positioningParts,
  positioningStatement,
  type Positioning,
  type PositioningField,
} from '@/lib/positioning'

interface PositioningBuilderProps {
  /** The statement as the top sector fills it. */
  suggested: Positioning
  /** The sector it is filled from. */
  sectorLabel: string | null
  edits: Partial<Positioning>
  onEdit: (field: PositioningField, text: string | null) => void
}

/** "For [segment] who [need], PowerSOS is [category] that [benefit], unlike [alternative]." */
export function PositioningBuilder({
  suggested,
  sectorLabel,
  edits,
  onEdit,
}: PositioningBuilderProps) {
  const id = useId()
  const [copied, setCopied] = useState(false)
  const filled = applyEdits(suggested, edits)
  const statement = positioningStatement(filled)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(statement)
      setCopied(true)
    } catch {
      // Clipboard blocked: the statement is still on screen to select by hand
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <div className="space-y-3">
        {POSITIONING_FIELDS.map((f) => {
          const fieldId = `${id}-${f.id}`
          const edited = edits[f.id] !== undefined
          return (
            <div key={f.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <label htmlFor={fieldId} className="text-xs text-ink-subtle">
                  <span className="font-medium text-ink-muted">{f.lead} …</span>{' '}
                  {f.label.toLowerCase()}
                </label>
                {edited ? (
                  <button
                    type="button"
                    onClick={() => onEdit(f.id, null)}
                    className="text-[11px] font-medium text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
                  >
                    Use {sectorLabel ? 'top sector' : 'suggestion'}
                    <span className="sr-only"> for the {f.label.toLowerCase()}</span>
                  </button>
                ) : (
                  sectorLabel && (
                    <span className="text-[11px] text-ink-subtle">From {sectorLabel}</span>
                  )
                )}
              </div>
              <textarea
                id={fieldId}
                rows={f.id === 'benefit' ? 3 : 2}
                maxLength={POSITIONING_MAX_LENGTH}
                value={edits[f.id] ?? suggested[f.id]}
                onChange={(e) =>
                  onEdit(f.id, e.target.value === suggested[f.id] ? null : e.target.value)
                }
                className={`w-full resize-y rounded-lg border bg-surface px-2.5 py-1.5 text-sm leading-snug text-ink focus-visible:border-accent ${
                  edited ? 'border-accent' : 'border-line'
                }`}
              />
            </div>
          )
        })}
      </div>

      <div className="self-start rounded-xl border border-line bg-surface p-5">
        <p className="text-xs font-medium tracking-wide text-ink-subtle uppercase">
          Positioning statement
        </p>
        <blockquote
          className="mt-3 text-lg leading-relaxed text-pretty text-ink-muted"
          aria-live="polite"
        >
          {positioningParts(filled).map((part) => (
            <span key={part.field}>
              {part.before}
              <span className="font-medium text-ink">{part.text}</span>
            </span>
          ))}
          .
        </blockquote>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
          >
            {copied && <CheckIcon width={16} height={16} />}
            {copied ? 'Copied' : 'Copy statement'}
          </button>
          <p className="text-xs text-ink-subtle">
            {sectorLabel
              ? `Filled from the current top sector, ${sectorLabel}, and from where PowerSOS beats the alternative in the table above. Edit any part.`
              : 'Rank the sectors on the first tab to fill this from the top sector.'}
          </p>
        </div>
      </div>
    </div>
  )
}
