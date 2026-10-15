import { useState } from 'react'
import { canStore, isEdited, readSaved, writeSaved, type KeyValueStore } from '@/lib/storage'

/** The browser's storage, or null where even asking for it throws (blocked site data). */
function browserStorage(): KeyValueStore | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export interface Persisted<T> {
  value: T
  set: (next: T) => void
  reset: () => void
  /** The value differs from the defaults. */
  edited: boolean
  /** Edits are being saved; false when storage is blocked and they last only for this visit. */
  saved: boolean
}

/**
 * State saved in this browser under `key`, written as each edit is made. `restore`
 * checks whatever was saved before it is used.
 */
export function usePersistentState<T>(
  key: string,
  defaults: T,
  restore: (raw: unknown, defaults: T) => T,
): Persisted<T> {
  const [state, setState] = useState(() => {
    const store = browserStorage()
    return { value: readSaved(store, key, defaults, restore), saved: canStore(store) }
  })

  const set = (value: T) =>
    setState({ value, saved: writeSaved(browserStorage(), key, value, defaults) })

  return {
    value: state.value,
    set,
    reset: () => set(defaults),
    edited: isEdited(state.value, defaults),
    saved: state.saved,
  }
}

/**
 * Another tool's saved edits, read once when the page opens and never written: the
 * Overview reads the sector weights and card moves this way.
 */
export function useSaved<T>(
  key: string,
  defaults: T,
  restore: (raw: unknown, defaults: T) => T,
): { value: T; edited: boolean } {
  const [value] = useState(() => readSaved(browserStorage(), key, defaults, restore))
  return { value, edited: isEdited(value, defaults) }
}
