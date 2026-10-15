import type { Contact, Region, Timestamp } from './common'

export type PartnerKind =
  'facilities-management' | 'icp-idno' | 'insurer' | 'consultant' | 'trade-body'

export interface Partner {
  id: string
  name: string
  kind: PartnerKind
  town: string
  region: Region
  /** Organisations referred in the last 12 months. */
  referrals: number
  /** Referrals that became customers. */
  convertedReferrals: number
  since: Timestamp
  contact: Contact
}
