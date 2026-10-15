import { labelledCsv } from '@/lib/csv'
import { formatIsoDate } from '@/lib/format'
import { NOTICE } from '@/nav'
import { DownloadIcon } from './icons'

interface ExportButtonProps {
  /** What is exported, e.g. "Responder compliance". Names the file and heads the sheet. */
  title: string
  asOf: number
  /** The CSV table for the current view, built when the button is pressed. */
  table: () => string
  /** Rows in the current view, for the button's label. */
  rows: number
}

/** Downloads the current view as CSV, labelled as synthetic data like every printed view. */
export function ExportButton({ title, asOf, table, rows }: ExportButtonProps) {
  const download = () => {
    const csv = labelledCsv(table(), { title, asOf, notice: NOTICE })
    // The byte-order mark tells Excel the file is UTF-8, so £ and dashes survive
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${formatIsoDate(asOf)}-synthetic.csv`
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={rows === 0}
      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:cursor-default disabled:opacity-40 disabled:hover:bg-surface"
    >
      <DownloadIcon width={16} height={16} />
      Export CSV
      <span className="sr-only">
        : {rows} {rows === 1 ? 'row' : 'rows'}, labelled as synthetic data
      </span>
    </button>
  )
}
