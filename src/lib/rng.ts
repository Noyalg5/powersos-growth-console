/**
 * Seeded pseudo-random numbers for synthetic data.
 *
 * Every dataset in the console is generated from a fixed seed, so the demo is
 * identical on every load. Never use Math.random() for data.
 */

/** Base seed for all synthetic data. 75 nods to the 75-minute response target. */
export const DEFAULT_SEED = 75

export interface Weighted<T> {
  value: T
  weight: number
}

export interface Rng {
  /** Float in [0, 1). */
  next(): number
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number
  /** Float in [min, max). */
  float(min: number, max: number): number
  /** True with probability p. */
  chance(p: number): boolean
  /** One item, chosen uniformly. */
  pick<T>(items: readonly T[]): T
  /** One item, chosen in proportion to its weight. */
  weighted<T>(items: readonly Weighted<T>[]): T
  /** Normally distributed value. */
  normal(mean: number, sd: number): number
  /** A new array in random order; the input is left untouched. */
  shuffle<T>(items: readonly T[]): T[]
}

/** 32-bit FNV-1a hash, used to turn a name into a seed. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/**
 * Stable seed for one named dataset. Each dataset gets its own stream, so
 * changing one section's generator never reshuffles another section's data.
 */
export function seedFor(dataset: string, base: number = DEFAULT_SEED): number {
  return hashSeed(`${base}:${dataset}`)
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0

  // mulberry32: small, fast and plenty for illustrative data
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const int = (min: number, max: number): number => {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`int() needs integers with min <= max, got ${min} and ${max}`)
    }
    return min + Math.floor(next() * (max - min + 1))
  }

  return {
    next,
    int,

    float(min, max) {
      return min + next() * (max - min)
    },

    chance(p) {
      return next() < p
    },

    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new RangeError('pick() needs at least one item')
      return items[int(0, items.length - 1)] as T
    },

    weighted<T>(items: readonly Weighted<T>[]): T {
      let total = 0
      for (const item of items) {
        if (!Number.isFinite(item.weight) || item.weight < 0) {
          throw new RangeError(`weighted() needs finite, non-negative weights, got ${item.weight}`)
        }
        total += item.weight
      }
      if (total <= 0) throw new RangeError('weighted() needs at least one positive weight')

      let remaining = next() * total
      let last: Weighted<T> | undefined
      for (const item of items) {
        if (item.weight === 0) continue
        last = item
        remaining -= item.weight
        if (remaining < 0) return item.value
      }
      // Only reached through floating-point rounding on the final item
      return (last as Weighted<T>).value
    },

    normal(mean, sd) {
      // Box–Muller. 1 - next() keeps u1 in (0, 1] so log() stays finite.
      const u1 = 1 - next()
      const u2 = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    },

    shuffle<T>(items: readonly T[]): T[] {
      // Fisher–Yates on a copy
      const out = [...items]
      for (let i = out.length - 1; i > 0; i--) {
        const j = int(0, i)
        ;[out[i], out[j]] = [out[j] as T, out[i] as T]
      }
      return out
    },
  }
}
