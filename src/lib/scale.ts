/**
 * Axis scales for the console's hand-drawn charts: round tick values that cover the
 * data, so axes read 0 / 20k / 40k rather than 0 / 17,342.
 */

export interface Scale {
  min: number
  max: number
  ticks: number[]
}

/** Round step sizes: 1, 2, 2.5 or 5 times a power of ten. */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * power
}

/**
 * Ticks from at or below `low` to at or above `high`, always including zero, about
 * `count` intervals apart. A flat series at zero gets an axis of 0 to 1.
 */
export function niceScale(low: number, high: number, count = 4): Scale {
  if (!Number.isFinite(low) || !Number.isFinite(high) || low > high) {
    throw new RangeError(`niceScale() needs finite low ≤ high, got ${low} and ${high}`)
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(`count must be a whole number of 1 or more, got ${count}`)
  }
  const from = Math.min(0, low)
  const to = Math.max(0, high)
  if (from === to) return { min: 0, max: 1, ticks: [0, 1] }
  const step = niceStep((to - from) / count)
  const min = Math.floor(from / step) * step
  const max = Math.ceil(to / step) * step
  const ticks: number[] = []
  // Rounded to the step's precision, so 0.1 + 0.2 never shows as 0.30000000000000004
  for (let i = 0; min + i * step <= max + step / 2; i++) {
    ticks.push(Number((min + i * step).toPrecision(12)))
  }
  return { min, max, ticks }
}
