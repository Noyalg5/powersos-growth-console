import { ExportButton } from '@/components/ExportButton'
import { NumberField } from '@/components/NumberField'
import { SectionHeading } from '@/components/SectionHeading'
import { THEME_LABELS } from '@/data'
import { toCsv } from '@/lib/csv'
import { formatList, formatNumber, formatPercent } from '@/lib/format'
import { SIDE_LABELS } from '@/lib/onboarding'
import {
  backlogTable,
  CONFIDENCE_LEVELS,
  IMPACT_LEVELS,
  RICE_LIMITS,
  TEST_NOTE_MAX_LENGTH,
  UAT_STATUS_LABELS,
  UAT_STATUSES,
  withArticle,
  type RankedFeature,
} from '@/lib/rice'
import { SIDES } from '@/lib/scenario'
import type { FeatureProgress, FeatureRequest, RiceInputs, UatStatus } from '@/types'
import { control, Field } from './Field'

interface BacklogProps {
  /** In rank order. */
  ranked: readonly RankedFeature[]
  /** In backlog order, which stays put while the inputs are edited. */
  features: readonly FeatureRequest[]
  defaults: Readonly<Record<string, FeatureProgress>>
  onChange: (featureId: string, progress: FeatureProgress) => void
  asOf: number
}

const score = (value: number | null) => (value === null ? '–' : formatNumber(value, 1))
const featureCardId = (id: string) => `feature-${id}`

const UAT_STYLES: Record<UatStatus, string> = {
  'not-started': 'border-line text-ink-subtle',
  'in-test': 'border-accent/60 bg-accent-soft text-accent-ink',
  passed: 'border-ink-muted text-ink',
  failed: 'border-danger/50 bg-danger-soft text-danger-ink',
}
const UAT_MARKS: Record<UatStatus, string> = {
  'not-started': '○',
  'in-test': '◐',
  passed: '✓',
  failed: '✕',
}

/** A UAT status in words, with a mark so colour is never the only signal. */
function UatBadge({ status }: { status: UatStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ${UAT_STYLES[status]}`}
    >
      <span aria-hidden="true">{UAT_MARKS[status]}</span>
      {UAT_STATUS_LABELS[status]}
    </span>
  )
}

/** "2 mentions: 1 customer, 1 responder". */
function mentionSummary(row: RankedFeature): string {
  const n = row.mentions.length
  if (n === 0) return 'No feedback yet'
  const bySide = SIDES.map((side) => {
    const count = row.mentions.filter((m) => m.side === side).length
    return count === 0 ? null : `${formatNumber(count)} ${SIDE_LABELS[side][count === 1 ? 'one' : 'many'].toLowerCase()}`
  }).filter((part) => part !== null)
  return `${formatNumber(n)} ${n === 1 ? 'mention' : 'mentions'}: ${bySide.join(', ')}`
}

function RankedTable({ ranked }: { ranked: readonly RankedFeature[] }) {
  const show = (id: string) => {
    const card = document.getElementById(featureCardId(id))
    card?.scrollIntoView({ block: 'start' })
    card?.focus({ preventScroll: true })
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">
          Feature requests ranked by RICE score, highest first. Select one to edit it.
        </caption>
        <thead className="border-b border-line bg-surface-muted text-xs text-ink-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Rank
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Feature request
            </th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">
              Reach
            </th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">
              Impact
            </th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">
              Confidence
            </th>
            <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">
              Effort
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              RICE
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              UAT
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {ranked.map((row) => {
            const { rice } = row.progress
            return (
              <tr key={row.feature.id} className="align-top hover:bg-surface-muted">
                <td className="px-3 py-2 text-ink-muted tabular-nums">{row.rank ?? '–'}</td>
                <th scope="row" className="px-3 py-2 font-normal">
                  <button
                    type="button"
                    onClick={() => show(row.feature.id)}
                    className="rounded text-left font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink-muted"
                  >
                    {row.feature.title}
                  </button>
                  <span className="block text-xs text-ink-subtle">{mentionSummary(row)}</span>
                </th>
                <td className="hidden px-3 py-2 text-right text-ink-muted tabular-nums md:table-cell">
                  {formatNumber(rice.reach)}
                </td>
                <td className="hidden px-3 py-2 text-right text-ink-muted tabular-nums md:table-cell">
                  {formatNumber(rice.impact, 2)}
                </td>
                <td className="hidden px-3 py-2 text-right text-ink-muted tabular-nums md:table-cell">
                  {formatPercent(rice.confidence)}
                </td>
                <td className="hidden px-3 py-2 text-right text-ink-muted tabular-nums md:table-cell">
                  {formatNumber(rice.effort, 1)}
                </td>
                <td className="px-3 py-2 text-right font-semibold text-ink tabular-nums">
                  {score(row.score)}
                  {row.score === null && <span className="sr-only">: not scored, effort is 0</span>}
                </td>
                <td className="px-3 py-2">
                  <UatBadge status={row.progress.uat} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function FeatureCard({
  row,
  total,
  defaults,
  onChange,
}: {
  row: RankedFeature
  total: number
  defaults: FeatureProgress | undefined
  onChange: (progress: FeatureProgress) => void
}) {
  const { feature, progress } = row
  const { story } = feature
  const id = feature.id
  const setRice = (patch: Partial<RiceInputs>) =>
    onChange({ ...progress, rice: { ...progress.rice, ...patch } })

  return (
    <article
      id={featureCardId(id)}
      tabIndex={-1}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-20 rounded-xl border border-line bg-surface"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs text-ink-subtle">{story.id}</p>
          <h4 id={`${id}-title`} className="mt-0.5 font-semibold text-ink">
            {feature.title}
          </h4>
          <p className="mt-1 text-xs text-ink-muted">
            From {formatList(feature.themes.map((t) => THEME_LABELS[t]))} ·{' '}
            {mentionSummary(row)}
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <UatBadge status={progress.uat} />
          <div>
            <p className="text-xs text-ink-subtle">RICE</p>
            <p className="text-xl font-semibold tracking-tight text-ink tabular-nums">
              {score(row.score)}
            </p>
            <p className="text-xs text-ink-muted">
              {row.rank === null ? 'Not ranked' : `Rank ${formatNumber(row.rank)} of ${formatNumber(total)}`}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line p-4 sm:p-5 lg:grid-cols-4">
        <NumberField
          label="Reach"
          value={progress.rice.reach}
          onChange={(reach) => setRice({ reach })}
          min={RICE_LIMITS.reach.min}
          max={RICE_LIMITS.reach.max}
          note="Organisations a quarter"
          defaultValue={defaults?.rice.reach}
        />
        <Field label="Impact" htmlFor={`${id}-impact`}>
          <select
            id={`${id}-impact`}
            className={control}
            value={progress.rice.impact}
            onChange={(e) => setRice({ impact: Number(e.target.value) })}
          >
            {IMPACT_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label} ({formatNumber(l.value, 2)})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Confidence" htmlFor={`${id}-confidence`}>
          <select
            id={`${id}-confidence`}
            className={control}
            value={progress.rice.confidence}
            onChange={(e) => setRice({ confidence: Number(e.target.value) })}
          >
            {CONFIDENCE_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label} ({formatPercent(l.value)})
              </option>
            ))}
          </select>
        </Field>
        <NumberField
          label="Effort"
          value={progress.rice.effort}
          onChange={(effort) => setRice({ effort })}
          min={RICE_LIMITS.effort.min}
          max={RICE_LIMITS.effort.max}
          decimals={1}
          note={
            progress.rice.effort === 0 ? (
              <span className="text-accent-ink">Set above 0 to score it</span>
            ) : (
              'Person-months'
            )
          }
          defaultValue={defaults?.rice.effort}
        />
      </div>

      <details className="group border-t border-line">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink-muted hover:text-ink sm:px-5">
          User story, acceptance criteria and UAT
        </summary>
        <div className="space-y-5 px-4 pb-5 sm:px-5">
          <p className="max-w-3xl text-sm leading-relaxed text-ink">
            As <strong>{withArticle(story.asA)}</strong>, I want{' '}
            <strong>{story.iWant}</strong>, so that <strong>{story.soThat}</strong>.
          </p>
          <ol className="space-y-3">
            {story.criteria.map((c, i) => (
              <li key={c.given} className="rounded-lg border border-line p-3 text-sm">
                <p className="text-xs font-medium text-ink-subtle">AC{i + 1}</p>
                <dl className="mt-1 grid grid-cols-[4rem_1fr] gap-x-2 gap-y-0.5 leading-relaxed">
                  <dt className="font-semibold text-ink">Given</dt>
                  <dd className="text-ink-muted">{c.given}</dd>
                  <dt className="font-semibold text-ink">When</dt>
                  <dd className="text-ink-muted">{c.when}</dd>
                  <dt className="font-semibold text-ink">Then</dt>
                  <dd className="text-ink-muted">{c.then}</dd>
                </dl>
              </li>
            ))}
          </ol>
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Field label="UAT status" htmlFor={`${id}-uat`}>
              <select
                id={`${id}-uat`}
                className={control}
                value={progress.uat}
                onChange={(e) => onChange({ ...progress, uat: e.target.value as UatStatus })}
              >
                {UAT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {UAT_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Test note" htmlFor={`${id}-note`}>
              <textarea
                id={`${id}-note`}
                rows={2}
                maxLength={TEST_NOTE_MAX_LENGTH}
                value={progress.testNote}
                placeholder="Which criteria passed or failed, and what happens next"
                onChange={(e) => onChange({ ...progress, testNote: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-accent"
              />
            </Field>
          </div>
        </div>
      </details>
    </article>
  )
}

/** Feature requests ranked by RICE, each with its story, criteria and UAT result. */
export function Backlog({ ranked, features, defaults, onChange, asOf }: BacklogProps) {
  const rows = new Map(ranked.map((row) => [row.feature.id, row]))
  const scored = ranked.filter((r) => r.rank !== null).length
  return (
    <section aria-labelledby="voc-backlog" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionHeading
          id="voc-backlog"
          title="Themes → feature requests, ranked by RICE"
          lead="Each theme rolls up into a feature request, scored as reach × impact × confidence ÷ effort. Edit the inputs below and the ranking updates; a request with no effort estimate can't be scored, so it sits at the bottom."
        />
        <ExportButton
          title="Product backlog"
          asOf={asOf}
          rows={ranked.length}
          table={() => toCsv(backlogTable(ranked, (t) => THEME_LABELS[t]))}
        />
      </div>
      <RankedTable ranked={ranked} />
      <h3 className="pt-4 text-sm font-semibold text-ink">
        Backlog <span className="font-normal text-ink-subtle">in story order</span>
      </h3>
      <div className="space-y-4">
        {features.map((feature) => {
          const row = rows.get(feature.id)
          return (
            row && (
              <FeatureCard
                key={feature.id}
                row={row}
                total={scored}
                defaults={defaults[feature.id]}
                onChange={(progress) => onChange(feature.id, progress)}
              />
            )
          )
        })}
      </div>
    </section>
  )
}
