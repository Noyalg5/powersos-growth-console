import { useMemo, useState, type ReactNode } from 'react'
import { ExportButton } from '@/components/ExportButton'
import { CheckIcon, InfoIcon } from '@/components/icons'
import { StatTile } from '@/components/StatTile'
import { demoTarget } from '@/demo'
import {
  DATASET_LABELS,
  DATASETS,
  DIMENSION_INFO,
  DIMENSIONS,
  filterIssues,
  issuesTable,
  NO_ISSUE_FILTERS,
  SEVERITIES,
  SEVERITY_LABELS,
  type AnswerKeyResult,
  type IssueFilters,
  type PlantedIssue,
  type QualityReport,
  type ScoreSummary,
  type Severity,
} from '@/lib/dataQuality'
import { formatNumber, formatPercent } from '@/lib/format'

/** A planted problem, as the answer key describes it. */
export interface PlantedProblem extends PlantedIssue {
  label: string
  description: string
}

interface DataQualityPanelProps {
  report: QualityReport
  answerKey: AnswerKeyResult<PlantedProblem>
  asOf: number
}

const score = (s: ScoreSummary) => (s.score === null ? '—' : formatPercent(s.score, 1))
const plural = (n: number, one: string, many = `${one}s`) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`

const SEVERITY_BADGE: Record<Severity, string> = {
  high: 'border-danger bg-danger-soft text-danger-ink',
  medium: 'border-accent bg-accent-soft text-accent-ink',
  low: 'border-line text-ink-muted',
}

const control =
  'h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus-visible:border-accent'

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-ink-subtle">
        {label}
      </label>
      {children}
    </div>
  )
}

function AnswerKey({ result }: { result: AnswerKeyResult<PlantedProblem> }) {
  const total = result.found.length + result.missed.length
  const clean = result.missed.length === 0 && result.unexpected.length === 0
  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 ${clean ? 'border-line bg-surface-muted' : 'border-accent bg-accent-soft'}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-7 shrink-0 items-center justify-center rounded-full ${clean ? 'bg-ink-muted text-surface' : 'bg-accent text-on-accent'}`}
          aria-hidden="true"
        >
          {clean ? (
            <CheckIcon width={16} height={16} strokeWidth={2.5} />
          ) : (
            <InfoIcon width={16} height={16} />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">
            Answer key: {formatNumber(result.found.length)} of {plural(total, 'planted problem')}{' '}
            found, {plural(result.unexpected.length, 'false alarm')}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            The synthetic data carries problems planted on purpose, to test these rules the way UAT
            would.{' '}
            {clean
              ? 'Every one is caught and nothing else is flagged, and the unit tests prove the same on every build.'
              : 'Something has drifted: see what was missed or flagged unexpectedly below.'}
          </p>
          <details className="group mt-2 text-sm">
            <summary className="cursor-pointer font-medium text-ink-muted hover:text-ink">
              What was planted
            </summary>
            <ul className="mt-2 space-y-1.5">
              {[...result.found, ...result.missed].map((p) => (
                <li key={`${p.kind}-${p.recordId}`} className="text-ink-muted">
                  <span className="font-medium text-ink">{p.label}</span>{' '}
                  <span className="font-mono text-xs">{p.recordId}</span>
                  {result.missed.includes(p) && (
                    <span className="ml-1.5 text-xs font-medium text-danger-ink">Missed</span>
                  )}
                  : {p.description}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  )
}

function ScoreCell({
  summary,
  label,
  onPick,
}: {
  summary: ScoreSummary
  label: string
  onPick: () => void
}) {
  if (summary.rules === 0) {
    return (
      <td className="px-2 py-2 text-center text-ink-subtle">
        <span aria-label="No rules">—</span>
      </td>
    )
  }
  if (summary.failed === 0) {
    return <td className="px-2 py-2 text-center text-ink-subtle tabular-nums">{score(summary)}</td>
  }
  return (
    <td className="p-1 text-center">
      <button
        type="button"
        onClick={onPick}
        aria-label={`${label}: ${score(summary)}. Show ${plural(summary.failed, 'issue')}`}
        className="w-full rounded-md bg-accent-soft px-1.5 py-1 font-medium text-ink tabular-nums ring-accent transition-shadow hover:ring-2"
      >
        {score(summary)}
        <span className="block text-[11px] font-normal text-accent-ink">
          {plural(summary.failed, 'issue')}
        </span>
      </button>
    </td>
  )
}

function ScoreMatrix({
  report,
  onPick,
}: {
  report: QualityReport
  onPick: (filters: Partial<IssueFilters>) => void
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <caption className="sr-only">
            Quality score for each dataset in each dimension. Select a score with issues to list
            them.
          </caption>
          <thead>
            <tr className="border-b border-line text-xs text-ink-subtle">
              <th scope="col" className="px-4 py-2.5 text-left font-medium">
                Dataset
              </th>
              <th scope="col" className="px-2 py-2.5 text-right font-medium">
                Records
              </th>
              {DIMENSIONS.map((d) => (
                <th key={d} scope="col" className="px-2 py-2.5 text-center font-medium">
                  {DIMENSION_INFO[d].label}
                </th>
              ))}
              <th scope="col" className="px-2 py-2.5 text-center font-medium text-ink">
                All
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {DATASETS.map((ds) => (
              <tr key={ds}>
                <th scope="row" className="px-4 py-2 text-left font-medium text-ink">
                  {DATASET_LABELS[ds]}
                </th>
                <td className="px-2 py-2 text-right text-ink-muted tabular-nums">
                  {formatNumber(report.byDataset[ds].records)}
                </td>
                {DIMENSIONS.map((d) => (
                  <ScoreCell
                    key={d}
                    summary={report.matrix[ds][d]}
                    label={`${DATASET_LABELS[ds]}, ${DIMENSION_INFO[d].label.toLowerCase()}`}
                    onPick={() => onPick({ dataset: ds, dimension: d })}
                  />
                ))}
                <ScoreCell
                  summary={report.byDataset[ds]}
                  label={`${DATASET_LABELS[ds]}, all dimensions`}
                  onPick={() => onPick({ dataset: ds })}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Rule-based checks over every dataset: scores, the issues found and how to fix each one. */
export function DataQualityPanel({ report, answerKey, asOf }: DataQualityPanelProps) {
  const [filters, setFilters] = useState<IssueFilters>(NO_ISSUE_FILTERS)
  const shown = useMemo(() => filterIssues(report.issues, filters), [report, filters])
  const filtered =
    filters.severity !== null || filters.dimension !== null || filters.dataset !== null
  const passing = report.results.filter((r) => r.issues.length === 0).length

  return (
    <div className="space-y-6">
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
        {...demoTarget('data-quality')}
      >
        <StatTile
          label="Overall"
          tip="Checks passed as a share of checks run. One check is one rule applied to one record. Scores round down, so anything short of perfect never shows as 100%."
          value={score(report.overall)}
          caption={`${plural(report.overall.failed, 'issue')} in ${formatNumber(report.overall.checks)} checks`}
        />
        {DIMENSIONS.map((d) => (
          <StatTile
            key={d}
            label={DIMENSION_INFO[d].label}
            tip={`${DIMENSION_INFO[d].question} ${plural(report.byDimension[d].rules, 'rule')} check this.`}
            value={score(report.byDimension[d])}
            caption={`${plural(report.byDimension[d].failed, 'issue')} in ${formatNumber(report.byDimension[d].checks)} checks`}
          />
        ))}
      </div>

      <AnswerKey result={answerKey} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">Score by dataset and dimension</h3>
        <ScoreMatrix report={report} onPick={(f) => setFilters({ ...NO_ISSUE_FILTERS, ...f })} />
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-sm font-semibold text-ink" aria-live="polite">
            {filtered
              ? `${plural(shown.length, 'issue')} of ${formatNumber(report.issues.length)}`
              : plural(report.issues.length, 'issue')}
            , most serious first
          </h3>
        </div>

        <div className="mb-3 grid grid-cols-2 gap-3 rounded-xl border border-line bg-surface p-4 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto_auto] sm:items-end">
          <Field label="Severity" htmlFor="dq-severity">
            <select
              id="dq-severity"
              className={control}
              value={filters.severity ?? ''}
              onChange={(e) =>
                setFilters({ ...filters, severity: (e.target.value || null) as Severity | null })
              }
            >
              <option value="">All severities</option>
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dimension" htmlFor="dq-dimension">
            <select
              id="dq-dimension"
              className={control}
              value={filters.dimension ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dimension: (e.target.value || null) as IssueFilters['dimension'],
                })
              }
            >
              <option value="">All dimensions</option>
              {DIMENSIONS.map((d) => (
                <option key={d} value={d}>
                  {DIMENSION_INFO[d].label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Dataset" htmlFor="dq-dataset">
            <select
              id="dq-dataset"
              className={control}
              value={filters.dataset ?? ''}
              onChange={(e) =>
                setFilters({
                  ...filters,
                  dataset: (e.target.value || null) as IssueFilters['dataset'],
                })
              }
            >
              <option value="">All datasets</option>
              {DATASETS.map((ds) => (
                <option key={ds} value={ds}>
                  {DATASET_LABELS[ds]}
                </option>
              ))}
            </select>
          </Field>
          <button
            type="button"
            onClick={filtered ? () => setFilters(NO_ISSUE_FILTERS) : undefined}
            aria-disabled={!filtered || undefined}
            className="h-9 rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
          >
            Clear filters
          </button>
          <ExportButton
            title="Data-quality issues"
            asOf={asOf}
            rows={shown.length}
            table={() => issuesTable(shown)}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-sm">
              <caption className="sr-only">Data-quality issues, most serious first</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-subtle">
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Severity
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Record
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Rule broken
                  </th>
                  <th scope="col" className="px-4 py-2.5 font-medium">
                    Suggested fix
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shown.map((issue) => (
                  <tr key={`${issue.ruleId}-${issue.recordId}`} className="align-top">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${SEVERITY_BADGE[issue.severity]}`}
                      >
                        {SEVERITY_LABELS[issue.severity]}
                      </span>
                    </td>
                    <th scope="row" className="w-56 px-3 py-3 text-left font-normal">
                      <span className="block text-xs text-ink-subtle">
                        <span className="font-mono text-ink">{issue.recordId}</span> ·{' '}
                        {DATASET_LABELS[issue.dataset]}
                      </span>
                      <span className="mt-0.5 block text-ink">{issue.record}</span>
                    </th>
                    <td className="min-w-72 px-3 py-3">
                      <span className="block font-medium text-ink">{issue.rule}</span>
                      <span className="mt-0.5 block text-ink-muted">{issue.problem}</span>
                      <span className="mt-1 block text-xs text-ink-subtle">
                        {DIMENSION_INFO[issue.dimension].label}
                      </span>
                    </td>
                    <td className="min-w-64 px-4 py-3 text-ink-muted">{issue.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length === 0 && (
            <p className="border-t border-line px-4 py-5 text-sm text-ink-muted">
              {report.issues.length === 0
                ? 'Every check passes.'
                : 'No issues match these filters.'}
            </p>
          )}
        </div>
      </div>

      <details className="group overflow-hidden rounded-xl border border-line bg-surface">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-ink hover:bg-surface-muted">
          All {formatNumber(report.results.length)} rules: {formatNumber(passing)} pass,{' '}
          {formatNumber(report.results.length - passing)} raise issues
        </summary>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full min-w-[48rem] text-sm">
            <caption className="sr-only">Every data-quality rule and its result</caption>
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-subtle">
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Rule
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Dataset
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Dimension
                </th>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Severity
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Checked
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {report.results.map(({ rule, checked, issues }) => (
                <tr key={rule.id}>
                  <th scope="row" className="px-4 py-2 text-left font-normal text-ink">
                    {rule.title}
                  </th>
                  <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                    {DATASET_LABELS[rule.dataset]}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                    {DIMENSION_INFO[rule.dimension].label}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-ink-muted">
                    {SEVERITY_LABELS[rule.severity]}
                  </td>
                  <td className="px-3 py-2 text-right text-ink-muted tabular-nums">
                    {formatNumber(checked)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {issues.length === 0 ? (
                      <span className="text-ink-subtle">Pass</span>
                    ) : (
                      <span className="font-medium text-accent-ink">
                        {plural(issues.length, 'issue')}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
