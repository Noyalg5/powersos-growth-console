import type { ReactNode } from 'react'
import { RestartIcon } from '@/components/icons'

interface ResetBarProps {
  edited: boolean
  saved: boolean
  onReset: () => void
  /** What the tab holds, for the button's accessible name: "sector scores and weights". */
  what: string
  children?: ReactNode
}

/** Where a tab's edits are kept, and the way back to the defaults. */
export function ResetBar({ edited, saved, onReset, what, children }: ResetBarProps) {
  const status = !saved
    ? 'This browser is blocking storage, so edits last until you leave the page.'
    : edited
      ? 'Your edits are saved in this browser.'
      : 'Showing the defaults. Edits are saved in this browser.'
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">{children}</div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-xs text-ink-subtle" role="status">
          {status}
        </p>
        <button
          type="button"
          onClick={edited ? onReset : undefined}
          aria-disabled={!edited || undefined}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-muted aria-disabled:cursor-default aria-disabled:opacity-40 aria-disabled:hover:bg-surface"
        >
          <RestartIcon width={16} height={16} />
          Reset to defaults
          <span className="sr-only">: {what}</span>
        </button>
      </div>
    </div>
  )
}
