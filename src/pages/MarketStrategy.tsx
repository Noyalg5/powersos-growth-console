import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { AlternativesTab } from '@/components/market/AlternativesTab'
import { PricingSandbox, type PricingSources } from '@/components/market/PricingSandbox'
import { SectorPrioritisation } from '@/components/market/SectorPrioritisation'
import { PageHeader } from '@/components/PageHeader'
import { tabIds } from '@/components/tabIds'
import { TabList, type Tab } from '@/components/Tabs'
import { usePersistentState } from '@/components/usePersistentState'
import { customers, DATA_AS_OF, SECTORS } from '@/data'
import {
  CALL_OUT_RATE,
  CALL_OUTS_AT_SITES,
  CHURN,
  JOB_COSTS,
  MEMBERSHIP,
  PRICING_DEFAULTS,
  PRICING_EVIDENCE,
  SECTOR_EVIDENCE,
} from '@/data/evidence'
import { formatDate, formatGBP, formatNumber, formatPercent } from '@/lib/format'
import { DEFAULT_ALTERNATIVES_INPUTS, restoreAlternativesInputs } from '@/lib/positioning'
import { DEFAULT_TIERS, restorePricingInputs } from '@/lib/pricing'
import {
  DEFAULT_SECTOR_INPUTS,
  goFirst,
  hasWeight,
  rankSectors,
  restoreSectorInputs,
} from '@/lib/sectorScoring'
import { formatSectionNumber, getSection } from '@/nav'
import { STORAGE_KEYS } from '@/storageKeys'

const section = getSection('market')

const asOf = formatDate(DATA_AS_OF)
const callOutCount = (n: number) => `${formatNumber(n)} ${n === 1 ? 'call-out' : 'call-outs'}`
const missingSites =
  CALL_OUTS_AT_SITES.unmatched.length === 0
    ? ''
    : ` ${callOutCount(CALL_OUTS_AT_SITES.unmatched.length)} whose site is missing from the records ${CALL_OUTS_AT_SITES.unmatched.length === 1 ? 'is' : 'are'} left out.`

const EVIDENCE_NOTE = `Evidence counts the ${formatNumber(CALL_OUT_RATE.sites)} sites on record; call-outs per site a year are over the 12 months to ${asOf}, counting each site only while its customer was a member.${missingSites}`

const SOURCES: PricingSources = {
  customers: `${formatNumber(MEMBERSHIP.live)} customers are live today in the synthetic data; splitting them ${DEFAULT_TIERS.map((t) => formatPercent(t.share)).join(' / ')} across the tiers is an assumption.`,
  callOutsPerSite: `${formatNumber(PRICING_EVIDENCE.callOutsPerSite, 2)}: ${callOutCount(CALL_OUT_RATE.callOuts)} over ${formatNumber(CALL_OUT_RATE.siteYears)} site-years of membership in the 12 months to ${asOf}.`,
  adHocCost: `average attendance and labour across ${callOutCount(JOB_COSTS.jobs)}, ${formatGBP(JOB_COSTS.response)}, at the responders' own rates. Parts and hire are paid either way, so they are left out.`,
  materialsPerCallOut: `average parts and generator hire across the same call-outs, ${formatGBP(JOB_COSTS.materials)}.`,
  sitesPerCustomer: `${formatNumber(CALL_OUT_RATE.sites)} sites across ${formatNumber(customers.length)} customers.`,
  newCustomers: `${formatNumber(MEMBERSHIP.joinedLastYear)} customers went live in the 12 months to ${asOf}.`,
  monthlyChurn: `${formatPercent(PRICING_EVIDENCE.monthlyChurn, 2)}: ${formatNumber(CHURN.cancellations)} cancellations in ${formatNumber(CHURN.memberMonths)} member-months.`,
}

type TabId = 'sectors' | 'alternatives' | 'pricing'

const TABS: Tab<TabId>[] = [
  { id: 'sectors', label: 'Sector prioritisation' },
  { id: 'alternatives', label: 'Alternatives & positioning' },
  { id: 'pricing', label: 'Pricing sandbox' },
]

const isTab = (value: string | null): value is TabId => TABS.some((t) => t.id === value)

export default function MarketStrategy() {
  const [params, setParams] = useSearchParams()
  const requested = params.get('tab')
  const tab: TabId = isTab(requested) ? requested : 'sectors'
  const ids = tabIds('market', tab)

  const sectorState = usePersistentState(
    STORAGE_KEYS.marketSectors,
    DEFAULT_SECTOR_INPUTS,
    restoreSectorInputs,
  )
  const alternativesState = usePersistentState(
    STORAGE_KEYS.marketAlternatives,
    DEFAULT_ALTERNATIVES_INPUTS,
    restoreAlternativesInputs,
  )
  const pricingState = usePersistentState(
    STORAGE_KEYS.marketPricing,
    PRICING_DEFAULTS,
    restorePricingInputs,
  )

  const { weights, scores } = sectorState.value
  const ranked = useMemo(
    () => (hasWeight(weights) ? rankSectors(SECTORS, scores, weights) : null),
    [scores, weights],
  )
  const pick = useMemo(() => (ranked ? goFirst(ranked, SECTOR_EVIDENCE) : null), [ranked])

  return (
    <article>
      <PageHeader
        eyebrow={`Section ${formatSectionNumber(section.number)}`}
        title={section.title}
        lead={section.question}
      >
        <p className="mt-4 leading-relaxed text-pretty text-ink-muted">
          Three working tools for deciding where to sell first: score the nine target sectors, set
          PowerSOS against what organisations do today, and test membership pricing. The scores,
          ratings and prices are assumptions to challenge, not findings. Wherever the synthetic
          network can supply a default, it does, and says where it came from. Edits are kept in this
          browser.
        </p>
      </PageHeader>

      <div className="mt-10">
        <TabList
          tabs={TABS}
          selected={tab}
          onSelect={(next) => setParams({ tab: next }, { replace: true, preventScrollReset: true })}
          label="Market strategy tools"
          group="market"
        />
      </div>

      <div
        role="tabpanel"
        id={ids.panel}
        aria-labelledby={ids.tab}
        tabIndex={0}
        className="mt-6 focus-visible:outline-offset-4"
      >
        {tab === 'sectors' && (
          <SectorPrioritisation
            sectors={SECTORS}
            state={sectorState}
            ranked={ranked}
            pick={pick}
            evidence={SECTOR_EVIDENCE}
            evidenceNote={EVIDENCE_NOTE}
            asOf={DATA_AS_OF}
          />
        )}
        {tab === 'alternatives' && (
          <AlternativesTab
            state={alternativesState}
            topSector={pick ? { id: pick.sector, label: pick.label } : null}
          />
        )}
        {tab === 'pricing' && (
          <PricingSandbox
            state={pricingState}
            defaults={PRICING_DEFAULTS}
            sources={SOURCES}
            asOf={DATA_AS_OF}
          />
        )}
      </div>
    </article>
  )
}
