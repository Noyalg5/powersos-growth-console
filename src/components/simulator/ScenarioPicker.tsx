import type { ScenarioId, ScenarioSpec } from '@/data/scenarios'

interface ScenarioPickerProps {
  scenarios: readonly ScenarioSpec[]
  selected: ScenarioId
  onSelect: (id: ScenarioId) => void
}

export function ScenarioPicker({ scenarios, selected, onSelect }: ScenarioPickerProps) {
  return (
    <div role="group" aria-label="Scenario" className="grid gap-3 md:grid-cols-3">
      {scenarios.map((scenario, index) => {
        const active = scenario.id === selected
        return (
          <button
            key={scenario.id}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(scenario.id)}
            className={`rounded-xl border p-4 text-left transition-colors ${
              active
                ? 'border-accent bg-accent-soft'
                : 'border-line bg-surface hover:bg-surface-muted'
            }`}
          >
            <span className="block font-mono text-[11px] tracking-wider text-ink-subtle uppercase">
              Scenario {index + 1}
            </span>
            <span className="mt-1 block font-medium text-ink">{scenario.title}</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
              {scenario.summary}
            </span>
          </button>
        )
      })}
    </div>
  )
}
