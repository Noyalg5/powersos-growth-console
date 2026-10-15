import { useState, type ReactNode } from 'react'
import { InfoTip } from '@/components/InfoTip'
import { LEAD_SOURCE_LABELS } from '@/data'
import { formatGBP, formatNumber, formatPercent } from '@/lib/format'
import {
  conversionBySource,
  RED_AFTER_DAYS,
  stageInfo,
  stageTotals,
  stuckDeals,
  unweightedPipelineValue,
  weightedPipelineValue,
  type Board,
} from '@/lib/pipeline'

interface PipelineSummaryProps {
  board: Board
  /** Scrolls the board to a deal's card. */
  onShowDeal: (leadId: string) => void
}

const pounds = (n: number) => formatGBP(n, { pence: false })
const deals = (n: number) => `${formatNumber(n)} ${n === 1 ? 'deal' : 'deals'}`
const STUCK_SHOWN = 5

function Card({
  title,
  tip,
  children,
}: {
  title: string
  tip: string
  children: ReactNode
}) {
  return (
    <div className="relative rounded-xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs leading-snug text-ink-subtle">{title}</h3>
        <InfoTip topic={title.toLowerCase()}>{tip}</InfoTip>
      </div>
      {children}
    </div>
  )
}

function Conversion({ board }: { board: Board }) {
  const rows = conversionBySource(board)
  const won = rows.reduce((sum, r) => sum + r.won, 0)
  return (
    <Card
      title="Lead → proposal conversion by source"
      tip="A lead has converted once it reaches Proposal or later. Lost leads count as not converted, because the data doesn't say how far they got."
    >
      <table className="mt-3 w-full text-xs">
        <caption className="sr-only">Leads from each source that reached Proposal or later</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Source</th>
            <th scope="col">Converted</th>
            <th scope="col">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.source}>
              <th scope="row" className="py-1 pr-2 text-left font-normal whitespace-nowrap text-ink-muted">
                {LEAD_SOURCE_LABELS[row.source]}
              </th>
              <td className="w-full py-1 pr-2">
                <div className="h-2 rounded-full bg-surface-muted" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-ink-muted"
                    style={{ width: `${(row.rate ?? 0) * 100}%` }}
                  />
                </div>
              </td>
              <td className="py-1 text-right whitespace-nowrap text-ink tabular-nums">
                {row.rate === null ? (
                  <span className="text-ink-subtle">No leads</span>
                ) : (
                  <>
                    {formatPercent(row.rate)}
                    <span className="text-ink-subtle">
                      {' '}
                      ({formatNumber(row.converted)} of {formatNumber(row.leads)})
                    </span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        {formatNumber(board.lost.length)} lost {board.lost.length === 1 ? 'lead is' : 'leads are'}{' '}
        off the board but counted here. Won so far: {formatNumber(won)} (Onboarding or Live).
      </p>
    </Card>
  )
}

function Stuck({ board, onShowDeal }: PipelineSummaryProps) {
  const [all, setAll] = useState(false)
  const stuck = stuckDeals(board.cards)
  const shown = all ? stuck : stuck.slice(0, STUCK_SHOWN)
  return (
    <Card
      title="Stuck deals"
      tip={`Deals more than ${RED_AFTER_DAYS} days in their stage, with the most weighted value at risk first. Live deals never count as stuck.`}
    >
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{formatNumber(stuck.length)}</p>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        {stuck.length === 0
          ? `No deal has been in its stage for over ${RED_AFTER_DAYS} days.`
          : `over ${RED_AFTER_DAYS} days in their stage. Select one to find it on the board.`}
      </p>
      {stuck.length > 0 && (
        <ol className="mt-3 space-y-2 border-t border-line pt-3">
          {shown.map((card) => (
            <li key={card.lead.id} className="text-xs">
              <button
                type="button"
                onClick={() => onShowDeal(card.lead.id)}
                className="rounded text-left font-medium text-ink underline decoration-line underline-offset-2 hover:decoration-ink-muted"
              >
                {card.lead.organisation}
              </button>
              <span className="block text-ink-muted">
                {stageInfo(card.stage).label} · {formatNumber(card.daysInStage)} days ·{' '}
                {pounds(card.weightedValue)} weighted
              </span>
            </li>
          ))}
        </ol>
      )}
      {stuck.length > STUCK_SHOWN && (
        <button
          type="button"
          onClick={() => setAll(!all)}
          aria-expanded={all}
          className="mt-3 text-xs font-medium text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
        >
          {all ? 'Show fewer' : `Show all ${formatNumber(stuck.length)}`}
        </button>
      )}
    </Card>
  )
}

/** The pipeline at a glance: what it's worth, where deals come from, and which have stalled. */
export function PipelineSummary({ board, onShowDeal }: PipelineSummaryProps) {
  const weighted = weightedPipelineValue(board.cards)
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card
        title="Weighted pipeline value"
        tip="Each deal is valued at what the lead would pay a year on its recommended tier, at the pricing sandbox defaults, then multiplied by the share of deals at its stage that go live. The shares are assumptions."
      >
        <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
          {pounds(weighted)}
          <span className="text-sm font-normal text-ink-muted"> a year</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          From {deals(board.cards.length)} worth {pounds(unweightedPipelineValue(board.cards))} a
          year if every one went live.
        </p>
        <table className="mt-3 w-full border-t border-line text-xs">
          <caption className="sr-only">Weighted value by stage</caption>
          <thead>
            <tr className="text-ink-subtle">
              <th scope="col" className="pt-2 pb-1 text-left font-normal">
                Stage
              </th>
              <th scope="col" className="pt-2 pb-1 text-right font-normal">
                Likely
              </th>
              <th scope="col" className="pt-2 pb-1 text-right font-normal">
                Weighted
              </th>
            </tr>
          </thead>
          <tbody className="text-ink-muted tabular-nums">
            {stageTotals(board.cards).map((t) => (
              <tr key={t.stage.id}>
                <th scope="row" className="py-0.5 text-left font-normal">
                  {t.stage.label}{' '}
                  <span className="text-ink-subtle">({formatNumber(t.cards)})</span>
                </th>
                <td className="py-0.5 text-right">{formatPercent(t.stage.probability)}</td>
                <td className="py-0.5 text-right text-ink">{pounds(t.weightedValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Conversion board={board} />
      <Stuck board={board} onShowDeal={onShowDeal} />
    </div>
  )
}
