import type { ReactNode } from 'react'

export type TagKind = 'assumption' | 'synthetic' | 'illustrative' | 'edited'

const TAGS: Record<TagKind, { label: string; className: string }> = {
  assumption: {
    label: 'Assumption, to validate with MPN',
    className: 'border-accent/60 bg-accent-soft text-accent-ink',
  },
  synthetic: { label: 'Synthetic data', className: 'border-line bg-surface-muted text-ink-muted' },
  illustrative: { label: 'Illustrative', className: 'border-line bg-surface text-ink-muted' },
  edited: { label: 'Edited', className: 'border-line bg-surface text-ink' },
}

/** A small label that says where a figure comes from. */
export function Tag({ kind, children }: { kind: TagKind; children?: ReactNode }) {
  const tag = TAGS[kind]
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] leading-4 font-medium whitespace-nowrap ${tag.className}`}
    >
      {children ?? tag.label}
    </span>
  )
}
