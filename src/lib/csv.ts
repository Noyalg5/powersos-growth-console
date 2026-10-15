/**
 * CSV for exported views (RFC 4180: comma-separated, CRLF line ends, quotes doubled).
 * Every export opens with the synthetic-data label, as printed views do.
 */
import type { Timestamp } from '@/types'
import { formatDate } from './format'

export type CsvValue = string | number | null

/** A spreadsheet runs a cell that starts with one of these as a formula. */
const FORMULA_START = /^[=+\-@\t\r]/
const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/

/** One cell. Text a spreadsheet would run as a formula gets a leading apostrophe. */
export function csvCell(value: CsvValue): string {
  if (value === null) return ''
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new RangeError(`csvCell() needs a finite number, got ${value}`)
  }
  let text = String(value)
  if (FORMULA_START.test(text) && !PLAIN_NUMBER.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) || text !== text.trim() ? `"${text.replaceAll('"', '""')}"` : text
}

export function toCsv(rows: readonly (readonly CsvValue[])[]): string {
  return rows.map((row) => `${row.map(csvCell).join(',')}\r\n`).join('')
}

export interface CsvLabel {
  /** What the export is, e.g. "Responder compliance". */
  title: string
  asOf: Timestamp
  /** The footer notice, word for word. */
  notice: string
}

/** A table with the synthetic-data label, its title and date, and a blank line above it. */
export function labelledCsv(table: string, { title, asOf, notice }: CsvLabel): string {
  return toCsv([[`Synthetic data: ${title} as at ${formatDate(asOf)}`], [notice], []]) + table
}
