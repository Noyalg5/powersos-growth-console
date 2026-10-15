import { describe, expect, it } from 'vitest'
import {
  INITIAL_PLAYBACK,
  playback,
  SPEEDS,
  stepDuration,
  STEP_MS,
  type PlaybackAction,
  type PlaybackState,
} from './playback'

const STEPS = 7
const run = (state: PlaybackState, ...actions: PlaybackAction[]) =>
  actions.reduce((s, action) => playback(s, action, STEPS), state)

describe('playback', () => {
  it('starts paused on the first step at 1×', () => {
    expect(INITIAL_PLAYBACK).toEqual({ step: 0, playing: false, speed: 1 })
  })

  it('advances one step per tick while playing and stops on the last step', () => {
    let state = run(INITIAL_PLAYBACK, { type: 'play' })
    for (let i = 1; i < STEPS; i++) {
      state = run(state, { type: 'tick' })
      expect(state.step).toBe(i)
    }
    expect(state.playing).toBe(false)
    expect(run(state, { type: 'tick' }).step).toBe(STEPS - 1)
  })

  it('ignores ticks while paused', () => {
    const paused = { ...INITIAL_PLAYBACK, step: 3 }
    expect(run(paused, { type: 'tick' })).toBe(paused)
  })

  it('toggles between play and pause, and plays again from the start at the end', () => {
    expect(run(INITIAL_PLAYBACK, { type: 'toggle' }).playing).toBe(true)
    expect(run(INITIAL_PLAYBACK, { type: 'toggle' }, { type: 'toggle' }).playing).toBe(false)
    const atEnd = { ...INITIAL_PLAYBACK, step: STEPS - 1 }
    expect(run(atEnd, { type: 'play' })).toMatchObject({ step: 0, playing: true })
  })

  it('steps by hand within the bounds, keeping play state', () => {
    expect(run(INITIAL_PLAYBACK, { type: 'back' }).step).toBe(0)
    expect(run(INITIAL_PLAYBACK, { type: 'next' }, { type: 'next' }).step).toBe(2)
    expect(run({ ...INITIAL_PLAYBACK, step: STEPS - 1 }, { type: 'next' }).step).toBe(STEPS - 1)
    const playing = run(INITIAL_PLAYBACK, { type: 'play' }, { type: 'next' })
    expect(playing).toMatchObject({ step: 1, playing: true })
    expect(run(playing, { type: 'go', step: STEPS - 1 }).playing).toBe(false)
  })

  it('jumps to a step, clamped to the timeline', () => {
    expect(run(INITIAL_PLAYBACK, { type: 'go', step: 4 }).step).toBe(4)
    expect(run(INITIAL_PLAYBACK, { type: 'go', step: 99 }).step).toBe(STEPS - 1)
    expect(run(INITIAL_PLAYBACK, { type: 'go', step: -3 }).step).toBe(0)
    expect(() => run(INITIAL_PLAYBACK, { type: 'go', step: 1.5 })).toThrow(RangeError)
  })

  it('restarts paused on the first step and keeps the speed', () => {
    const state = run(INITIAL_PLAYBACK, { type: 'speed', speed: 4 }, { type: 'play' }, { type: 'next' })
    expect(run(state, { type: 'restart' })).toEqual({ step: 0, playing: false, speed: 4 })
  })

  it('needs at least one step', () => {
    expect(() => playback(INITIAL_PLAYBACK, { type: 'next' }, 0)).toThrow(RangeError)
  })
})

describe('stepDuration', () => {
  it('halves with each speed-up', () => {
    expect(SPEEDS).toEqual([1, 2, 4])
    expect(stepDuration(1)).toBe(STEP_MS)
    expect(stepDuration(2)).toBe(STEP_MS / 2)
    expect(stepDuration(4)).toBe(STEP_MS / 4)
  })
})
