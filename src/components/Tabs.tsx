import { useRef, type KeyboardEvent } from 'react'
import { formatNumber } from '@/lib/format'
import { tabIds } from './tabIds'

export interface Tab<Id extends string = string> {
  id: Id
  label: string
  /** Shown in a badge beside the label. */
  count?: number
}

interface TabListProps<Id extends string> {
  tabs: readonly Tab<Id>[]
  selected: Id
  onSelect: (id: Id) => void
  /** Read by screen readers, e.g. "Datasets". */
  label: string
  /** Prefix for the tab and panel IDs; see `tabIds`. */
  group: string
  /** On narrow screens, list the tabs one above another instead of scrolling sideways. */
  stack?: boolean
}

/**
 * A row of tabs that scrolls sideways when it runs out of room, or with `stack` sits in
 * a column on narrow screens. Arrow keys, Home and End move between tabs.
 */
export function TabList<Id extends string>({
  tabs,
  selected,
  onSelect,
  label,
  group,
  stack = false,
}: TabListProps<Id>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const active = Math.max(
    0,
    tabs.findIndex((t) => t.id === selected),
  )

  const select = (index: number) => {
    const tab = tabs[index]
    if (!tab) return
    onSelect(tab.id)
    refs.current[index]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent) => {
    const last = tabs.length - 1
    // Step from the focused tab: a selection kept in the URL can lag a quick second key press
    const focused = refs.current.findIndex((el) => el === event.target)
    const from = focused === -1 ? active : focused
    const nextTab = from === last ? 0 : from + 1
    const previousTab = from === 0 ? last : from - 1
    const targets: Partial<Record<string, number>> = {
      ArrowRight: nextTab,
      ArrowLeft: previousTab,
      ...(stack && { ArrowDown: nextTab, ArrowUp: previousTab }),
      Home: 0,
      End: last,
    }
    const next = targets[event.key]
    if (next === undefined) return
    event.preventDefault()
    select(next)
  }

  return (
    <div
      className={
        stack
          ? 'flex flex-col border-b border-line sm:flex-row sm:overflow-x-auto'
          : 'flex overflow-x-auto border-b border-line'
      }
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {tabs.map((tab, index) => {
        const isSelected = index === active
        const ids = tabIds(group, tab.id)
        return (
          <button
            key={tab.id}
            ref={(el) => {
              refs.current[index] = el
            }}
            type="button"
            role="tab"
            id={ids.tab}
            aria-selected={isSelected}
            aria-controls={ids.panel}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => select(index)}
            className={[
              'relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
              stack ? 'border-l-2 sm:-mb-px sm:border-b-2 sm:border-l-0' : '-mb-px border-b-2',
              isSelected
                ? 'border-accent font-medium text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-surface-muted px-1.5 py-0.5 text-[11px] text-ink-subtle tabular-nums">
                {formatNumber(tab.count)}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
