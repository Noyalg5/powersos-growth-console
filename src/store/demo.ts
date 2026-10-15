import { create } from 'zustand'
import { DEMO_STEPS } from '@/demo'
import { nextTourStep, type TourAction } from '@/lib/tour'

interface DemoState {
  /** The step on screen, or null when the demo is not running. */
  step: number | null
  go: (action: TourAction) => void
}

/** The guided demo moves between pages, so its place is kept here rather than in a page. */
export const useDemoStore = create<DemoState>()((set, get) => ({
  step: null,
  go: (action) => set({ step: nextTourStep(get().step, action, DEMO_STEPS.length) }),
}))
