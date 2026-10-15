import type { Timestamp } from './common'

export type FaultType =
  | 'cable'
  | 'rmu'
  | 'transformer'
  | 'switchgear-trip'
  | 'protection'
  | 'earth-fault'
  | 'generator'
  | 'loss-of-supply'

/** Pounds, as invoiced. */
export interface CostBreakdown {
  callOutFee: number
  labour: number
  parts: number
  generatorHire: number
}

export interface CallOut {
  id: string
  siteId: string
  customerId: string
  responderId: string
  faultType: FaultType
  requestedAt: Timestamp
  acceptedAt: Timestamp
  arrivedAt: Timestamp
  resolvedAt: Timestamp
  /** Straight-line distance from the responder's base, in miles. */
  distanceMiles: number
  cost: CostBreakdown
  /** Customer rating, 1–5. */
  rating: number
}
