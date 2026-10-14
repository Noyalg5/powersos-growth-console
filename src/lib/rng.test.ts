import { describe, expect, it } from 'vitest'
import { createRng, DEFAULT_SEED, hashSeed, seedFor } from './rng'

const sample = (n: number, fn: () => number) => Array.from({ length: n }, fn)

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(DEFAULT_SEED)
    const b = createRng(DEFAULT_SEED)
    expect(sample(20, a.next)).toEqual(sample(20, b.next))
  })

  it('locks the default stream, so synthetic data never drifts between releases', () => {
    const rng = createRng(75)
    expect(sample(5, rng.next)).toEqual([
      0.2425106316804886, 0.04455898655578494, 0.8669660727027804, 0.000024772249162197113,
      0.39284360548481345,
    ])
  })

  it('produces different sequences for different seeds', () => {
    expect(sample(5, createRng(1).next)).not.toEqual(sample(5, createRng(2).next))
  })

  it('keeps next() in [0, 1)', () => {
    const values = sample(10_000, createRng(7).next)
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...values)).toBeLessThan(1)
  })
})

describe('int', () => {
  it('stays within inclusive bounds and reaches both ends', () => {
    const rng = createRng(3)
    const values = new Set(sample(2_000, () => rng.int(1, 6)))
    expect([...values].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('rejects bad ranges', () => {
    const rng = createRng(3)
    expect(() => rng.int(5, 1)).toThrow(RangeError)
    expect(() => rng.int(0.5, 2)).toThrow(RangeError)
  })
})

describe('pick, weighted and shuffle', () => {
  it('picks an item from the list', () => {
    const rng = createRng(11)
    const items = ['north', 'south', 'east', 'west'] as const
    for (let i = 0; i < 100; i++) expect(items).toContain(rng.pick(items))
    expect(() => rng.pick([])).toThrow(RangeError)
  })

  it('never picks a zero-weight item and roughly honours weights', () => {
    const rng = createRng(12)
    const counts = { a: 0, b: 0, never: 0 }
    for (let i = 0; i < 10_000; i++) {
      const key = rng.weighted([
        { value: 'a' as const, weight: 3 },
        { value: 'never' as const, weight: 0 },
        { value: 'b' as const, weight: 1 },
      ])
      counts[key]++
    }
    expect(counts.never).toBe(0)
    expect(counts.a / counts.b).toBeGreaterThan(2.7)
    expect(counts.a / counts.b).toBeLessThan(3.3)
  })

  it('rejects unusable weights', () => {
    const rng = createRng(12)
    expect(() => rng.weighted([{ value: 'x', weight: 0 }])).toThrow(RangeError)
    expect(() => rng.weighted([{ value: 'x', weight: -1 }])).toThrow(RangeError)
  })

  it('shuffles into a permutation without touching the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8]
    const out = createRng(5).shuffle(input)
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect([...out].sort((x, y) => x - y)).toEqual(input)
    expect(out).not.toEqual(input)
  })
})

describe('normal', () => {
  it('centres on the mean with roughly the right spread', () => {
    const rng = createRng(21)
    const values = sample(20_000, () => rng.normal(75, 10))
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)
    expect(mean).toBeCloseTo(75, 0)
    expect(sd).toBeGreaterThan(9.5)
    expect(sd).toBeLessThan(10.5)
  })
})

describe('seeds', () => {
  it('hashes names stably', () => {
    expect(hashSeed('network')).toBe(1377339077)
    expect(seedFor('network')).toBe(2051314361)
  })

  it('gives each dataset its own seed', () => {
    expect(seedFor('network')).not.toBe(seedFor('pipeline'))
    expect(seedFor('network', 1)).not.toBe(seedFor('network', 2))
  })
})
