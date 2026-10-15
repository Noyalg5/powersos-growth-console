import type { Timestamp } from './common'
import type { ChecklistItemId } from './onboarding'

export type SeededIssueKind =
  'duplicate-site' | 'missing-postcode' | 'missing-authorisation-expiry' | 'orphaned-call-out'

/** A data-quality problem planted on purpose, so the checks have something to find. */
export interface SeededIssue {
  kind: SeededIssueKind
  dataset: 'sites' | 'responders' | 'callOuts'
  recordId: string
  /** The other record involved: the original of a duplicate, or the deleted site of an orphan. */
  relatedId: string | null
  description: string
}

export type SeededOnboardingIssueKind = SeededOnboardingIssue['kind']

/**
 * A problem planted in the onboarding records, which have their own answer key so the
 * datasets above and their planted issues stay exactly as they are. `recordId` is the
 * record the checks should flag: an onboarding record (ONB-), or the responder whose
 * activity is out of date.
 */
export type SeededOnboardingIssue = {
  recordId: string
  description: string
} & (
  | { kind: 'stage-behind-dates'; dataset: 'onboarding' }
  | { kind: 'live-with-open-item'; dataset: 'onboarding'; item: ChecklistItemId }
  | { kind: 'future-dated-item'; dataset: 'onboarding'; item: ChecklistItemId; doneAt: Timestamp }
  | { kind: 'stale-onboarding'; dataset: 'onboarding'; daysBack: number }
  | { kind: 'on-call-after-lapse'; dataset: 'responders'; lastActiveAt: Timestamp }
)
