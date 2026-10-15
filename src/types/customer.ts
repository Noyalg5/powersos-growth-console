import type { Contact, LatLng, Region, SectorId, Timestamp } from './common'

export type Insulation = 'vacuum' | 'SF6' | 'oil'

interface EquipmentBase {
  /** `<siteId>-E<n>`. */
  id: string
  installedYear: number
}

/** 11 kV ring main unit. */
export interface RingMainUnit extends EquipmentBase {
  kind: 'rmu'
  voltageKv: 11
  insulation: Insulation
}

export interface Transformer extends EquipmentBase {
  kind: 'transformer'
  ratingKva: number
  /** Primary/secondary, e.g. 11/0.433 kV. */
  voltage: '11/0.433 kV'
  cooling: 'oil' | 'dry'
}

/** HV switchboard. */
export interface Switchgear extends EquipmentBase {
  kind: 'switchgear'
  voltageKv: 11
  panels: number
  insulation: Insulation
}

export interface StandbyGenerator extends EquipmentBase {
  kind: 'generator'
  ratingKva: number
  fuel: 'diesel' | 'HVO' | 'gas'
}

export type Equipment = RingMainUnit | Transformer | Switchgear | StandbyGenerator
export type EquipmentKind = Equipment['kind']

/** 1 = little impact if supply is lost, 5 = life safety or critical infrastructure. */
export type Criticality = 1 | 2 | 3 | 4 | 5

export interface Site extends LatLng {
  id: string
  customerId: string
  name: string
  /** Nearest anchor town. */
  town: string
  region: Region
  /** Postcode area, e.g. LS. Null when missing from the customer's records. */
  postcodeArea: string | null
  criticality: Criticality
  equipment: Equipment[]
  /** Who to call in an emergency, in order. */
  contacts: Contact[]
}

export interface Customer {
  id: string
  name: string
  sector: SectorId
  /** Town of the head office. */
  headOffice: string
  joinedAt: Timestamp
  sites: Site[]
}
