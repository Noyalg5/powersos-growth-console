/**
 * Edits saved in the browser. Storage can be missing or refuse to work (private
 * browsing, blocked site data, a full quota), so every read and write is guarded:
 * a read falls back to the defaults and a write reports whether it worked. The page
 * carries on either way; edits then last until the viewer leaves.
 */

export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** The saved value, checked by `restore`, or the defaults if there is none or it can't be read. */
export function readSaved<T>(
  store: KeyValueStore | null,
  key: string,
  defaults: T,
  restore: (raw: unknown, defaults: T) => T,
): T {
  if (!store) return defaults
  try {
    const text = store.getItem(key)
    return text === null ? defaults : restore(JSON.parse(text), defaults)
  } catch {
    return defaults
  }
}

/**
 * Saves the value, or clears the key when it matches the defaults, so a later change
 * to the defaults reaches viewers who never edited them. False if storage refused.
 */
export function writeSaved<T>(
  store: KeyValueStore | null,
  key: string,
  value: T,
  defaults: T,
): boolean {
  if (!store) return false
  try {
    const text = JSON.stringify(value)
    if (text === JSON.stringify(defaults)) store.removeItem(key)
    else store.setItem(key, text)
    return true
  } catch {
    return false
  }
}

const PROBE = 'pgc-storage-probe'

/** Whether storage takes a write at all: false when it is missing, blocked or full. */
export function canStore(store: KeyValueStore | null): boolean {
  if (!store) return false
  try {
    store.setItem(PROBE, PROBE)
    store.removeItem(PROBE)
    return true
  } catch {
    return false
  }
}

/** True when the value differs from the defaults. */
export function isEdited<T>(value: T, defaults: T): boolean {
  return value !== defaults && JSON.stringify(value) !== JSON.stringify(defaults)
}
