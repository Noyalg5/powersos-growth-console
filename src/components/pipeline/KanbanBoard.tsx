import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { useState, type SyntheticEvent } from 'react'
import { Tag } from '@/components/Tag'
import { LEAD_SOURCE_LABELS, sectorLabel } from '@/data'
import { formatGBP, formatNumber, formatPercent } from '@/lib/format'
import {
  isPipelineStage,
  nextAction,
  PIPELINE_STAGES,
  stageInfo,
  weightedPipelineValue,
  type PipelineCard,
  type PipelineStage,
  type StageAge,
} from '@/lib/pipeline'
import { dealCardId, moveMenuId } from './dealIds'

export type MoveMethod = 'drag' | 'menu'

interface KanbanBoardProps {
  cards: readonly PipelineCard[]
  partnerNames: ReadonlyMap<string, string>
  onMove: (leadId: string, stage: PipelineStage, method: MoveMethod) => void
}

const pounds = (n: number) => formatGBP(n, { pence: false })
const days = (n: number) => `${formatNumber(n)} ${n === 1 ? 'day' : 'days'}`
const sites = (n: number) => `${formatNumber(n)} ${n === 1 ? 'site' : 'sites'}`

const AGE_STYLES: Record<StageAge, { label: string | null; className: string }> = {
  ok: { label: null, className: 'text-ink-subtle' },
  slowing: {
    label: 'slowing',
    className: 'rounded-full border border-accent/60 bg-accent-soft px-1.5 font-medium text-accent-ink',
  },
  stuck: {
    label: 'stuck',
    className: 'rounded-full border border-danger/50 bg-danger-soft px-1.5 font-medium text-danger-ink',
  },
}

/** Days in the stage, amber after 14 and red after 30, and always said in words too. */
function AgeBadge({ card }: { card: PipelineCard }) {
  const style = AGE_STYLES[card.age]
  return (
    <span className={`inline-flex py-0.5 text-[11px] leading-4 whitespace-nowrap ${style.className}`}>
      {days(card.daysInStage)} in stage{style.label && ` · ${style.label}`}
    </span>
  )
}

function CardBody({ card, partnerName }: { card: PipelineCard; partnerName?: string }) {
  const { lead } = card
  return (
    <>
      <p className="text-sm leading-snug font-medium text-ink">{lead.organisation}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {sectorLabel(lead.sector)} · {sites(lead.estimatedSites)}
      </p>
      <p className="text-xs text-ink-subtle">
        {LEAD_SOURCE_LABELS[lead.source]}
        {partnerName && `: ${partnerName}`}
      </p>
      <p className="mt-2 text-xs leading-snug text-ink">
        <span className="text-ink-subtle">Next: </span>
        {nextAction(card.stage, lead, partnerName)}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <AgeBadge card={card} />
        <span className="text-xs text-ink-muted tabular-nums">
          {pounds(card.annualValue)}
          <span className="text-ink-subtle"> a year</span>
        </span>
      </div>
    </>
  )
}

/** Keeps a press on the menu from starting a drag. */
const stopDrag = (event: SyntheticEvent) => event.stopPropagation()

function MoveMenu({
  card,
  onMove,
}: {
  card: PipelineCard
  onMove: KanbanBoardProps['onMove']
}) {
  const id = moveMenuId(card.lead.id)
  return (
    <div className="mt-2.5" onMouseDown={stopDrag} onTouchStart={stopDrag}>
      <label htmlFor={id} className="sr-only">
        Move {card.lead.organisation} from {stageInfo(card.stage).label} to another stage
      </label>
      <select
        id={id}
        value=""
        onChange={(e) => {
          if (isPipelineStage(e.target.value)) onMove(card.lead.id, e.target.value, 'menu')
        }}
        className="h-8 w-full cursor-pointer rounded-md border border-line bg-surface px-2 text-xs text-ink-muted hover:text-ink focus-visible:border-accent"
      >
        <option value="" disabled>
          Move to…
        </option>
        {PIPELINE_STAGES.map((s) => (
          <option key={s.id} value={s.id} disabled={s.id === card.stage}>
            {s.label}
            {s.id === card.stage ? ' (here now)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

function DealCard({
  card,
  partnerName,
  onMove,
}: {
  card: PipelineCard
  partnerName?: string
  onMove: KanbanBoardProps['onMove']
}) {
  const { listeners, setNodeRef, isDragging } = useDraggable({ id: card.lead.id })
  return (
    <li
      ref={setNodeRef}
      {...listeners}
      id={dealCardId(card.lead.id)}
      tabIndex={-1}
      aria-label={`${card.lead.organisation}, ${days(card.daysInStage)} in ${stageInfo(card.stage).label}`}
      className={`cursor-grab touch-manipulation rounded-lg border border-line bg-surface p-3 shadow-xs select-none [-webkit-touch-callout:none] active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      {card.moved && (
        <div className="mb-1.5">
          <Tag kind="edited">Moved</Tag>
        </div>
      )}
      <CardBody card={card} partnerName={partnerName} />
      <MoveMenu card={card} onMove={onMove} />
    </li>
  )
}

function Column({
  stage,
  cards,
  partnerNames,
  onMove,
}: {
  stage: PipelineStage
  cards: readonly PipelineCard[]
  partnerNames: ReadonlyMap<string, string>
  onMove: KanbanBoardProps['onMove']
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const info = stageInfo(stage)
  const headingId = `stage-${stage}`
  return (
    <li
      ref={setNodeRef}
      aria-labelledby={headingId}
      className={`flex w-60 shrink-0 flex-col rounded-xl border bg-surface-muted/60 transition-colors ${
        isOver ? 'border-accent bg-accent-soft' : 'border-line'
      }`}
    >
      <div className="border-b border-line px-3 pt-3 pb-2">
        <h3 id={headingId} className="flex items-baseline justify-between gap-2 text-sm font-semibold text-ink">
          {info.label}
          <span className="text-xs font-normal text-ink-subtle tabular-nums">
            {formatNumber(cards.length)}
            <span className="sr-only"> {cards.length === 1 ? 'deal' : 'deals'}</span>
          </span>
        </h3>
        <p className="mt-0.5 text-[11px] text-ink-subtle">
          {formatPercent(info.probability)} likely · {pounds(weightedPipelineValue(cards))} weighted
        </p>
      </div>
      <ul className="flex max-h-[38rem] min-h-28 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {cards.map((card) => (
          <DealCard
            key={card.lead.id}
            card={card}
            partnerName={card.lead.partnerId ? partnerNames.get(card.lead.partnerId) : undefined}
            onMove={onMove}
          />
        ))}
        {cards.length === 0 && (
          <li className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs leading-relaxed text-ink-subtle">
            No deals here. Drag a card in, or use its Move to… menu.
          </li>
        )}
      </ul>
    </li>
  )
}

/**
 * The deals as a board of stages. Cards drag between columns with a mouse, or with a
 * long press on a touch screen; every card also has a Move to… menu, which works with a
 * keyboard and on any phone.
 */
export function KanbanBoard({ cards, partnerNames, onMove }: KanbanBoardProps) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A long press, so a swipe still scrolls the board
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  )
  const [activeId, setActiveId] = useState<string | null>(null)
  const active = activeId ? cards.find((c) => c.lead.id === activeId) : undefined

  const name = (id: UniqueIdentifier) =>
    cards.find((c) => c.lead.id === id)?.lead.organisation ?? 'The deal'
  const stageName = (id: UniqueIdentifier | undefined) =>
    id !== undefined && isPipelineStage(id) ? stageInfo(id).label : null
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${name(active.id)}.`,
    onDragOver: ({ over }) => (stageName(over?.id) ? `Over ${stageName(over?.id)}.` : 'Not over a stage.'),
    onDragEnd: ({ active, over }) =>
      stageName(over?.id)
        ? `${name(active.id)} dropped in ${stageName(over?.id)}.`
        : `${name(active.id)} put back.`,
    onDragCancel: ({ active }) => `${name(active.id)} put back.`,
  }

  const onDragStart = ({ active }: DragStartEvent) => setActiveId(String(active.id))
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null)
    if (over && isPipelineStage(over.id)) onMove(String(active.id), over.id, 'drag')
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable: 'Use the Move to menu on the card to change its stage.',
        },
      }}
    >
      <div
        role="region"
        aria-label="Deals by stage. Scrolls sideways."
        tabIndex={0}
        className="relative -mx-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0"
      >
        <ol className="flex w-max gap-3">
          {PIPELINE_STAGES.map((stage) => (
            <Column
              key={stage.id}
              stage={stage.id}
              cards={cards.filter((c) => c.stage === stage.id)}
              partnerNames={partnerNames}
              onMove={onMove}
            />
          ))}
        </ol>
      </div>
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="w-56 cursor-grabbing rounded-lg border border-accent bg-surface p-3 shadow-lg">
            <CardBody
              card={active}
              partnerName={active.lead.partnerId ? partnerNames.get(active.lead.partnerId) : undefined}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
