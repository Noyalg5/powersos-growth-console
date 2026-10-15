import type { Timestamp } from '@/types'

/**
 * The moment the synthetic data describes: 09:00 on 14 Oct 2026, London time.
 * Every date is generated relative to this, never to the real clock, so expiries
 * and "last 12 months" stay the same whenever the demo runs.
 */
export const DATA_AS_OF: Timestamp = Date.UTC(2026, 9, 14, 8, 0)
