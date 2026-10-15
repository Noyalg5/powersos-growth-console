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

/** The footer notice, word for word. Exports carry it too. */
export const NOTICE =
  'Concept prototype by Noyal George for a KTP application. Not affiliated with or endorsed by PowerSOS Ltd or Midlands Power Networks. All data is illustrative.'

export const overview = { path: '/', title: 'Overview' } as const

/**
 * Development-only page for checking the synthetic datasets. Not in the sidebar,
 * and the router leaves it out of production builds.
 */
export const dataExplorer = { path: '/data', title: 'Data explorer' } as const

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
          'Request, match, dispatch, source parts, on site, resolved, review: each step timed against the 75-minute target.',
      },
      {
        title: 'Four-lane view',
        description:
          'Parallel lanes for customer, responder, partner and supplier, so hand-offs and waiting time are visible.',
      },
      {
        title: 'Responder matching',
        description:
          'Candidates scored on ETA, rating, availability and compliance, with every exclusion explained.',
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
          "Customer sites, responder bases and supplier depots on OpenStreetMap, with each site's cover and each responder's estimated 75-minute reach.",
      },
      {
        title: 'Liquidity KPIs',
        description:
          'Sites covered by two or more responders, time to accept, arrivals within target and utilisation: the health of both sides at once.',
      },
      {
        title: 'Gaps and hotspots',
        description:
          'Under-covered sites by town, ranked by criticality, with a recruitment plan and demand against supply by region and hour.',
      },
      {
        title: 'Trends',
        description:
          'Call-outs month by month, so recruitment and sales effort can be aimed and then checked.',
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
      'Funnels for every side of the ecosystem, plus the checks that keep the network trustworthy: responder compliance, data quality and customer retention.',
    modules: [
      {
        title: 'Funnels per side',
        description:
          'Aware to active for customers, responders, suppliers and partners, with conversion, drop-off and days at each stage, and the biggest leak called out.',
      },
      {
        title: 'Onboarding checklists',
        description:
          'Every organisation onboarding now, how far through its checklist it is and the next item it is waiting on.',
      },
      {
        title: 'Responder compliance',
        description:
          'HV authorisation, insurance and audits by expiry, with everyone matching excludes today under the same eligibility rule as the simulator.',
      },
      {
        title: 'Data quality',
        description:
          'Rule-based checks across every dataset, scored by completeness, validity, uniqueness, consistency and timeliness, with a suggested fix for every issue.',
      },
      {
        title: 'Customer retention',
        description:
          'Monthly cohorts of new customers and the share still members in each month after going live.',
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
          'The nine target sectors scored on six weighted criteria and placed on an attractiveness and ability-to-win matrix, with a live recommendation and a check that it survives changes to the weights.',
      },
      {
        title: 'Alternatives & positioning',
        description:
          'In-house authorised persons, maintenance contracts, framework contractors and ad hoc phone searches against PowerSOS on six factors, and a positioning statement for the top sector.',
      },
      {
        title: 'Pricing sandbox',
        description:
          'Illustrative membership tiers, pay-per-call-out pricing and responder payouts, with customer break-even against ad hoc call-outs and a 24-month projection.',
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
      'An early-adopter CRM, a loop from customer conversations to a tested backlog, a generator for tailored proposals and a plan of industry events.',
    modules: [
      {
        title: 'Early-adopter CRM',
        description:
          'Every lead on a board from first contact to live, valued at the pricing defaults and weighted by stage, with conversion by source and the deals that have stalled.',
      },
      {
        title: 'Voice of customer → roadmap',
        description:
          'Feedback from all four sides, tagged by theme and rolled up into feature requests ranked by RICE, each with a user story, acceptance criteria and a UAT result.',
      },
      {
        title: 'Proposal generator',
        description:
          "A one-page proposal for any lead: its sites and today's cover, the cost of downtime against membership, the recommended tier and an onboarding plan, ready to print.",
      },
      {
        title: 'Events planner',
        description:
          'Kinds of UK industry event worth attending, with who each reaches, what it is for and its budget, and every name and date left to verify.',
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
  if (import.meta.env.DEV && path === dataExplorer.path) return dataExplorer.title
  return sections.find((s) => s.path === path)?.title
}
