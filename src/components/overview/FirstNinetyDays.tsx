import { useEffect, useRef, useState } from 'react'
import { RestartIcon } from '@/components/icons'
import { usePersistentState } from '@/components/usePersistentState'
import { PLAN_TEXT_MAX_LENGTH, restorePlan, type NinetyDayPlan } from '@/lib/overview'
import { STORAGE_KEYS } from '@/storageKeys'

const DEFAULT_PLAN: NinetyDayPlan = [
  'Learn the platform, interview users on all four sides, baseline the KPIs.',
  'Early-adopter pilots in the top sector, launch the partner referral channel, close the biggest coverage gap.',
  'First campaign and trade show, onboarding playbook v1, report results to MPN and the university.',
]

const MONTHS = [0, 1, 2] as const

interface FirstNinetyDaysProps {
  /** What "the top sector" and "the biggest coverage gap" are today, for context. */
  today: string | null
}

/** My plan for the first three months, editable and kept in this browser. */
export function FirstNinetyDays({ today }: FirstNinetyDaysProps) {
  const plan = usePersistentState(STORAGE_KEYS.firstNinetyDays, DEFAULT_PLAN, restorePlan)
  const [editing, setEditing] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)
  const firstField = useRef<HTMLTextAreaElement>(null)
  const opened = useRef(false)

  // Into the first month on opening the editor; back to the button on closing it
  useEffect(() => {
    if (editing) firstField.current?.focus()
    else if (opened.current) toggle.current?.focus()
    opened.current = editing
  }, [editing])

  const setMonth = (i: (typeof MONTHS)[number], text: string) => {
    const next: [string, string, string] = [...plan.value]
    next[i] = text
    plan.set(next)
  }

  const status = !plan.saved
    ? 'This browser is blocking storage, so edits last until you leave the page.'
    : plan.edited
      ? 'Your edits are saved in this browser.'
      : 'Edits are saved in this browser.'

  return (
    <section
      aria-labelledby="plan-heading"
      className="flex flex-col rounded-xl border border-line bg-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="plan-heading" className="text-sm font-semibold text-ink">
          My first 90 days
        </h2>
        <div className="flex items-center gap-2">
          {plan.edited && (
            <button
              type="button"
              onClick={plan.reset}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-muted hover:bg-surface-muted hover:text-ink"
            >
              <RestartIcon width={14} height={14} />
              Reset<span className="sr-only"> the 90-day plan to the defaults</span>
            </button>
          )}
          <button
            ref={toggle}
            type="button"
            onClick={() => setEditing(!editing)}
            aria-expanded={editing}
            className="inline-flex h-8 items-center rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:bg-surface-muted"
          >
            {editing ? 'Done' : 'Edit'}
            <span className="sr-only"> the 90-day plan</span>
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          {MONTHS.map((i) => (
            <div key={i}>
              <label
                htmlFor={`plan-month-${i + 1}`}
                className="block text-xs font-medium text-ink-subtle"
              >
                Month {i + 1}
              </label>
              <textarea
                ref={i === 0 ? firstField : undefined}
                id={`plan-month-${i + 1}`}
                rows={2}
                maxLength={PLAN_TEXT_MAX_LENGTH}
                value={plan.value[i]}
                onChange={(e) => setMonth(i, e.target.value)}
                className="mt-1 block w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink placeholder:text-ink-subtle"
                placeholder="Nothing planned yet"
              />
            </div>
          ))}
        </div>
      ) : (
        <ol className="mt-3 space-y-1.5">
          {MONTHS.map((i) => (
            <li key={i} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2 text-sm">
              <span className="pt-px font-mono text-xs text-accent-ink">Month {i + 1}</span>
              <p className="leading-relaxed text-ink">
                {plan.value[i].trim() || <span className="text-ink-subtle">Nothing planned yet.</span>}
              </p>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-auto flex flex-wrap justify-between gap-x-4 gap-y-1 pt-3 text-xs text-ink-subtle">
        {today && <p>{today}</p>}
        <p role="status">{status}</p>
      </div>
    </section>
  )
}
