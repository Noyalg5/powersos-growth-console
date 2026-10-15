import { Tag } from '@/components/Tag'
import { formatDecimal, formatNumber } from '@/lib/format'
import {
  CRITERIA,
  formatScore,
  QUADRANTS,
  SCORE_MAX,
  SCORE_MIN,
  type CriterionId,
  type SectorEvidence,
  type SectorInfo,
  type SectorResult,
  type SectorScores,
} from '@/lib/sectorScoring'
import type { SectorId } from '@/types'

const NONE = '—'
const SCORE_OPTIONS = Array.from({ length: SCORE_MAX - SCORE_MIN + 1 }, (_, i) => SCORE_MIN + i)

/** Sectors best first, with the score behind each and where it sits on the 2×2. */
export function RankedTable({ results }: { results: readonly SectorResult[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[34rem] text-sm">
        <caption className="sr-only">Sectors ranked by weighted score, best first</caption>
        <thead>
          <tr className="border-b border-line text-left text-xs text-ink-subtle">
            <th scope="col" className="w-10 px-4 py-2.5 font-medium">
              #
            </th>
            <th scope="col" className="px-2 py-2.5 font-medium">
              Sector
            </th>
            <th scope="col" className="w-[30%] px-2 py-2.5 font-medium">
              Score of 5
            </th>
            <th scope="col" className="px-2 py-2.5 text-right font-medium">
              <abbr title="Market attractiveness" className="no-underline">
                Attract.
              </abbr>
            </th>
            <th scope="col" className="px-2 py-2.5 text-right font-medium">
              <abbr title="Ability to win" className="no-underline">
                Ability
              </abbr>
            </th>
            <th scope="col" className="px-4 py-2.5 font-medium">
              Quadrant
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {results.map((r) => (
            <tr key={r.sector} className={r.rank === 1 ? 'bg-accent-soft/60' : undefined}>
              <td className="px-4 py-2.5 text-ink-subtle tabular-nums">{r.rank}</td>
              <th scope="row" className="px-2 py-2.5 text-left font-medium text-ink">
                {r.label}
              </th>
              <td className="px-2 py-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted"
                    aria-hidden="true"
                  >
                    <div
                      className={`h-full rounded-full ${r.rank === 1 ? 'bg-accent' : 'bg-ink-muted'}`}
                      style={{
                        width: `${((r.score - SCORE_MIN) / (SCORE_MAX - SCORE_MIN)) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="w-7 text-right text-ink tabular-nums">
                    {formatScore(r.score)}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2.5 text-right text-ink-muted tabular-nums">
                {r.attractiveness === null ? NONE : formatScore(r.attractiveness)}
              </td>
              <td className="px-2 py-2.5 text-right text-ink-muted tabular-nums">
                {r.ability === null ? NONE : formatScore(r.ability)}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap text-ink-muted">
                {r.quadrant === null ? NONE : QUADRANTS[r.quadrant].label}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ScoreEditorProps {
  sectors: readonly SectorInfo[]
  scores: SectorScores
  defaults: SectorScores
  evidence: Readonly<Record<SectorId, SectorEvidence>>
  onChange: (sector: SectorId, criterion: CriterionId, score: number) => void
}

/** Every score, editable, beside what the synthetic network says about the sector. */
export function ScoreEditor({ sectors, scores, defaults, evidence, onChange }: ScoreEditorProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[66rem] text-sm">
        <caption className="sr-only">
          Scores from 1 to 5 for each sector and criterion, editable, with evidence from the
          synthetic network
        </caption>
        <thead>
          <tr className="text-left text-xs text-ink-subtle">
            <td className="sticky left-0 z-10 bg-surface px-4 pt-3" />
            <th scope="colgroup" colSpan={CRITERIA.length} className="px-2 pt-3 font-medium">
              <span className="flex flex-wrap items-center gap-2">
                Scores, 1–5 <Tag kind="assumption" />
              </span>
            </th>
            <th scope="colgroup" colSpan={3} className="border-l border-line px-3 pt-3 font-medium">
              <span className="flex flex-wrap items-center gap-2">
                Evidence from our network <Tag kind="synthetic" />
              </span>
            </th>
          </tr>
          <tr className="border-b border-line text-left align-bottom text-xs text-ink-subtle">
            <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-2.5 font-medium">
              Sector
            </th>
            {CRITERIA.map((c) => (
              <th key={c.id} scope="col" className="min-w-[6.5rem] px-2 py-2.5 font-medium">
                {c.label}
                {!c.higherIsBetter && <span className="block font-normal">5 counts against</span>}
              </th>
            ))}
            <th scope="col" className="border-l border-line px-3 py-2.5 text-right font-medium">
              Sites
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Average criticality
            </th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">
              Call-outs per site a year
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sectors.map((s) => {
            const ev = evidence[s.id]
            return (
              <tr key={s.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium text-ink"
                >
                  {s.label}
                </th>
                {CRITERIA.map((c) => {
                  const value = scores[s.id][c.id]
                  const original = defaults[s.id][c.id]
                  const edited = value !== original
                  return (
                    <td key={c.id} className="px-2 py-2">
                      <select
                        value={value}
                        onChange={(e) => onChange(s.id, c.id, Number(e.target.value))}
                        aria-label={`${s.label}: ${c.label}${edited ? `, edited from ${original}` : ''}`}
                        title={edited ? `Edited from the default of ${original}` : undefined}
                        className={`h-8 w-14 rounded-md border bg-surface px-1.5 text-sm tabular-nums focus-visible:border-accent ${
                          edited ? 'border-accent font-semibold text-ink' : 'border-line text-ink'
                        }`}
                      >
                        {SCORE_OPTIONS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                  )
                })}
                <td className="border-l border-line px-3 py-2 text-right text-ink-muted tabular-nums">
                  {formatNumber(ev.sites)}
                </td>
                <td className="px-3 py-2 text-right text-ink-muted tabular-nums">
                  {ev.averageCriticality === null ? NONE : formatDecimal(ev.averageCriticality)}
                </td>
                <td className="px-3 py-2 text-right text-ink-muted tabular-nums">
                  {ev.callOutsPerSiteYear === null ? NONE : formatDecimal(ev.callOutsPerSiteYear)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
