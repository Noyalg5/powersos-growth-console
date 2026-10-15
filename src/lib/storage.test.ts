import { describe, expect, it } from 'vitest'
import { canStore, isEdited, readSaved, writeSaved, type KeyValueStore } from './storage'

function memory(
  entries: Record<string, string> = {},
): KeyValueStore & { entries: Record<string, string> } {
  return {
    entries,
    getItem: (key) => entries[key] ?? null,
    setItem: (key, value) => {
      entries[key] = value
    },
    removeItem: (key) => {
      delete entries[key]
    },
  }
}

const blocked: KeyValueStore = {
  getItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
  setItem: () => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  },
  removeItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError')
  },
}

const DEFAULTS = { weight: 5, name: 'Standard' }
/** Keeps a saved weight if it is a number. */
const restore = (raw: unknown, defaults: typeof DEFAULTS) =>
  typeof raw === 'object' &&
  raw !== null &&
  typeof (raw as { weight?: unknown }).weight === 'number'
    ? { ...defaults, weight: (raw as { weight: number }).weight }
    : defaults

describe('readSaved', () => {
  it('restores a saved value', () => {
    const store = memory({ key: '{"weight":8}' })
    expect(readSaved(store, 'key', DEFAULTS, restore)).toEqual({ weight: 8, name: 'Standard' })
  })

  it('falls back to the defaults with nothing saved, no storage, or storage that throws', () => {
    expect(readSaved(memory(), 'key', DEFAULTS, restore)).toBe(DEFAULTS)
    expect(readSaved(null, 'key', DEFAULTS, restore)).toBe(DEFAULTS)
    expect(readSaved(blocked, 'key', DEFAULTS, restore)).toBe(DEFAULTS)
  })

  it('falls back to the defaults when the saved text is not JSON', () => {
    expect(readSaved(memory({ key: '{weight:' }), 'key', DEFAULTS, restore)).toBe(DEFAULTS)
  })

  it('lets restore decide what to keep', () => {
    expect(readSaved(memory({ key: '"weight"' }), 'key', DEFAULTS, restore)).toBe(DEFAULTS)
  })
})

describe('writeSaved', () => {
  it('saves edits as JSON and reports success', () => {
    const store = memory()
    expect(writeSaved(store, 'key', { ...DEFAULTS, weight: 9 }, DEFAULTS)).toBe(true)
    expect(store.entries).toEqual({ key: '{"weight":9,"name":"Standard"}' })
  })

  it('clears the key when the value matches the defaults', () => {
    const store = memory({ key: '{"weight":9}' })
    expect(writeSaved(store, 'key', { ...DEFAULTS }, DEFAULTS)).toBe(true)
    expect(store.entries).toEqual({})
  })

  it('reports failure instead of throwing when storage is missing or refuses', () => {
    expect(writeSaved(null, 'key', DEFAULTS, DEFAULTS)).toBe(false)
    expect(writeSaved(blocked, 'key', { ...DEFAULTS, weight: 1 }, DEFAULTS)).toBe(false)
    expect(writeSaved(blocked, 'key', DEFAULTS, DEFAULTS)).toBe(false)
  })
})

describe('canStore', () => {
  it('probes with a write it removes again', () => {
    const store = memory()
    expect(canStore(store)).toBe(true)
    expect(store.entries).toEqual({})
  })

  it('is false with no storage or storage that refuses', () => {
    expect(canStore(null)).toBe(false)
    expect(canStore(blocked)).toBe(false)
  })
})

describe('isEdited', () => {
  it('compares by value, not by reference', () => {
    expect(isEdited(DEFAULTS, DEFAULTS)).toBe(false)
    expect(isEdited({ ...DEFAULTS }, DEFAULTS)).toBe(false)
    expect(isEdited({ ...DEFAULTS, weight: 6 }, DEFAULTS)).toBe(true)
  })
})
