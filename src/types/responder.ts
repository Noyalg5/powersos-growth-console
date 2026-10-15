import type { Contact, LatLng, Region, Timestamp } from './common'

/**
 * HV authorisation under the contractor's safety rules: an authorised person can
 * switch and issue permits; a senior authorised person can also take control of a
 * network and appoint others.
 */
export type AuthorisationLevel = 'authorised-person' | 'senior-authorised-person'

export interface Availability {
  /** Takes Saturday and Sunday call-outs. */
  weekends: boolean
  /** Takes call-outs between 22:00 and 05:59. */
  overnight: boolean
  /** Engineers on call at any one time. */
  onCallEngineers: number
}

export interface CallOutRates {
  /** Fixed fee per attendance, in pounds. */
  callOutFee: number
  /** Per engineer-hour on site, in pounds. */
  hourlyRate: number
  /** Applied to the fee and hourly rate overnight and at weekends. */
  outOfHoursMultiplier: number
}

export interface Responder extends LatLng {
  id: string
  name: string
  /** Base town; lat/lng is the depot. */
  town: string
  region: Region
  engineers: number
  authorisationLevel: AuthorisationLevel
  /** Highest voltage the team is authorised to work on. */
  maxVoltageKv: 11 | 33
  /** Null when missing from the responder's records. */
  authorisationExpiry: Timestamp | null
  insuranceExpiry: Timestamp
  lastAuditAt: Timestamp
  /** Average customer rating, 1–5. */
  rating: number
  availability: Availability
  rates: CallOutRates
  joinedAt: Timestamp
  contact: Contact
}
