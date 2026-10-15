/**
 * Playback for the step-by-step simulator: play, pause, step, restart and speed,
 * as a pure reducer so every control and key press behaves the same way.
 */

export const SPEEDS = [1, 2, 4] as const
export type Speed = (typeof SPEEDS)[number]

/** How long each step stays on screen at 1× speed. */
export const STEP_MS = 4000

export interface PlaybackState {
  step: number
  playing: boolean
  speed: Speed
}

export type PlaybackAction =
  | { type: 'play' }
  | { type: 'pause' }
  | { type: 'toggle' }
  | { type: 'next' }
  | { type: 'back' }
  | { type: 'go'; step: number }
  | { type: 'restart' }
  | { type: 'speed'; speed: Speed }
  /** The timer firing while playing. */
  | { type: 'tick' }

export const INITIAL_PLAYBACK: PlaybackState = { step: 0, playing: false, speed: 1 }

/** Milliseconds a step stays on screen at a speed. */
export function stepDuration(speed: Speed): number {
  return STEP_MS / speed
}

/**
 * The next playback state. Playing stops on the last step; pressing play there
 * starts again from the first. Stepping by hand keeps playing if it was.
 */
export function playback(
  state: PlaybackState,
  action: PlaybackAction,
  stepCount: number,
): PlaybackState {
  if (!Number.isInteger(stepCount) || stepCount < 1) {
    throw new RangeError(`stepCount must be a positive integer, got ${stepCount}`)
  }
  const last = stepCount - 1
  const goTo = (step: number): PlaybackState => {
    const next = Math.min(last, Math.max(0, step))
    return { ...state, step: next, playing: state.playing && next < last }
  }

  switch (action.type) {
    case 'play':
      return state.step >= last ? { ...state, step: 0, playing: true } : { ...state, playing: true }
    case 'pause':
      return { ...state, playing: false }
    case 'toggle':
      return playback(state, { type: state.playing ? 'pause' : 'play' }, stepCount)
    case 'next':
      return goTo(state.step + 1)
    case 'back':
      return goTo(state.step - 1)
    case 'go':
      if (!Number.isInteger(action.step)) {
        throw new RangeError(`step must be an integer, got ${action.step}`)
      }
      return goTo(action.step)
    case 'restart':
      return { ...state, step: 0, playing: false }
    case 'speed':
      return { ...state, speed: action.speed }
    case 'tick':
      return state.playing ? goTo(state.step + 1) : state
  }
}
