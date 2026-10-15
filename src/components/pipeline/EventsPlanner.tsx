import { NumberField } from '@/components/NumberField'
import { ResetBar } from '@/components/ResetBar'
import { SectionHeading } from '@/components/SectionHeading'
import { Tag } from '@/components/Tag'
import type { Persisted } from '@/components/usePersistentState'
import {
  EVENT_CATEGORY_LABELS,
  EVENT_OBJECTIVE_LABELS,
  EVENT_STATUS_LABELS,
} from '@/data'
import { formatGBP, formatList, formatNumber } from '@/lib/format'
import { SIDE_LABELS } from '@/lib/onboarding'
import {
  EVENT_BUDGET_MAX,
  EVENT_OBJECTIVES,
  EVENT_STATUSES,
  EVENT_TEXT_MAX_LENGTH,
  eventBudget,
} from '@/lib/pipeline'
import type { EventCategory, EventObjective, EventPlan, EventStatus } from '@/types'
import { control } from './Field'

interface EventsPlannerProps {
  state: Persisted<readonly EventPlan[]>
}

const pounds = (n: number) => formatGBP(n, { pence: false })

/** Shown beside a name or date until someone has checked it with the organiser. */
function Verify() {
  return (
    <span className="inline-flex items-center rounded-full border border-accent/60 bg-accent-soft px-1.5 text-[11px] leading-4 font-medium text-accent-ink">
      Verify
    </span>
  )
}

function EventRow({
  event,
  onChange,
}: {
  event: EventPlan
  onChange: (patch: Partial<EventPlan>) => void
}) {
  const id = `event-${event.id}`
  const field = (label: string, value: string, key: 'name' | 'date', placeholder: string) => (
    <div className="flex items-center gap-2">
      <input
        id={`${id}-${key}`}
        aria-label={`${label}: ${event.type}${event.verified ? '' : ', to verify'}`}
        className={control}
        value={value}
        maxLength={EVENT_TEXT_MAX_LENGTH}
        placeholder={placeholder}
        onChange={(e) => onChange({ [key]: e.target.value })}
      />
      {!event.verified && <Verify />}
    </div>
  )
  return (
    <tr className="align-top">
      <th scope="row" className="px-4 py-3 text-left font-normal">
        <span className="font-medium text-ink">{event.type}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          For {formatList(event.sides.map((s) => SIDE_LABELS[s].many.toLowerCase()))}
        </span>
      </th>
      <td className="space-y-2 px-3 py-3">
        {field('Event name', event.name, 'name', 'Event name')}
        {field('Date', event.date, 'date', 'Date')}
        <label className="flex items-center gap-2 text-xs text-ink-muted">
          <input
            type="checkbox"
            checked={event.verified}
            onChange={(e) => onChange({ verified: e.target.checked })}
            className="size-4 accent-accent"
          />
          Checked with the organiser
        </label>
      </td>
      <td className="min-w-56 px-3 py-3">
        <select
          aria-label={`Objective: ${event.type}`}
          className={control}
          value={event.objective}
          onChange={(e) => onChange({ objective: e.target.value as EventObjective })}
        >
          {EVENT_OBJECTIVES.map((o) => (
            <option key={o} value={o}>
              {EVENT_OBJECTIVE_LABELS[o]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <NumberField
          label={`Budget estimate: ${event.type}`}
          hideLabel
          value={event.budget}
          onChange={(budget) => onChange({ budget })}
          min={0}
          max={EVENT_BUDGET_MAX}
          unit="pounds"
        />
      </td>
      <td className="min-w-40 px-4 py-3">
        <select
          aria-label={`Status: ${event.type}`}
          className={control}
          value={event.status}
          onChange={(e) => onChange({ status: e.target.value as EventStatus })}
        >
          {EVENT_STATUSES.map((st) => (
            <option key={st} value={st}>
              {EVENT_STATUS_LABELS[st]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}

/** Kinds of UK industry event to attend, with the details left to verify. */
export function EventsPlanner({ state }: EventsPlannerProps) {
  const events = state.value
  const budget = eventBudget(events)
  const categories = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[]
  const update = (id: string, patch: Partial<EventPlan>) =>
    state.set(events.map((e) => (e.id === id ? { ...e, ...patch } : e)))

  return (
    <div className="space-y-8">
      <ResetBar edited={state.edited} saved={state.saved} onReset={state.reset} what="events plan">
        <Tag kind="assumption" />
        <span>Budgets are estimates. No real event or date is named until you verify it.</span>
      </ResetBar>

      <SectionHeading
        id="events-plan"
        title="Events planner"
        lead="Kinds of UK event where customers, responders and partners gather. Each name and date stays blank, marked Verify, until it has been checked against the organiser's own listing."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Budget in the plan', value: pounds(budget.planned), note: 'Every event not ruled out.' },
          { label: 'Booked or attended', value: pounds(budget.booked), note: 'Committed so far.' },
          {
            label: 'Still to verify',
            value: formatNumber(budget.toVerify),
            note: `${budget.toVerify === 1 ? 'Event' : 'Events'} in the plan whose name and date need checking.`,
          },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-line bg-surface p-4 sm:p-5">
            <h3 className="text-xs text-ink-subtle">{tile.label}</h3>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">
              {tile.value}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">{tile.note}</p>
          </div>
        ))}
        <div className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h3 className="text-xs text-ink-subtle">Budget by objective</h3>
          <dl className="mt-2 space-y-1 text-xs">
            {EVENT_OBJECTIVES.map((o) => (
              <div key={o} className="flex justify-between gap-2">
                <dt className="text-ink-muted">{EVENT_OBJECTIVE_LABELS[o]}</dt>
                <dd className="font-medium text-ink tabular-nums">{pounds(budget.byObjective[o])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[64rem] text-left text-sm">
          <caption className="sr-only">
            UK event types by sector, with objective, budget and status. Names and dates are left
            to verify with each organiser.
          </caption>
          <thead className="border-b border-line bg-surface-muted text-xs text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-2 font-medium">
                Event type
              </th>
              <th scope="col" className="w-[24%] px-3 py-2 font-medium">
                Name and date
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Objective
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Budget estimate
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Status
              </th>
            </tr>
          </thead>
          {categories.map((category) => {
            const inCategory = events.filter((e) => e.category === category)
            return (
              inCategory.length > 0 && (
                <tbody key={category} className="divide-y divide-line border-b border-line last:border-b-0">
                  <tr className="bg-surface-muted/50">
                    <th
                      scope="colgroup"
                      colSpan={5}
                      className="px-4 py-2 text-left text-xs font-semibold text-ink"
                    >
                      {EVENT_CATEGORY_LABELS[category]}
                    </th>
                  </tr>
                  {inCategory.map((event) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      onChange={(patch) => update(event.id, patch)}
                    />
                  ))}
                </tbody>
              )
            )
          })}
        </table>
      </div>
    </div>
  )
}
