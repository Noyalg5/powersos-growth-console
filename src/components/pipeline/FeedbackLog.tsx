import { useId, useState, type FormEvent } from 'react'
import { CloseIcon } from '@/components/icons'
import { SectionHeading } from '@/components/SectionHeading'
import { THEME_LABELS } from '@/data'
import { formatDate, formatNumber } from '@/lib/format'
import { parseIsoDate, toIsoDate } from '@/lib/networkFilters'
import { SIDE_LABELS } from '@/lib/onboarding'
import {
  ORGANISATION_MAX_LENGTH,
  QUOTE_MAX_LENGTH,
  themeCounts,
  THEME_IDS,
  type FeedbackDraft,
} from '@/lib/rice'
import { SIDES } from '@/lib/scenario'
import type { FeedbackEntry, SideId, ThemeId } from '@/types'
import { control, Field } from './Field'

interface FeedbackLogProps {
  feedback: readonly FeedbackEntry[]
  onAdd: (draft: FeedbackDraft) => void
  onRemove: (id: string) => void
  /** Suggestions for the organisation box. */
  organisations: readonly string[]
  asOf: number
}

const SHOWN = 6

const mentions = (n: number) => `${formatNumber(n)} ${n === 1 ? 'mention' : 'mentions'}`

function FeedbackForm({
  organisations,
  asOf,
  onAdd,
  onDone,
}: Pick<FeedbackLogProps, 'organisations' | 'asOf' | 'onAdd'> & { onDone: () => void }) {
  const id = useId()
  const [organisation, setOrganisation] = useState('')
  const [side, setSide] = useState<SideId>('customer')
  const [theme, setTheme] = useState<ThemeId>(THEME_IDS[0] as ThemeId)
  const [date, setDate] = useState(toIsoDate(asOf - (asOf % 86_400_000)))
  const [quote, setQuote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const day = parseIsoDate(date)
    if (organisation.trim() === '') return setError('Add the organisation the feedback came from.')
    if (quote.trim() === '') return setError('Add what they said.')
    if (day === null) return setError('Enter the date it was said.')
    onAdd({ organisation, side, theme, quote, date: day })
    onDone()
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-3 rounded-xl border border-line bg-surface p-4 sm:p-5"
      aria-labelledby={`${id}-title`}
    >
      <h3 id={`${id}-title`} className="text-sm font-semibold text-ink">
        Log feedback
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Organisation" htmlFor={`${id}-org`}>
          <input
            id={`${id}-org`}
            className={control}
            list={`${id}-orgs`}
            value={organisation}
            maxLength={ORGANISATION_MAX_LENGTH}
            autoComplete="off"
            onChange={(e) => setOrganisation(e.target.value)}
          />
          <datalist id={`${id}-orgs`}>
            {organisations.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </Field>
        <Field label="Side" htmlFor={`${id}-side`}>
          <select
            id={`${id}-side`}
            className={control}
            value={side}
            onChange={(e) => setSide(e.target.value as SideId)}
          >
            {SIDES.map((s) => (
              <option key={s} value={s}>
                {SIDE_LABELS[s].one}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Theme" htmlFor={`${id}-theme`}>
          <select
            id={`${id}-theme`}
            className={control}
            value={theme}
            onChange={(e) => setTheme(e.target.value as ThemeId)}
          >
            {THEME_IDS.map((t) => (
              <option key={t} value={t}>
                {THEME_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date" htmlFor={`${id}-date`}>
          <input
            id={`${id}-date`}
            type="date"
            className={control}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>
      <Field label="What they said" htmlFor={`${id}-quote`}>
        <textarea
          id={`${id}-quote`}
          rows={3}
          maxLength={QUOTE_MAX_LENGTH}
          value={quote}
          onChange={(e) => setQuote(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink focus-visible:border-accent"
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-medium text-on-accent hover:brightness-95"
        >
          Add to the log
        </button>
        <button
          type="button"
          onClick={onDone}
          className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-muted"
        >
          Cancel
        </button>
        <p role="alert" className="text-xs text-danger-ink">
          {error}
        </p>
      </div>
    </form>
  )
}

/** What organisations have told us, with how often each theme comes up. */
export function FeedbackLog({ feedback, onAdd, onRemove, organisations, asOf }: FeedbackLogProps) {
  const [theme, setTheme] = useState<ThemeId | null>(null)
  const [all, setAll] = useState(false)
  const [adding, setAdding] = useState(false)
  const counts = themeCounts(feedback)
  const matching = theme ? feedback.filter((f) => f.theme === theme) : feedback
  const shown = all ? matching : matching.slice(0, SHOWN)

  const chip = (selected: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
      selected
        ? 'border-accent bg-accent-soft font-medium text-ink'
        : 'border-line bg-surface text-ink-muted hover:text-ink'
    }`

  return (
    <section aria-labelledby="voc-log" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          id="voc-log"
          title="Feedback log"
          lead="What customers, responders, suppliers and partners have told us, in their own words, tagged by theme. Select a theme to see only its feedback."
        />
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            Log feedback
          </button>
        )}
      </div>

      {adding && (
        <FeedbackForm
          organisations={organisations}
          asOf={asOf}
          onAdd={onAdd}
          onDone={() => setAdding(false)}
        />
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by theme">
        <button
          type="button"
          aria-pressed={theme === null}
          onClick={() => setTheme(null)}
          className={chip(theme === null)}
        >
          All themes <span className="text-ink-subtle tabular-nums">{formatNumber(feedback.length)}</span>
        </button>
        {THEME_IDS.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={theme === t}
            onClick={() => setTheme(theme === t ? null : t)}
            className={chip(theme === t)}
          >
            {THEME_LABELS[t]}{' '}
            <span className="text-ink-subtle tabular-nums">
              {formatNumber(counts[t])}
              <span className="sr-only"> {counts[t] === 1 ? 'mention' : 'mentions'}</span>
            </span>
          </button>
        ))}
      </div>

      {matching.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-ink-muted">
          {feedback.length === 0
            ? 'The log is empty. Log some feedback, or reset to the defaults.'
            : 'No feedback on this theme yet.'}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((entry) => (
            <li key={entry.id}>
              <figure className="flex h-full flex-col rounded-xl border border-line bg-surface p-4">
                <blockquote className="flex-1 text-sm leading-relaxed text-pretty text-ink">
                  “{entry.quote}”
                </blockquote>
                <figcaption className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                  <span className="font-medium text-ink">{entry.organisation}</span>
                  <span>{SIDE_LABELS[entry.side].one}</span>
                  <span aria-hidden="true">·</span>
                  <span>{formatDate(entry.date)}</span>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[11px]">
                    {THEME_LABELS[entry.theme]}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(entry.id)}
                    className="ml-auto rounded-md p-1 text-ink-subtle hover:bg-surface-muted hover:text-ink"
                    aria-label={`Remove feedback from ${entry.organisation}, ${formatDate(entry.date)}`}
                  >
                    <CloseIcon width={14} height={14} />
                  </button>
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      )}

      {matching.length > SHOWN && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          aria-expanded={all}
          className="text-sm font-medium text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
        >
          {all ? 'Show the latest only' : `Show all ${mentions(matching.length)}`}
        </button>
      )}
    </section>
  )
}
