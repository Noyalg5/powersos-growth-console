import { useMemo, useState, type ReactNode } from 'react'

export type SortValue = string | number | null

export interface Column<T> {
  key: string
  header: string
  /** Value used for sorting. Null sorts last in either direction. */
  sortValue: (row: T) => SortValue
  /** Cell content. Defaults to the sort value. */
  render?: (row: T) => ReactNode
  align?: 'left' | 'right'
  /** Let long text wrap instead of keeping the cell on one line. */
  wrap?: boolean
}

interface DataTableProps<T> {
  rows: readonly T[]
  columns: readonly Column<T>[]
  rowKey: (row: T) => string
  /** Read by screen readers. */
  caption: string
  /** Rows to flag, with a short reason shown beside the first cell. */
  flag?: (row: T) => string | undefined
}

type Sort = { key: string; direction: 'ascending' | 'descending' }

const collator = new Intl.Collator('en-GB', { numeric: true, sensitivity: 'base' })

function compare(a: SortValue, b: SortValue): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return collator.compare(String(a), String(b))
}

/** A plain table whose columns sort when their header is clicked. */
export function DataTable<T>({ rows, columns, rowKey, caption, flag }: DataTableProps<T>) {
  const [sort, setSort] = useState<Sort | null>(null)

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key)
    if (!sort || !column) return rows
    const sign = sort.direction === 'ascending' ? 1 : -1
    return [...rows].sort((x, y) => {
      const a = column.sortValue(x)
      const b = column.sortValue(y)
      if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
      return sign * compare(a, b)
    })
  }, [rows, columns, sort])

  const toggle = (key: string) =>
    setSort((current) =>
      current?.key === key && current.direction === 'ascending'
        ? { key, direction: 'descending' }
        : { key, direction: 'ascending' },
    )

  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}. Select a column heading to sort.</caption>
        <thead className="border-b border-line bg-surface-muted text-xs text-ink-muted">
          <tr>
            {columns.map((column) => {
              const active = sort?.key === column.key
              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={active ? sort.direction : 'none'}
                  className={`px-3 py-2 font-medium whitespace-nowrap ${column.align === 'right' ? 'text-right' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(column.key)}
                    className={`inline-flex items-center gap-1 rounded hover:text-ink ${active ? 'text-ink' : ''}`}
                  >
                    {column.header}
                    <span
                      aria-hidden="true"
                      className={active ? 'text-accent-ink' : 'text-ink-subtle'}
                    >
                      {active ? (sort.direction === 'ascending' ? '↑' : '↓') : '↕'}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {sorted.map((row) => {
            const reason = flag?.(row)
            return (
              <tr
                key={rowKey(row)}
                className={reason ? 'bg-accent-soft' : 'hover:bg-surface-muted'}
              >
                {columns.map((column, i) => (
                  <td
                    key={column.key}
                    className={[
                      'px-3 py-2 align-top text-ink-muted',
                      column.align === 'right' ? 'text-right tabular-nums' : '',
                      column.wrap ? 'min-w-64' : 'whitespace-nowrap',
                    ].join(' ')}
                  >
                    {column.render ? column.render(row) : (column.sortValue(row) ?? '')}
                    {i === 0 && reason && (
                      <span className="ml-2 rounded-full border border-accent px-1.5 py-0.5 text-[11px] font-medium text-accent-ink">
                        {reason}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
