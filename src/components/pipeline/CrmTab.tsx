import { useEffect, useMemo, useRef, useState } from 'react'
import { ResetBar } from '@/components/ResetBar'
import { SectionHeading } from '@/components/SectionHeading'
import { Tag } from '@/components/Tag'
import type { Persisted } from '@/components/usePersistentState'
import { LEAD_SOURCE_LABELS, SECTORS } from '@/data'
import { formatDate, formatNumber } from '@/lib/format'
import {
  AMBER_AFTER_DAYS,
  filterBoard,
  LEAD_SOURCES,
  RED_AFTER_DAYS,
  stageInfo,
  type Board,
  type BoardFilters,
  type BoardMoves,
  type PipelineStage,
} from '@/lib/pipeline'
import type { LeadSource, SectorId } from '@/types'
import { control, Field } from './Field'
import { dealCardId, moveMenuId } from './dealIds'
import { KanbanBoard, type MoveMethod } from './KanbanBoard'
import { PipelineSummary } from './PipelineSummary'

interface CrmTabProps {
  board: Board
  state: Persisted<BoardMoves>
  partnerNames: ReadonlyMap<string, string>
  onMove: (leadId: string, stage: PipelineStage) => void
  asOf: number
}

const ALL: BoardFilters = { sector: 'all', source: 'all' }

const motion = (): ScrollBehavior =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

/** The early-adopter CRM: filters, the summary strip and the board. */
export function CrmTab({ board, state, partnerNames, onMove, asOf }: CrmTabProps) {
  const [filters, setFilters] = useState<BoardFilters>(ALL)
  const shown = useMemo(() => filterBoard(board, filters), [board, filters])
  const filtered = filters.sector !== 'all' || filters.source !== 'all'
  const [status, setStatus] = useState('')

  // A card moved with its menu lands in a new column: take focus to its menu there
  const refocus = useRef<string | null>(null)
  useEffect(() => {
    const leadId = refocus.current
    if (!leadId) return
    refocus.current = null
    const menu = document.getElementById(moveMenuId(leadId))
    menu?.focus({ preventScroll: true })
    menu?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [board])

  const move = (leadId: string, stage: PipelineStage, method: MoveMethod) => {
    onMove(leadId, stage)
    if (method === 'menu') {
      refocus.current = leadId
      const name = board.cards.find((c) => c.lead.id === leadId)?.lead.organisation ?? 'The deal'
      setStatus(`${name} moved to ${stageInfo(stage).label}.`)
    }
  }

  const showDeal = (leadId: string) => {
    const card = document.getElementById(dealCardId(leadId))
    card?.scrollIntoView({ behavior: motion(), block: 'nearest', inline: 'center' })
    card?.focus({ preventScroll: true })
  }

  return (
    <div className="space-y-8">
      <ResetBar edited={state.edited} saved={state.saved} onReset={state.reset} what="card moves">
        <Tag kind="synthetic" />
        <Tag kind="assumption" />
        <span>
          Stage probabilities are assumptions; values use the pricing sandbox defaults. Days are
          counted to {formatDate(asOf)}.
        </span>
      </ResetBar>

      <section aria-label="Filters" className="rounded-xl border border-line bg-surface p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,16rem))_1fr]">
          <Field label="Sector" htmlFor="crm-sector">
            <select
              id="crm-sector"
              className={control}
              value={filters.sector}
              onChange={(e) => setFilters({ ...filters, sector: e.target.value as SectorId | 'all' })}
            >
              <option value="all">All sectors</option>
              {SECTORS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source" htmlFor="crm-source">
            <select
              id="crm-source"
              className={control}
              value={filters.source}
              onChange={(e) =>
                setFilters({ ...filters, source: e.target.value as LeadSource | 'all' })
              }
            >
              <option value="all">All sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {LEAD_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex flex-wrap items-end justify-between gap-3 sm:col-span-2 lg:col-span-1 lg:justify-end">
            <p className="text-xs text-ink-muted" aria-live="polite">
              Showing {formatNumber(shown.cards.length)} of {formatNumber(board.cards.length)} open
              deals
            </p>
            {filtered && (
              <button
                type="button"
                onClick={() => setFilters(ALL)}
                className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-muted"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      <PipelineSummary board={shown} onShowDeal={showDeal} />

      <section aria-labelledby="crm-board" className="space-y-4">
        <SectionHeading
          id="crm-board"
          title="Deals by stage"
          lead={`Drag a card to another stage, or use its Move to… menu. Days in stage turn amber after ${AMBER_AFTER_DAYS} and red after ${RED_AFTER_DAYS}; a move starts the count again. Scroll sideways to see every stage.`}
        />
        <KanbanBoard cards={shown.cards} partnerNames={partnerNames} onMove={move} />
      </section>

      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  )
}
