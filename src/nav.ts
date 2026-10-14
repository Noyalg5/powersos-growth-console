/**
 * Single source of truth for the console's pages. The sidebar, router, header
 * and placeholder pages all read from here.
 */

export type SectionId = 'simulator' | 'network' | 'onboarding' | 'market' | 'pipeline'

export interface PlannedModule {
  title: string
  description: string
}

export interface Section {
  id: SectionId
  number: number
  path: string
  title: string
  /** The business development question the section answers. */
  question: string
  summary: string
  modules: PlannedModule[]
}

export const APP_NAME = 'PowerSOS Growth Console'

export const overview = { path: '/', title: 'Overview' } as const

export const sections: readonly Section[] = [
  {
    id: 'simulator',
    number: 1,
    path: '/simulator',
    title: 'Ecosystem simulator',
    question: 'What does one emergency look like from all four sides?',
    summary:
      'A single HV fault played out from the first click to a closed job, showing what the customer, responder, partner and supplier each see and do at every step.',
    modules: [
      {
        title: 'Incident timeline',
        description:
          'Request, match, dispatch, on site, restored, closed: each step timed against the 75-minute target.',
      },
      {
        title: 'Four-lane view',
        description:
          'Parallel lanes for customer, responder, partner and supplier, so hand-offs and waiting time are visible.',
      },
      {
        title: 'Responder matching',
        description:
          'How rating, ETA and distance trade off when the customer chooses who to send.',
      },
      {
        title: 'Cost and approval',
        description:
          'Cost prediction, approval and live spend for the job, as the customer would track it.',
      },
    ],
  },
  {
    id: 'network',
    number: 2,
    path: '/network',
    title: 'Network health',
    question:
      'Is there enough responder supply, in the right places, to keep the 75-minute promise?',
    summary:
      'Coverage and marketplace liquidity across mainland UK: where demand sits, where authorised responders are, and where the gaps are.',
    modules: [
      {
        title: 'Coverage map',
        description:
          'Customer sites and responder bases on an OpenStreetMap base, with estimated 75-minute reach.',
      },
      {
        title: 'Liquidity KPIs',
        description:
          'Fill rate, time to match, responders per site and utilisation: the health of both sides at once.',
      },
      {
        title: 'Gaps and hotspots',
        description:
          'Regions where demand outruns authorised responders, ranked by risk to the response target.',
      },
      {
        title: 'Trends',
        description:
          'Week-by-week movement, so recruitment and sales effort can be aimed and then checked.',
      },
    ],
  },
  {
    id: 'onboarding',
    number: 3,
    path: '/onboarding',
    title: 'Onboarding & compliance',
    question:
      'Where do organisations and engineers drop out, and is everyone on the platform still compliant?',
    summary:
      'Funnels for every side of the ecosystem, plus the checks that keep the network trustworthy: responder authorisation and site data quality.',
    modules: [
      {
        title: 'Funnels per side',
        description:
          'Wait-list to active for customers, partners, responders and suppliers, with drop-off at each stage.',
      },
      {
        title: 'Responder authorisation',
        description:
          'HV authorisation, audit and competence status, with expiries due in the next 90 days.',
      },
      {
        title: 'Data-quality checks',
        description:
          'Completeness of pre-loaded site and equipment information, which is what makes a three-click request possible.',
      },
      {
        title: 'Action queue',
        description: 'The next onboarding or compliance task for each account, in priority order.',
      },
    ],
  },
  {
    id: 'market',
    number: 4,
    path: '/market',
    title: 'Market strategy',
    question: 'Which sectors should we win first, against what, and at what price?',
    summary:
      'Prioritisation across the target sectors, the alternatives organisations rely on today, and a sandbox for testing membership pricing.',
    modules: [
      {
        title: 'Sector prioritisation',
        description:
          'The nine target sectors scored on HV dependency, cost of downtime and how easily they can be reached.',
      },
      {
        title: 'Alternatives',
        description:
          'What organisations do today, from in-house authorised persons to contractor retainers and ad hoc call-outs, and how a membership compares.',
      },
      {
        title: 'Pricing sandbox',
        description:
          'Illustrative membership tiers with unlimited call-outs and early-adopter discounts, tested against margin and take-up.',
      },
    ],
  },
  {
    id: 'pipeline',
    number: 5,
    path: '/pipeline',
    title: 'Pipeline',
    question: 'Who are the early adopters, what are they asking for, and what do we send them?',
    summary:
      'An early-adopter CRM, a loop from customer conversations into the roadmap, and a generator for tailored proposals.',
    modules: [
      {
        title: 'Early-adopter CRM',
        description: 'Wait-list organisations by sector, number of sites, stage and next step.',
      },
      {
        title: 'Voice of customer → roadmap',
        description:
          'Themes from customer conversations, counted and linked to the roadmap items they support.',
      },
      {
        title: 'Proposal generator',
        description:
          'A tailored membership proposal for a prospect, built from its sites, sector and pricing tier.',
      },
    ],
  },
]

export function getSection(id: SectionId): Section {
  const section = sections.find((s) => s.id === id)
  if (!section) throw new Error(`Unknown section: ${id}`)
  return section
}

export function sectionPath(id: SectionId): string {
  return getSection(id).path
}

/** 1 → "01". */
export function formatSectionNumber(n: number): string {
  return String(n).padStart(2, '0')
}

/** Title of the page at a pathname, or undefined when no page matches. */
export function pageTitleFor(pathname: string): string | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
  if (path === overview.path) return overview.title
  return sections.find((s) => s.path === path)?.title
}
