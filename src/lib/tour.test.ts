import { describe, expect, it } from 'vitest'
import { nextTourStep, placeCallout, scrollTopFor, spotlight, TOUR_GAP } from './tour'

const laptop = { width: 1366, height: 768 }
const callout = { width: 384, height: 200 }
const HEADER = 56

describe('placeCallout', () => {
  it('puts the callout under the element when it fits, lined up with its left edge', () => {
    const target = { top: 100, left: 300, width: 600, height: 200 }
    expect(placeCallout(target, callout, laptop, HEADER)).toEqual({
      kind: 'below',
      top: 300 + TOUR_GAP,
      left: 300,
    })
  })

  it('goes above when there is no room below', () => {
    const target = { top: 400, left: 300, width: 600, height: 300 }
    expect(placeCallout(target, callout, laptop, HEADER)).toEqual({
      kind: 'above',
      top: 400 - TOUR_GAP - 200,
      left: 300,
    })
  })

  it('goes beside a tall element when there is room, right first', () => {
    const narrow = { top: 70, left: 300, width: 500, height: 600 }
    expect(placeCallout(narrow, callout, laptop, HEADER)).toEqual({
      kind: 'right',
      top: 70,
      left: 800 + TOUR_GAP,
    })
    const onTheRight = { top: 40, left: 650, width: 680, height: 670 }
    expect(placeCallout(onTheRight, callout, laptop, HEADER)).toEqual({
      kind: 'left',
      top: HEADER + TOUR_GAP,
      left: 650 - TOUR_GAP - 384,
    })
  })

  it('keeps a callout beside an element on screen when the element starts low', () => {
    const tallCallout = { width: 384, height: 500 }
    const low = { top: 400, left: 300, width: 500, height: 900 }
    expect(placeCallout(low, tallCallout, laptop, HEADER)).toMatchObject({
      kind: 'right',
      top: 768 - 500 - TOUR_GAP,
    })
  })

  it('falls back to the bottom corner for an element taller than the screen', () => {
    const target = { top: 70, left: 300, width: 1000, height: 2000 }
    expect(placeCallout(target, callout, laptop, HEADER)).toEqual({
      kind: 'corner',
      top: 768 - 200 - TOUR_GAP,
      left: 1366 - 384 - TOUR_GAP,
    })
  })

  it('keeps the callout on screen for an element near the right edge', () => {
    const target = { top: 100, left: 1200, width: 150, height: 40 }
    const placed = placeCallout(target, callout, laptop, HEADER)
    expect(placed).toMatchObject({ kind: 'below', left: 1366 - 384 - TOUR_GAP })
  })

  it('uses the corner when the element is missing', () => {
    expect(placeCallout(null, callout, laptop, HEADER)).toMatchObject({ kind: 'corner' })
  })

  it('is a bottom sheet on a phone', () => {
    const target = { top: 100, left: 16, width: 358, height: 200 }
    expect(placeCallout(target, callout, { width: 390, height: 844 }, HEADER)).toEqual({ kind: 'sheet' })
  })

  it('never goes under the header, even when the screen is too short for it', () => {
    const placed = placeCallout(null, { width: 384, height: 700 }, { width: 1024, height: 600 }, HEADER)
    expect(placed).toMatchObject({ kind: 'corner', top: HEADER + TOUR_GAP })
  })
})

describe('scrollTopFor', () => {
  it('centres an element that fits in the space between the header and the callout', () => {
    // 768 − 56 − 200 = 512 of room; a 112 px element sits 200 px below the header
    const target = { top: 1000, left: 0, width: 600, height: 112 }
    expect(scrollTopFor(target, 500, 768, HEADER, 200)).toBe(500 + 1000 - (HEADER + 200))
  })

  it('starts a tall element just under the header', () => {
    const target = { top: 1000, left: 0, width: 600, height: 900 }
    expect(scrollTopFor(target, 0, 768, HEADER, 200)).toBe(1000 - HEADER - TOUR_GAP)
  })

  it('never scrolls above the top of the page', () => {
    const target = { top: 80, left: 0, width: 600, height: 100 }
    expect(scrollTopFor(target, 0, 768, HEADER)).toBe(0)
  })
})

describe('spotlight', () => {
  it('pads the element', () => {
    expect(spotlight({ top: 100, left: 100, width: 200, height: 50 }, laptop)).toEqual({
      top: 94,
      left: 94,
      width: 212,
      height: 62,
    })
  })

  it('is clipped to the screen', () => {
    expect(spotlight({ top: -500, left: 0, width: 1366, height: 3000 }, laptop)).toEqual({
      top: 0,
      left: 0,
      width: 1366,
      height: 768,
    })
  })

  it('has no size when the element is off screen', () => {
    expect(spotlight({ top: 2000, left: 0, width: 100, height: 100 }, laptop)).toMatchObject({
      height: 0,
    })
  })
})

describe('nextTourStep', () => {
  it('starts at the first step and walks forwards and back', () => {
    expect(nextTourStep(null, 'start', 8)).toBe(0)
    expect(nextTourStep(3, 'start', 8)).toBe(0)
    expect(nextTourStep(0, 'next', 8)).toBe(1)
    expect(nextTourStep(5, 'back', 8)).toBe(4)
  })

  it('stays on the first step going back, and finishes after the last', () => {
    expect(nextTourStep(0, 'back', 8)).toBe(0)
    expect(nextTourStep(7, 'next', 8)).toBeNull()
    expect(nextTourStep(4, 'exit', 8)).toBeNull()
  })

  it('does nothing while the tour is closed', () => {
    expect(nextTourStep(null, 'next', 8)).toBeNull()
    expect(nextTourStep(null, 'back', 8)).toBeNull()
  })

  it('rejects a tour with no steps', () => {
    expect(() => nextTourStep(null, 'start', 0)).toThrow(RangeError)
    expect(() => nextTourStep(null, 'start', 1.5)).toThrow(RangeError)
  })
})
