import type { SideId } from '@/lib/scenario'
import type { Timestamp } from './common'

export type { SideId }

/** The milestones every organisation passes on its way to being live on the platform. */
export type OnboardingStage = 'aware' | 'engaged' | 'signed' | 'onboarded'

export type CustomerChecklistItem =
  | 'sites-added'
  | 'equipment-logged'
  | 'emergency-contacts'
  | 'cost-approval-limits'
  | 'first-test-call-out'

export type ResponderChecklistItem =
  'hv-authorisation' | 'insurance' | 'competence-audit' | 'rates-agreed' | 'app-training'

export type SupplierChecklistItem =
  'catalogue' | 'stock-levels' | 'delivery-slas' | 'regions-served'

export type PartnerChecklistItem = 'agreement-signed' | 'referral-code' | 'co-marketing-pack'

export type ChecklistItemId =
  CustomerChecklistItem | ResponderChecklistItem | SupplierChecklistItem | PartnerChecklistItem

export interface ChecklistEntry {
  item: ChecklistItemId
  /** When it was done, 00:00 UTC; null while outstanding. */
  doneAt: Timestamp | null
}

/** One organisation's journey from first contact to live, and how it has used the platform since. */
export interface OnboardingRecord {
  /** `ONB-001`. */
  id: string
  side: SideId
  /**
   * The organisation: its ID in its own dataset once live (CUS-, RSP-, SUP-, PTN-), the
   * lead's ID for a customer prospect (LEAD-), or the next free ID for any other prospect.
   */
  orgId: string
  name: string
  town: string
  /** Furthest stage reached, as recorded. The dates below are the evidence. */
  stage: OnboardingStage
  /** When each stage was entered, 00:00 UTC; null until it is. */
  entered: Record<OnboardingStage, Timestamp | null>
  /** The side's checklist, in order. Work on it starts once the organisation signs. */
  checklist: ChecklistEntry[]
  /**
   * Last day the organisation used the platform after going live: signed in, took a
   * job, confirmed stock or made a referral, depending on the side. Null before then.
   */
  lastActiveAt: Timestamp | null
  /** When the organisation left: a prospect that dropped out, or a member that cancelled. */
  churnedAt: Timestamp | null
}
