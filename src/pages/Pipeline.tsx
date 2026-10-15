import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/PageHeader'
import { CrmTab } from '@/components/pipeline/CrmTab'
import { EventsPlanner } from '@/components/pipeline/EventsPlanner'
import { ProposalTab } from '@/components/pipeline/ProposalTab'
import { VoiceOfCustomerTab } from '@/components/pipeline/VoiceOfCustomerTab'
import { tabIds } from '@/components/tabIds'
import { TabList, type Tab } from '@/components/Tabs'
import { usePersistentState } from '@/components/usePersistentState'
import {
  customers,
  DATA_AS_OF,
  hadDemo,
  leads,
  leadSites,
  partners,
  responders,
  suppliers,
} from '@/data'
import { DEFAULT_EVENTS } from '@/data/events'
import { FEEDBACK } from '@/data/feedback'
import { BOARD_OPTIONS, NO_MOVES, restoreMoves, SECTOR_TERMS } from '@/data/pipeline'
import { DEFAULT_PROGRESS, FEATURE_REQUESTS } from '@/data/roadmap'
import {
  buildBoard,
  defaultProposalLead,
  moveCard,
  restoreEvents,
  startingCard,
  type PipelineStage,
} from '@/lib/pipeline'
import type { ProposalInput } from '@/lib/proposal'
import { restoreVoc, type VocState } from '@/lib/rice'
import { formatSectionNumber, getSection } from '@/nav'
import { STORAGE_KEYS } from '@/storageKeys'

const section = getSection('pipeline')

// The data never changes once loaded, so all of this is worked out once, when the page opens
const LEADS_BY_ID = new Map(leads.map((l) => [l.id, l]))
const PARTNER_NAMES = new Map(partners.map((p) => [p.id, p.name]))

const VOC_DEFAULTS: VocState = { feedback: [...FEEDBACK], progress: { ...DEFAULT_PROGRESS } }
/** Suggestions when logging feedback: every organisation in the data. */
const ORGANISATIONS = [
  ...new Set([
    ...customers.map((c) => c.name),
    ...leads.map((l) => l.organisation),
    ...responders.map((r) => r.name),
    ...suppliers.map((s) => s.name),
    ...partners.map((p) => p.name),
  ]),
].sort((a, b) => a.localeCompare(b))

const PROPOSAL_INPUTS: Omit<ProposalInput, 'lead' | 'stage' | 'recommendation' | 'downtimeScore'> =
  { sites: leadSites, responders, asOf: DATA_AS_OF }

type TabId = 'crm' | 'voice' | 'proposal' | 'events'

const TABS: Tab<TabId>[] = [
  { id: 'crm', label: 'Early-adopter CRM' },
  { id: 'voice', label: 'Voice of customer → roadmap' },
  { id: 'proposal', label: 'Proposal generator' },
  { id: 'events', label: 'Events planner' },
]

const isTab = (value: string | null): value is TabId => TABS.some((t) => t.id === value)

export default function Pipeline() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = isTab(requested) ? requested : 'crm'
  const ids = tabIds('pipeline', tab)

  const crm = usePersistentState(STORAGE_KEYS.pipelineCrm, NO_MOVES, restoreMoves)
  const voice = usePersistentState(STORAGE_KEYS.pipelineVoice, VOC_DEFAULTS, restoreVoc)
  const events = usePersistentState(STORAGE_KEYS.pipelineEvents, DEFAULT_EVENTS, restoreEvents)

  const board = useMemo(() => buildBoard(leads, crm.value, BOARD_OPTIONS), [crm.value])

  const move = (leadId: string, stage: PipelineStage) => {
    const lead = LEADS_BY_ID.get(leadId)
    if (!lead) return
    crm.set(moveCard(crm.value, leadId, stage, DATA_AS_OF, startingCard(lead, hadDemo(lead))))
  }

  // The proposal opens on the lead in the URL, or the most valuable deal at Proposal
  const requestedLead = params.get('lead')
  const proposalLead =
    board.cards.find((c) => c.lead.id === requestedLead)?.lead.id ??
    defaultProposalLead(board.cards)?.lead.id

  const update = (patch: Record<string, string>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(patch)) next.set(key, value)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <article>
      <div className="print:hidden">
        <PageHeader
          eyebrow={`Section ${formatSectionNumber(section.number)}`}
          title={section.title}
          lead={section.question}
        >
          <p className="mt-4 leading-relaxed text-pretty text-ink-muted">
            Four working tools for winning the first members: a CRM of the early-adopter leads, a
            loop from what organisations tell us to a tested backlog, a one-page proposal for any
            lead, and a plan of industry events. Values come from the pricing sandbox defaults and
            the sector assumptions in Market strategy. Edits are kept in this browser.
          </p>
        </PageHeader>

        <div className="mt-10">
          <TabList
            tabs={TABS}
            selected={tab}
            onSelect={(next) => update({ tab: next })}
            label="Pipeline tools"
            group="pipeline"
            stack
          />
        </div>
      </div>

      <div
        role="tabpanel"
        id={ids.panel}
        aria-labelledby={ids.tab}
        tabIndex={0}
        className="mt-6 focus-visible:outline-offset-4 print:mt-0"
      >
        {tab === 'crm' && (
          <CrmTab
            board={board}
            state={crm}
            partnerNames={PARTNER_NAMES}
            onMove={move}
            asOf={DATA_AS_OF}
          />
        )}
        {tab === 'voice' && (
          <VoiceOfCustomerTab
            state={voice}
            features={FEATURE_REQUESTS}
            defaults={VOC_DEFAULTS}
            organisations={ORGANISATIONS}
            asOf={DATA_AS_OF}
          />
        )}
        {tab === 'proposal' && proposalLead && (
          <ProposalTab
            board={board}
            leadId={proposalLead}
            onSelectLead={(lead) => update({ lead })}
            inputs={PROPOSAL_INPUTS}
            sectorTerms={SECTOR_TERMS}
          />
        )}
        {tab === 'events' && <EventsPlanner state={events} />}
      </div>
    </article>
  )
}
