import type { Dispatch, ReactNode } from 'react'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
} from '@/components/icons'
import { SPEEDS, type PlaybackAction, type PlaybackState } from '@/lib/playback'

interface PlaybackControlsProps {
  state: PlaybackState
  stepCount: number
  dispatch: Dispatch<PlaybackAction>
}

function ControlButton({
  label,
  onClick,
  disabled,
  primary,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  primary?: boolean
  children: ReactNode
}) {
  return (
    // aria-disabled rather than disabled, so focus stays put at either end of the timeline
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      aria-disabled={disabled || undefined}
      aria-label={label}
      title={label}
      className={`inline-flex size-10 items-center justify-center rounded-lg transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-40 ${
        primary
          ? 'bg-accent text-on-accent hover:brightness-95'
          : 'border border-line bg-surface text-ink-muted hover:bg-surface-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export function PlaybackControls({ state, stepCount, dispatch }: PlaybackControlsProps) {
  const last = state.step >= stepCount - 1
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div role="group" aria-label="Playback" className="flex items-center gap-2">
        <ControlButton label="Restart" onClick={() => dispatch({ type: 'restart' })}>
          <RestartIcon />
        </ControlButton>
        <ControlButton
          label="Previous step"
          onClick={() => dispatch({ type: 'back' })}
          disabled={state.step === 0}
        >
          <ChevronLeftIcon />
        </ControlButton>
        <ControlButton
          label={state.playing ? 'Pause' : last ? 'Play again from the start' : 'Play'}
          onClick={() => dispatch({ type: 'toggle' })}
          primary
        >
          {state.playing ? <PauseIcon /> : <PlayIcon />}
        </ControlButton>
        <ControlButton
          label="Next step"
          onClick={() => dispatch({ type: 'next' })}
          disabled={last}
        >
          <ChevronRightIcon />
        </ControlButton>
      </div>

      <div
        role="group"
        aria-label="Playback speed"
        className="flex rounded-lg border border-line bg-surface p-0.5"
      >
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            type="button"
            aria-pressed={state.speed === speed}
            onClick={() => dispatch({ type: 'speed', speed })}
            className={`rounded-md px-3 py-1.5 text-sm font-medium tabular-nums transition-colors ${
              state.speed === speed
                ? 'bg-surface-muted text-ink'
                : 'text-ink-subtle hover:text-ink'
            }`}
          >
            {speed}×
          </button>
        ))}
      </div>

      <p className="hidden text-xs text-ink-subtle md:ml-auto md:block">
        <kbd className="rounded border border-line px-1 font-sans">Space</kbd> play or pause ·{' '}
        <kbd className="rounded border border-line px-1 font-sans">←</kbd>{' '}
        <kbd className="rounded border border-line px-1 font-sans">→</kbd> step
      </p>
    </div>
  )
}
