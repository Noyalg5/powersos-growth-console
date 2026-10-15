import type { ReactNode } from 'react'
import {
  COVER_MODES,
  parseIsoDate,
  toIsoDate,
  type CoverMode,
  type DateBounds,
  type NetworkFilters,
} from '@/lib/networkFilters'
import type { Region, SectorId } from '@/types'

interface NetworkFilterBarProps {
  filters: NetworkFilters
  bounds: DateBounds
  sectors: readonly { id: SectorId; label: string }[]
  regions: readonly Region[]
  onChange: (patch: Partial<NetworkFilters>) => void
  onReset: () => void
  /** True when any filter differs from its default. */
  filtered: boolean
}

const control =
  'h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus-visible:border-accent'

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-ink-subtle">
        {label}
      </label>
      {children}
    </div>
  )
}

export function NetworkFilterBar({
  filters,
  bounds,
  sectors,
  regions,
  onChange,
  onReset,
  filtered,
}: NetworkFilterBarProps) {
  const min = toIsoDate(bounds.min)
  const max = toIsoDate(bounds.max)
  const onDate = (key: 'from' | 'to') => (value: string) => {
    const day = parseIsoDate(value)
    if (day !== null) onChange({ [key]: day })
  }

  return (
    <section
      aria-label="Filters"
      className="rounded-xl border border-line bg-surface p-4 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <Field label="Sector" htmlFor="filter-sector">
          <select
            id="filter-sector"
            className={control}
            value={filters.sector ?? ''}
            onChange={(e) =>
              onChange({ sector: (e.target.value || null) as SectorId | null })
            }
          >
            <option value="">All sectors</option>
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Region" htmlFor="filter-region">
          <select
            id="filter-region"
            className={control}
            value={filters.region ?? ''}
            onChange={(e) => onChange({ region: (e.target.value || null) as Region | null })}
          >
            <option value="">All regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From" htmlFor="filter-from">
          <input
            id="filter-from"
            type="date"
            className={control}
            min={min}
            max={toIsoDate(filters.to)}
            value={toIsoDate(filters.from)}
            onChange={(e) => onDate('from')(e.target.value)}
          />
        </Field>
        <Field label="To" htmlFor="filter-to">
          <input
            id="filter-to"
            type="date"
            className={control}
            min={toIsoDate(filters.from)}
            max={max}
            value={toIsoDate(filters.to)}
            onChange={(e) => onDate('to')(e.target.value)}
          />
        </Field>
        <div className="col-span-2 flex items-end md:col-span-4 xl:col-span-1">
          <button
            type="button"
            onClick={filtered ? onReset : undefined}
            aria-disabled={!filtered || undefined}
            className="h-9 rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
          >
            Reset filters
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id="cover-label" className="text-xs text-ink-subtle">
          Judge cover at
        </span>
        <div
          role="group"
          aria-labelledby="cover-label"
          className="flex flex-wrap rounded-lg border border-line bg-surface p-0.5"
        >
          {(Object.keys(COVER_MODES) as CoverMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={filters.cover === mode}
              onClick={() => onChange({ cover: mode })}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                filters.cover === mode
                  ? 'bg-accent-soft font-medium text-ink'
                  : 'text-ink-subtle hover:text-ink'
              }`}
            >
              {COVER_MODES[mode].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-subtle">The view is saved in the link, so it can be shared.</span>
      </div>
    </section>
  )
}
