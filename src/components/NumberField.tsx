import { useId, useState, type ReactNode } from 'react'
import { formatGBP, formatNumber } from '@/lib/format'

export type FieldUnit = 'pounds' | 'percent' | 'number'

interface NumberFieldProps {
  label: string
  /** Keep the label for screen readers only, where a table heading already names the field. */
  hideLabel?: boolean
  /** In model units: shares run 0–1 and show as 0–100%. */
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  unit?: FieldUnit
  /** Decimal places the viewer can type, in display units. */
  decimals?: number
  /** Shown after the box, e.g. "per site a month". */
  suffix?: string
  /** Shown under the field, e.g. where the default comes from. */
  note?: ReactNode
  /** When set and the value differs, offers a way back to it. */
  defaultValue?: number
  /** Shown in place of the number while the field is disabled. */
  disabledText?: string
  disabled?: boolean
}

const toDisplay = (value: number, unit: FieldUnit) => (unit === 'percent' ? value * 100 : value)
const fromDisplay = (value: number, unit: FieldUnit) => (unit === 'percent' ? value / 100 : value)

function show(value: number, unit: FieldUnit, decimals: number) {
  return unit === 'pounds'
    ? formatGBP(value, { pence: decimals > 0 })
    : `${formatNumber(toDisplay(value, unit), decimals)}${unit === 'percent' ? '%' : ''}`
}

/**
 * A number box that accepts what people type ("1,350", "£95", "8.5%"), commits only
 * valid values, and says what range it takes when the entry is out of bounds.
 */
export function NumberField({
  label,
  hideLabel = false,
  value,
  onChange,
  min,
  max,
  unit = 'number',
  decimals = 0,
  suffix,
  note,
  defaultValue,
  disabledText,
  disabled = false,
}: NumberFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const shown =
    disabled && disabledText !== undefined
      ? disabledText
      : (draft ?? formatNumber(toDisplay(value, unit), decimals))
  const low = toDisplay(min, unit)
  const high = toDisplay(max, unit)

  const parse = (text: string): number | null => {
    const cleaned = text.replace(/[£,%\s]/g, '')
    if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return null
    const n = Number(cleaned)
    if (!Number.isFinite(n) || n < low || n > high) return null
    const factor = 10 ** decimals
    return fromDisplay(Math.round(n * factor) / factor, unit)
  }
  const invalid = draft !== null && parse(draft) === null
  const message = `Enter ${unit === 'pounds' ? 'an amount' : 'a number'} from ${show(min, unit, 0)} to ${show(max, unit, 0)}`

  return (
    <div className="min-w-0">
      <label htmlFor={id} className={hideLabel ? 'sr-only' : 'mb-1 block text-xs text-ink-subtle'}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <div className="relative w-28 shrink-0">
          {unit === 'pounds' && (
            <span
              className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-sm text-ink-subtle"
              aria-hidden="true"
            >
              £
            </span>
          )}
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={shown}
            disabled={disabled}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : note ? `${id}-note` : undefined}
            onChange={(e) => {
              setDraft(e.target.value)
              const next = parse(e.target.value)
              if (next !== null) onChange(next)
            }}
            onBlur={() => setDraft(null)}
            className={`h-9 w-full rounded-lg border bg-surface text-sm text-ink tabular-nums focus-visible:border-accent disabled:opacity-40 ${
              invalid ? 'border-danger' : 'border-line'
            } ${unit === 'pounds' ? 'pl-6' : 'pl-2.5'} ${unit === 'percent' ? 'pr-7' : 'pr-2.5'}`}
          />
          {unit === 'percent' && (
            <span
              className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center text-sm text-ink-subtle"
              aria-hidden="true"
            >
              %
            </span>
          )}
        </div>
        {suffix && <span className="text-xs text-ink-subtle">{suffix}</span>}
      </div>
      {invalid ? (
        <p id={`${id}-error`} className="mt-1 text-[11px] text-danger-ink">
          {message}
        </p>
      ) : (
        note && (
          <p id={`${id}-note`} className="mt-1 text-[11px] leading-relaxed text-ink-subtle">
            {note}
          </p>
        )
      )}
      {defaultValue !== undefined && defaultValue !== value && !disabled && (
        <button
          type="button"
          onClick={() => {
            setDraft(null)
            onChange(defaultValue)
          }}
          className="mt-0.5 text-[11px] font-medium text-ink-muted underline decoration-line underline-offset-2 hover:text-ink"
        >
          Use default ({show(defaultValue, unit, decimals)})
        </button>
      )}
    </div>
  )
}
