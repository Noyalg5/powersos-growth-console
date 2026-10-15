import { useEffect, useMemo, useReducer } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { CostPanel } from '@/components/simulator/CostPanel'
import { EcosystemDiagram } from '@/components/simulator/EcosystemDiagram'
import { MatchRanking } from '@/components/simulator/MatchRanking'
import { PlaybackControls } from '@/components/simulator/PlaybackControls'
import { ResponseMeter } from '@/components/simulator/ResponseMeter'
import { ScenarioPicker } from '@/components/simulator/ScenarioPicker'
import { SidePanel } from '@/components/simulator/SidePanel'
import { StepTimeline } from '@/components/simulator/StepTimeline'
import { callOuts, customers, partners, responders, sectorLabel, suppliers } from '@/data'
import { getScenario, resolveScenario, SCENARIOS, type ScenarioId } from '@/data/scenarios'
import { demoTarget, type DemoCue } from '@/demo'
import { formatDateTime, formatTime } from '@/lib/format'
import { INITIAL_PLAYBACK, playback, stepDuration, type PlaybackAction } from '@/lib/playback'
import { buildSimulation, SIDES, STEPS, type SideId, type Simulation } from '@/lib/scenario'
import { formatSectionNumber, getSection } from '@/nav'

const section = getSection('simulator')
const data = { customers, responders, suppliers, partners, callOuts }
const APPROVAL_STEP = STEPS.findIndex((step) => step.id === 'source')
const MATCH_STEP = STEPS.findIndex((step) => step.id === 'match')

const isScenario = (value: string | null): value is ScenarioId =>
  SCENARIOS.some((s) => s.id === value)

/** Who each side is in this scenario, for the panel headings. */
function sideOwner(sim: Simulation, side: SideId): string {
  const { input, contact, responder, orders } = sim
  switch (side) {
    case 'customer':
      return `${contact.name}, ${contact.role} · ${input.customer.name}`
    case 'responder':
      return `${responder.responder.name}, ${responder.responder.town}`
    case 'supplier':
      return orders.length > 0
        ? [...new Set(orders.map((o) => o.supplier.name))].join(' · ')
        : 'No parts or plant needed'
    case 'partner':
      return `${input.facilities.name} · ${input.insurer.name}`
  }
}

/** Keys pressed in a form field or over the open navigation are not for the simulator. */
function ignoreKey(event: KeyboardEvent): boolean {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return true
  if (document.querySelector('[aria-modal="true"]')) return true
  const target = event.target instanceof HTMLElement ? event.target : null
  if (!target) return false
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

export default function EcosystemSimulator() {
  // The scenario is in the URL, so a link can open any of them
  const [params, setParams] = useSearchParams()
  const requested = params.get('scenario')
  const scenarioId: ScenarioId = isScenario(requested) ? requested : 'hospital'
  const sim = useMemo(
    () => buildSimulation(resolveScenario(getScenario(scenarioId), data)),
    [scenarioId],
  )
  const [state, dispatch] = useReducer(
    (current: typeof INITIAL_PLAYBACK, action: PlaybackAction) =>
      playback(current, action, STEPS.length),
    INITIAL_PLAYBACK,
  )
  // Advance while playing; any change of step, speed or play state restarts the clock
  useEffect(() => {
    if (!state.playing) return
    const timer = window.setTimeout(() => dispatch({ type: 'tick' }), stepDuration(state.speed))
    return () => window.clearTimeout(timer)
  }, [state.playing, state.step, state.speed])

  // The guided demo opens the page asking it to play from the start
  const { key, state: cue } = useLocation() as { key: string; state: { demo?: DemoCue } | null }
  const autoplay = cue?.demo === 'play'
  useEffect(() => {
    if (!autoplay) return
    dispatch({ type: 'restart' })
    dispatch({ type: 'play' })
  }, [autoplay, key])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (ignoreKey(event)) return
      const onControl =
        event.target instanceof HTMLElement && ['BUTTON', 'A'].includes(event.target.tagName)
      if (event.key === ' ' && !onControl) {
        // A focused button keeps Space for itself
        event.preventDefault()
        dispatch({ type: 'toggle' })
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        dispatch({ type: 'next' })
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        dispatch({ type: 'back' })
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const step = sim.steps[state.step]
  if (!step) throw new Error(`The simulation has no step ${state.step}`)

  const chooseScenario = (id: ScenarioId) => {
    setParams({ scenario: id }, { replace: true, preventScrollReset: true })
    dispatch({ type: 'restart' })
  }

  const { input } = sim
  const facts = [
    { label: 'Site', value: `${input.site.name}, ${input.site.region}` },
    {
      label: 'Customer',
      value: `${input.customer.name} (${sectorLabel(input.customer.sector)})`,
    },
    { label: 'Fault', value: input.faultLabel },
    { label: 'Requested', value: formatDateTime(input.requestedAt) },
    { label: 'Criticality', value: `${input.site.criticality} of 5` },
  ]

  return (
    <article>
      <PageHeader
        eyebrow={`Section ${formatSectionNumber(section.number)}`}
        title={section.title}
        lead={section.question}
      >
        <p className="mt-4 leading-relaxed text-pretty text-ink-muted">
          One HV emergency, step by step, from the request to the review. Every responder,
          supplier, partner and price comes from the synthetic data; partner and supplier
          behaviour follows a working definition.
        </p>
      </PageHeader>

      <section aria-labelledby="scenario-heading" className="mt-10">
        <h2 id="scenario-heading" className="sr-only">
          Scenario
        </h2>
        <ScenarioPicker scenarios={SCENARIOS} selected={scenarioId} onSelect={chooseScenario} />
        <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {facts.map((fact) => (
            <div key={fact.label} className="flex gap-2">
              <dt className="text-ink-subtle">{fact.label}</dt>
              <dd className="text-ink">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="simulator-heading"
        className="mt-6 rounded-xl border border-line bg-surface"
        {...demoTarget('simulator')}
      >
        <h2 id="simulator-heading" className="sr-only">
          Simulator
        </h2>
        <div className="border-b border-line p-3 sm:p-4">
          <PlaybackControls state={state} stepCount={STEPS.length} dispatch={dispatch} />
        </div>
        <StepTimeline
          steps={sim.steps}
          current={state.step}
          playingFor={state.playing ? stepDuration(state.speed) : null}
          onSelect={(index) => dispatch({ type: 'go', step: index })}
        />
        <p className="sr-only" aria-live="polite">
          Step {step.index + 1} of {STEPS.length}: {step.label}, {formatTime(step.at)}.
        </p>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="sides-heading">
          <h2 id="sides-heading" className="sr-only">
            What each side sees
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {SIDES.map((side) => (
              <SidePanel
                key={side}
                side={side}
                who={sideOwner(sim, side)}
                workingDefinition={side === 'supplier' || side === 'partner'}
                step={step.id}
                stepLabel={step.label}
                at={step.at}
                screens={step.screens[side]}
              />
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <ResponseMeter progress={step.response} requestedAt={input.requestedAt} />
          <CostPanel
            cost={step.cost}
            step={state.step}
            approvalStep={APPROVAL_STEP}
            approvedAt={sim.times.source}
            approver={sim.contact.name}
          />
        </div>
      </div>

      <MatchRanking
        match={sim.match}
        revealed={state.step >= MATCH_STEP}
        onReveal={() => dispatch({ type: 'go', step: MATCH_STEP })}
      />

      <EcosystemDiagram />
    </article>
  )
}
