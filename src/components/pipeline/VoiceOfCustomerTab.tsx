import { useMemo } from 'react'
import { ResetBar } from '@/components/ResetBar'
import { Tag } from '@/components/Tag'
import type { Persisted } from '@/components/usePersistentState'
import { addFeedback, rankFeatures, type FeedbackDraft, type VocState } from '@/lib/rice'
import type { FeatureProgress, FeatureRequest } from '@/types'
import { Backlog } from './Backlog'
import { FeedbackLog } from './FeedbackLog'

interface VoiceOfCustomerTabProps {
  state: Persisted<VocState>
  features: readonly FeatureRequest[]
  defaults: VocState
  organisations: readonly string[]
  asOf: number
}

/** The loop from what organisations say to what gets built and tested. */
export function VoiceOfCustomerTab({
  state,
  features,
  defaults,
  organisations,
  asOf,
}: VoiceOfCustomerTabProps) {
  const { feedback, progress } = state.value
  const ranked = useMemo(
    () => rankFeatures(features, progress, feedback),
    [features, progress, feedback],
  )

  const add = (draft: FeedbackDraft) =>
    state.set({ ...state.value, feedback: addFeedback(feedback, draft) })
  const remove = (id: string) =>
    state.set({ ...state.value, feedback: feedback.filter((f) => f.id !== id) })
  const update = (featureId: string, next: FeatureProgress) =>
    state.set({ ...state.value, progress: { ...progress, [featureId]: next } })

  return (
    <div className="space-y-12">
      <ResetBar
        edited={state.edited}
        saved={state.saved}
        onReset={state.reset}
        what="feedback log, RICE inputs and UAT results"
      >
        <Tag kind="synthetic" />
        <Tag kind="assumption" />
        <span>The quotes are written for the demo; RICE inputs are starting estimates.</span>
      </ResetBar>
      <FeedbackLog
        feedback={feedback}
        onAdd={add}
        onRemove={remove}
        organisations={organisations}
        asOf={asOf}
      />
      <Backlog
        ranked={ranked}
        features={features}
        defaults={defaults.progress}
        onChange={update}
        asOf={asOf}
      />
    </div>
  )
}
