/**
 * Geometry for the guided demo: where to scroll so a highlighted element is in view,
 * and where its callout goes. Pure functions of rectangles, so they are tested
 * without a browser.
 */

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Size {
  width: number
  height: number
}

/** Below this viewport width the callout is a sheet along the bottom of the screen. */
export const SHEET_BELOW_WIDTH = 640
/** Space kept between the callout, the element and the edges of the screen. */
export const TOUR_GAP = 12

export type Placement =
  | { kind: 'sheet' }
  | { kind: 'below' | 'above' | 'right' | 'left' | 'corner'; top: number; left: number }

/**
 * Below the element if the callout fits there, else above it, else beside it (right,
 * then left), else in the bottom corner of the screen. On a narrow screen it is always
 * a bottom sheet. `top` is the space taken by the sticky header, which the callout
 * never covers.
 */
export function placeCallout(
  target: Rect | null,
  callout: Size,
  viewport: Size,
  top = 0,
): Placement {
  if (viewport.width < SHEET_BELOW_WIDTH) return { kind: 'sheet' }
  const maxLeft = viewport.width - callout.width - TOUR_GAP
  const corner = {
    kind: 'corner' as const,
    top: Math.max(top + TOUR_GAP, viewport.height - callout.height - TOUR_GAP),
    left: Math.max(TOUR_GAP, maxLeft),
  }
  if (!target) return corner
  const left = Math.min(Math.max(TOUR_GAP, target.left), Math.max(TOUR_GAP, maxLeft))
  const below = target.top + target.height + TOUR_GAP
  if (below + callout.height <= viewport.height - TOUR_GAP) return { kind: 'below', top: below, left }
  const above = target.top - TOUR_GAP - callout.height
  if (above >= top + TOUR_GAP) return { kind: 'above', top: above, left }
  // Beside a tall element, level with its top but kept on screen
  const level = Math.min(
    Math.max(target.top, top + TOUR_GAP),
    Math.max(top + TOUR_GAP, viewport.height - callout.height - TOUR_GAP),
  )
  const right = target.left + target.width + TOUR_GAP
  if (right + callout.width <= viewport.width - TOUR_GAP) return { kind: 'right', top: level, left: right }
  const leftOf = target.left - TOUR_GAP - callout.width
  if (leftOf >= TOUR_GAP) return { kind: 'left', top: level, left: leftOf }
  return corner
}

/**
 * How far down the page to scroll so the element sits in the space left for it:
 * between the sticky header (`top`) and the callout (`reserve` at the bottom). An
 * element that fits is centred in that space; a taller one starts at its top edge.
 * `target` is measured against the viewport, as `getBoundingClientRect` gives it.
 */
export function scrollTopFor(
  target: Rect,
  scrollY: number,
  viewportHeight: number,
  top = 0,
  reserve = 0,
): number {
  const room = viewportHeight - top - reserve
  const offset = target.height <= room ? top + (room - target.height) / 2 : top + TOUR_GAP
  return Math.max(0, Math.round(scrollY + target.top - offset))
}

/** The highlight drawn around an element, padded and kept on screen. */
export function spotlight(target: Rect, viewport: Size, padding = 6): Rect {
  const top = Math.max(0, target.top - padding)
  const left = Math.max(0, target.left - padding)
  const bottom = Math.min(viewport.height, target.top + target.height + padding)
  const right = Math.min(viewport.width, target.left + target.width + padding)
  return { top, left, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

export type TourAction = 'start' | 'next' | 'back' | 'exit'

/**
 * The step after an action, or null when the tour is over. Next on the last step
 * finishes the tour; Back on the first stays put.
 */
export function nextTourStep(step: number | null, action: TourAction, count: number): number | null {
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`A tour needs at least one step, got ${count}`)
  }
  switch (action) {
    case 'start':
      return 0
    case 'exit':
      return null
    case 'next':
      return step === null || step >= count - 1 ? null : step + 1
    case 'back':
      return step === null ? null : Math.max(0, step - 1)
  }
}
