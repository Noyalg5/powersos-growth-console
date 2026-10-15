/**
 * The guided demo: eight stops across the console, in the order of the interview demo
 * script in the README. Each stop opens a page, highlights one element and shows a
 * callout of a sentence or two that can be read aloud.
 */

/** Elements the demo can highlight. Mark one with `{...demoTarget('…')}`. */
export type DemoTargetId =
  | 'overview'
  | 'simulator'
  | 'recruitment'
  | 'excluded-responder'
  | 'data-quality'
  | 'go-first'
  | 'break-even'
  | 'proposal'

/** Marks an element for the demo to highlight. */
export function demoTarget(id: DemoTargetId): { 'data-demo': DemoTargetId } {
  return { 'data-demo': id }
}

/** Sent with a step's navigation as router state: the page acts on it, e.g. starts playing. */
export type DemoCue = 'play'

export interface DemoStep {
  /** The page and query to open. */
  to: string
  target: DemoTargetId
  cue?: DemoCue
  title: string
  body: string
}

export const DEMO_STEPS: readonly DemoStep[] = [
  {
    to: '/',
    target: 'overview',
    title: 'The console on one screen',
    body: 'Every figure here is worked out live by the same models as the section pages: how healthy the network is, where the gaps are, which sectors to win first and what the pipeline is worth.',
  },
  {
    to: '/simulator?scenario=data-centre',
    target: 'simulator',
    cue: 'play',
    title: 'One emergency, four sides',
    body: 'A data centre trips at 02:00. The simulator plays the request, the match, the cost approval and the repair as the customer, responder, partner and supplier each see them, against the 75-minute target.',
  },
  {
    to: '/network',
    target: 'recruitment',
    title: 'Where to recruit next',
    body: 'Each pick is the town where one new responder would cover the most critical sites that are thin or uncovered today. That is the brief for the next recruitment campaign.',
  },
  {
    to: '/onboarding',
    target: 'excluded-responder',
    title: 'Compliance keeps matching honest',
    body: 'This responder fails the same eligibility rule the simulator uses, so they are offered no jobs until their paperwork is put right. Anything due to run out in the next 90 days is flagged before it bites.',
  },
  {
    to: '/onboarding',
    target: 'data-quality',
    title: 'Data you can dispatch on',
    body: 'A three-click request only works if the site and equipment records behind it are right. Rule-based checks score every dataset and give each issue a fix.',
  },
  {
    to: '/market?tab=sectors',
    target: 'go-first',
    title: 'Which sector to win first',
    body: 'Nine sectors scored on weighted criteria and placed on attractiveness against ability to win. The recommendation updates as the weights change, and a check shows whether it holds.',
  },
  {
    to: '/market?tab=pricing',
    target: 'break-even',
    title: 'Does membership pay for itself?',
    body: "Each tier against paying for ad hoc call-outs at today's rates: the number of call-outs a year at which a member starts saving. Change a price and the case updates.",
  },
  {
    to: '/pipeline?tab=proposal',
    target: 'proposal',
    title: 'From lead to proposal',
    body: "Pick any lead for a one-page proposal: its sites and today's cover, the cost of downtime against membership, the tier to offer and an onboarding plan. It prints on a single A4 page.",
  },
]
