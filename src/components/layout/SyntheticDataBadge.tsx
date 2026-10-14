import { DEFAULT_SEED } from '@/lib/rng'

export function SyntheticDataBadge() {
  return (
    <span
      title={`Generated from a fixed seed (${DEFAULT_SEED}), so every load shows the same figures. Not real PowerSOS data.`}
      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium whitespace-nowrap text-ink-muted"
    >
      <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
      Synthetic data
    </span>
  )
}
