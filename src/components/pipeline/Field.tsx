import type { ReactNode } from 'react'

/** Selects, text boxes and date pickers share one look. */
export const control =
  'h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink focus-visible:border-accent'

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs text-ink-subtle">
        {label}
      </label>
      {children}
    </div>
  )
}
