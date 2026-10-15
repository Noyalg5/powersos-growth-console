import { formatDuration, formatNumber } from '@/lib/format'
import {
  explainMatch,
  FACTOR_LABELS,
  FACTOR_WEIGHTS,
  FACTORS,
  MAX_OFFER_ETA_MINUTES,
  type Candidate,
  type FactorScore,
  type MatchResult,
} from '@/lib/matching'

interface MatchRankingProps {
  match: MatchResult
  /** The ranking is hidden until the match step. */
  revealed: boolean
  onReveal: () => void
}

const GRID =
  'grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-3 gap-y-3 md:grid-cols-[1.5rem_minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_3.5rem] md:gap-x-4'

const HOW_IT_WORKS: Record<(typeof FACTORS)[number], string> = {
  eta: `Full marks at 0 min, falling to nil at ${formatDuration(MAX_OFFER_ETA_MINUTES)}. Mobilisation plus drive time, adjusted for the hour.`,
  rating: 'Nil at 3.0, full marks at 5.0, from customer ratings.',
  availability:
    'Cover at the hour of the request (overnight and weekends included). Without it, excluded.',
  compliance: 'Valid HV authorisation and insurance. Lapsed or missing, excluded.',
}

export function MatchRanking({ match, revealed, onReveal }: MatchRankingProps) {
  const considered = match.ranked.length + match.excluded.length
  const winner = match.chosen

  return (
    <section aria-labelledby="matching-heading" className="mt-14">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="matching-heading" className="text-sm font-semibold text-ink">
          Responder matching
        </h2>
        <p className="text-xs text-ink-subtle">
          The {considered} nearest of {considered + match.notConsidered} responders, checked at the
          time of the request{match.overnight ? ' (overnight)' : match.weekend ? ' (weekend)' : ''}
        </p>
      </div>

      {!revealed ? (
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-muted">
            The request has gone out. Responders are ranked at the Match step.
          </p>
          <button
            type="button"
            onClick={onReveal}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted"
          >
            Go to Match
          </button>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="overflow-hidden rounded-xl border border-line bg-surface">
            <div
              className={`${GRID} hidden border-b border-line px-4 py-2.5 text-xs font-medium text-ink-subtle md:grid`}
              aria-hidden="true"
            >
              <span>#</span>
              <span>Responder</span>
              {FACTORS.map((factor) => (
                <span key={factor}>
                  {FACTOR_LABELS[factor]}{' '}
                  <span className="font-normal tabular-nums">({FACTOR_WEIGHTS[factor]})</span>
                </span>
              ))}
              <span className="text-right">Score</span>
            </div>

            <ol aria-label="Ranked responders" className="divide-y divide-line">
              {match.ranked.map((candidate, index) => (
                <RankedRow
                  key={candidate.responder.id}
                  candidate={candidate}
                  rank={index + 1}
                  chosen={candidate === winner}
                />
              ))}
            </ol>

            {match.excluded.length > 0 && (
              <>
                <p className="border-t border-line bg-surface-muted px-4 py-2 text-xs font-medium text-ink-subtle">
                  Excluded ({match.excluded.length})
                </p>
                <ul aria-label="Excluded responders" className="divide-y divide-line">
                  {match.excluded.map((candidate) => (
                    <ExcludedRow key={candidate.responder.id} candidate={candidate} />
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink">
                {winner ? `Why ${winner.responder.name}` : 'No match'}
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-muted">
                {explainMatch(match).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-line bg-surface p-5">
              <h3 className="text-sm font-semibold text-ink">How the score works</h3>
              <dl className="mt-3 space-y-2.5 text-xs leading-relaxed">
                {FACTORS.map((factor) => (
                  <div key={factor}>
                    <dt className="font-medium text-ink">
                      {FACTOR_LABELS[factor]} · {FACTOR_WEIGHTS[factor]} points
                    </dt>
                    <dd className="text-ink-muted">{HOW_IT_WORKS[factor]}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function RankedRow({
  candidate,
  rank,
  chosen,
}: {
  candidate: Candidate
  rank: number
  chosen: boolean
}) {
  const { responder } = candidate
  return (
    <li
      className={`${GRID} items-center px-4 py-3 ${chosen ? 'border-l-[3px] border-accent bg-accent-soft' : ''}`}
    >
      <span className="text-sm font-semibold text-ink tabular-nums">{rank}</span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-ink">
          {responder.name}
          {chosen && <span className="sr-only"> (matched)</span>}
        </p>
        <p className="text-xs text-ink-subtle">
          {responder.town} · {formatNumber(candidate.miles, 1)} miles
          {chosen && <span className="ml-2 font-medium text-accent-ink">Matched</span>}
        </p>
      </div>
      <span className="text-right text-base font-semibold text-ink tabular-nums md:order-last">
        {formatNumber(candidate.score, 1)}
      </span>
      <div className="col-span-3 grid grid-cols-2 gap-3 md:contents">
        {candidate.factors.map((f) => (
          <FactorCell key={f.factor} score={f} />
        ))}
      </div>
    </li>
  )
}

function FactorCell({ score }: { score: FactorScore }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-ink-subtle md:hidden">{FACTOR_LABELS[score.factor]}</p>
      <p className={`text-xs ${score.attention ? 'text-accent-ink' : 'text-ink-muted'}`}>
        {score.detail}
      </p>
      <div className="mt-1 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-ink-muted"
            style={{ width: `${(score.points / score.max) * 100}%` }}
          />
        </div>
        <span className="w-8 text-right text-xs text-ink tabular-nums">
          {formatNumber(score.points, 1)}
        </span>
      </div>
    </div>
  )
}

function ExcludedRow({ candidate }: { candidate: Candidate }) {
  const { responder } = candidate
  return (
    <li className={`${GRID} items-center px-4 py-3 text-ink-subtle`}>
      <span className="text-sm" aria-hidden="true">
        –
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{responder.name}</p>
        <p className="text-xs">
          {responder.town} · ETA {formatDuration(candidate.etaMinutes)}
        </p>
      </div>
      <span className="text-right text-xs md:order-last">Excluded</span>
      <ul className="col-span-3 flex flex-wrap gap-1.5 md:col-span-4">
        {candidate.exclusions.map((exclusion) => (
          <li
            key={exclusion.code}
            className="rounded-md border border-dashed border-line px-2 py-0.5 text-xs"
          >
            {exclusion.label}
          </li>
        ))}
      </ul>
    </li>
  )
}
