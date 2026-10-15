import { ChevronDownIcon } from '@/components/icons'
import type { AssumptionGroup } from '@/lib/assumptions'

/** Every modelled assumption, folded away until asked for. */
export function AssumptionsPanel({ groups }: { groups: readonly AssumptionGroup[] }) {
  return (
    <details className="group rounded-xl border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3.5 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-ink">Assumptions &amp; method</span>
          <span className="mt-0.5 block text-xs text-ink-subtle">
            Every modelled assumption and where it is used. All data is synthetic.
          </span>
        </span>
        <ChevronDownIcon
          width={18}
          height={18}
          className="shrink-0 text-ink-subtle transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="grid gap-x-10 gap-y-6 border-t border-line px-4 py-5 sm:px-5 lg:grid-cols-2">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`assumptions-${group.id}`}>
            <h3 id={`assumptions-${group.id}`} className="text-sm font-semibold text-ink">
              {group.title}
            </h3>
            <p className="mt-0.5 text-xs text-ink-subtle">Used in: {group.usedIn}</p>
            <dl className="mt-2 divide-y divide-line">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="grid gap-x-4 gap-y-0.5 py-2 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]"
                >
                  <dt className="text-ink-muted">{item.label}</dt>
                  <dd className="leading-relaxed text-ink">{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </details>
  )
}
