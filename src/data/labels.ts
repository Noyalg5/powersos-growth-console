import type {
  AuthorisationLevel,
  EquipmentKind,
  EventCategory,
  EventObjective,
  EventStatus,
  FaultType,
  LeadSource,
  LeadStage,
  PartnerKind,
  SeededIssueKind,
  SeededOnboardingIssueKind,
  SupplierCategory,
  ThemeId,
} from '@/types'

/** Display names for the coded values in the synthetic data. */

export const FAULT_LABELS: Record<FaultType, string> = {
  cable: 'Cable fault',
  rmu: 'RMU fault',
  transformer: 'Transformer fault',
  'switchgear-trip': 'Switchgear trip',
  protection: 'Protection operation',
  'earth-fault': 'Earth fault',
  generator: 'Generator failure',
  'loss-of-supply': 'Loss of supply',
}

export const EQUIPMENT_LABELS: Record<EquipmentKind, string> = {
  rmu: '11 kV RMU',
  transformer: 'Transformer',
  switchgear: 'HV switchboard',
  generator: 'Standby generator',
}

export const AUTHORISATION_LABELS: Record<AuthorisationLevel, string> = {
  'authorised-person': 'Authorised person',
  'senior-authorised-person': 'Senior authorised person',
}

export const SUPPLIER_CATEGORY_LABELS: Record<SupplierCategory, string> = {
  transformers: 'Transformers',
  switchgear: 'Switchgear',
  'generator-hire': 'Generator hire',
  'cable-jointing': 'Cable & jointing',
  fuel: 'Fuel',
}

export const PARTNER_KIND_LABELS: Record<PartnerKind, string> = {
  'facilities-management': 'Facilities management',
  'icp-idno': 'ICP / IDNO',
  insurer: 'Insurer',
  consultant: 'Electrical consultant',
  'trade-body': 'Trade body',
}

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  'wait-list': 'Wait-list',
  contacted: 'Contacted',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  lost: 'Lost',
}

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  'partner-referral': 'Partner referral',
  'trade-show': 'Trade show',
  inbound: 'Inbound',
  outbound: 'Outbound',
}

export const SEEDED_ISSUE_LABELS: Record<SeededIssueKind, string> = {
  'duplicate-site': 'Duplicate site',
  'missing-postcode': 'Missing postcode',
  'missing-authorisation-expiry': 'Missing authorisation expiry',
  'orphaned-call-out': 'Call-out for a deleted site',
}

export const SEEDED_ONBOARDING_ISSUE_LABELS: Record<SeededOnboardingIssueKind, string> = {
  'stage-behind-dates': 'Stage behind its dates',
  'live-with-open-item': 'Live with checklist open',
  'future-dated-item': 'Checklist item dated ahead',
  'stale-onboarding': 'Stale onboarding',
  'on-call-after-lapse': 'On call after paperwork lapsed',
}

export const THEME_LABELS: Record<ThemeId, string> = {
  'eta-updates': 'ETA updates',
  'site-data': 'Site and equipment data',
  'cost-control': 'Cost control',
  'compliance-evidence': 'Compliance evidence',
  'remote-cover': 'Remote-site cover',
  'responder-payments': 'Responder payments',
  'parts-sourcing': 'Parts and hire',
  'safety-documents': 'Safety documents',
  integrations: 'Helpdesk integration',
  'partner-referrals': 'Partner referrals',
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  'hv-electrical': 'HV & electrical engineering',
  facilities: 'Facilities management',
  'data-centres': 'Data centres',
  'healthcare-estates': 'Healthcare estates',
  manufacturing: 'Manufacturing',
}

export const EVENT_OBJECTIVE_LABELS: Record<EventObjective, string> = {
  leads: 'Leads',
  'responder-recruitment': 'Responder recruitment',
  'partner-meetings': 'Partner meetings',
}

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  idea: 'Idea',
  researching: 'Researching',
  booked: 'Booked',
  attended: 'Attended',
  'not-going': 'Not going',
}
