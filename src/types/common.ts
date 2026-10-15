import type { LatLng } from '@/lib/geo'

export type { LatLng }

/** Milliseconds since the Unix epoch (UTC). Date-only fields sit at 00:00 UTC. */
export type Timestamp = number

export type Nation = 'England' | 'Scotland' | 'Wales'

/** UK regions on mainland Great Britain (ITL1, excluding Northern Ireland). */
export type Region =
  | 'North East'
  | 'North West'
  | 'Yorkshire and the Humber'
  | 'East Midlands'
  | 'West Midlands'
  | 'East of England'
  | 'London'
  | 'South East'
  | 'South West'
  | 'Wales'
  | 'Scotland'

/** A real UK town or city used to place synthetic sites, bases and organisations. */
export interface Town extends LatLng {
  name: string
  nation: Nation
  region: Region
  /** Real postcode area for the town centre, e.g. LS for Leeds. */
  postcodeArea: string
  /** How far sites and bases may scatter from the centre, in km. */
  spreadKm: number
  /**
   * Compass bearings (degrees clockwise from north, from → to) that stay on land.
   * Set for coastal towns so nothing is placed in the sea.
   */
  landBearings?: readonly [from: number, to: number]
}

/** A fictional person. */
export interface Contact {
  name: string
  role: string
  /** Ofcom drama-reserved range (07700 900000–900999), never a real number. */
  phone: string
}

export type SectorId =
  | 'medical'
  | 'education'
  | 'hospitality'
  | 'manufacturing'
  | 'aviation'
  | 'warehousing'
  | 'agriculture'
  | 'power'
  | 'telecoms'
