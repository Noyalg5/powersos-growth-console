import type { Contact, LatLng, Region, SectorId, Timestamp } from './common'
import type { Criticality } from './customer'

export type LeadStage =
  'wait-list' | 'contacted' | 'discovery' | 'proposal' | 'negotiation' | 'lost'

export type LeadSource = 'partner-referral' | 'trade-show' | 'inbound' | 'outbound'

export interface Lead {
  id: string
  organisation: string
  sector: SectorId
  town: string
  region: Region
  stage: LeadStage
  estimatedSites: number
  source: LeadSource
  /** Set when the source is a partner referral. */
  partnerId: string | null
  contact: Contact
  createdAt: Timestamp
  /** Null while the lead is on the wait-list and nobody has been in touch. */
  lastContactAt: Timestamp | null
  notes: string
}

/**
 * A site a lead has told us about. Prospects share their site list before they sign;
 * equipment and emergency contacts are only logged once they are onboarding.
 */
export interface LeadSite extends LatLng {
  /** `<leadId>-S<n>`. */
  id: string
  leadId: string
  name: string
  /** Nearest anchor town. */
  town: string
  region: Region
  criticality: Criticality
}
