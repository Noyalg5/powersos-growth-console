import type { SideId } from '@/lib/scenario'
import type { Timestamp } from './common'

/** What a piece of feedback is about. Themes roll up into feature requests. */
export type ThemeId =
  | 'eta-updates'
  | 'site-data'
  | 'cost-control'
  | 'compliance-evidence'
  | 'remote-cover'
  | 'responder-payments'
  | 'parts-sourcing'
  | 'safety-documents'
  | 'integrations'
  | 'partner-referrals'

/** Something an organisation told us, in its own words. */
export interface FeedbackEntry {
  /** `FB-001` for the seeded log; `FB-U<n>` for entries logged in the browser. */
  id: string
  organisation: string
  side: SideId
  quote: string
  theme: ThemeId
  /** The day it was said, 00:00 UTC. */
  date: Timestamp
}

/** RICE inputs: reach × impact × confidence ÷ effort. */
export interface RiceInputs {
  /** Organisations affected in a quarter. */
  reach: number
  /** 0.25 minimal, 0.5 low, 1 medium, 2 high, 3 massive. */
  impact: number
  /** 0–1. */
  confidence: number
  /** Person-months. */
  effort: number
}

export type UatStatus = 'not-started' | 'in-test' | 'passed' | 'failed'

export interface AcceptanceCriterion {
  given: string
  when: string
  then: string
}

/** "As a … I want … so that …", with the criteria UAT tests it against. */
export interface UserStory {
  /** `PS-101`. */
  id: string
  asA: string
  iWant: string
  soThat: string
  criteria: AcceptanceCriterion[]
}

export interface FeatureRequest {
  id: string
  title: string
  /** The feedback themes it answers. */
  themes: ThemeId[]
  story: UserStory
}

/** What can change on the backlog in the browser: the RICE inputs and the UAT result. */
export interface FeatureProgress {
  rice: RiceInputs
  uat: UatStatus
  testNote: string
}

export type EventCategory =
  'hv-electrical' | 'facilities' | 'data-centres' | 'healthcare-estates' | 'manufacturing'
export type EventObjective = 'leads' | 'responder-recruitment' | 'partner-meetings'
export type EventStatus = 'idea' | 'researching' | 'booked' | 'attended' | 'not-going'

/** A kind of UK industry event worth attending, with the details still to confirm. */
export interface EventPlan {
  id: string
  category: EventCategory
  /** The kind of event, e.g. "Facilities management trade exhibition". */
  type: string
  sides: SideId[]
  objective: EventObjective
  /** Pounds: stand or ticket, travel and materials. */
  budget: number
  status: EventStatus
  /** Left blank until checked against the organiser's own listing. */
  name: string
  date: string
  /** True once the name and date have been checked against the organiser. */
  verified: boolean
}
