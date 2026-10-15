import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { DataTable, type Column } from '@/components/DataTable'
import { PageHeader } from '@/components/PageHeader'
import { tabIds } from '@/components/tabIds'
import { TabList } from '@/components/Tabs'
import {
  AUTHORISATION_LABELS,
  callOuts,
  customers,
  DATA_AS_OF,
  FAULT_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STAGE_LABELS,
  leads,
  onboarding,
  PARTNER_KIND_LABELS,
  partners,
  responders,
  sectorLabel,
  SEEDED_ISSUE_LABELS,
  SEEDED_ISSUES,
  SEEDED_ONBOARDING_ISSUE_LABELS,
  SEEDED_ONBOARDING_ISSUES,
  sites,
  SUPPLIER_CATEGORY_LABELS,
  suppliers,
  TOWNS,
} from '@/data'
import { formatDate, formatDateTime, formatDuration, formatGBP, formatNumber } from '@/lib/format'
import { checklistLabel, SIDE_LABELS, STEP_LABELS } from '@/lib/onboarding'
import { DEFAULT_SEED } from '@/lib/rng'
import { isOvernight, MINUTE_MS } from '@/lib/time'
import type {
  CallOut,
  Customer,
  Lead,
  OnboardingRecord,
  Partner,
  Responder,
  Site,
  StockItem,
  Supplier,
  Town,
} from '@/types'

// Lookups for joining datasets in the tables
const customerById = new Map(customers.map((c) => [c.id, c]))
const siteById = new Map(sites.map((s) => [s.id, s]))
const responderById = new Map(responders.map((r) => [r.id, r]))
const partnerById = new Map(partners.map((p) => [p.id, p]))
const groupBy = <T,>(items: readonly T[], key: (item: T) => string) => {
  const groups = new Map<string, T[]>()
  for (const item of items) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}
const callOutsByCustomer = groupBy(callOuts, (c) => c.customerId)
const callOutsByResponder = groupBy(callOuts, (c) => c.responderId)
/** Every planted issue, from both answer keys. */
interface PlantedRow {
  label: string
  dataset: string
  recordId: string
  relatedId: string | null
  description: string
}
const plantedRows: PlantedRow[] = [
  ...SEEDED_ISSUES.map((i) => ({ ...i, label: SEEDED_ISSUE_LABELS[i.kind] })),
  ...SEEDED_ONBOARDING_ISSUES.map((i) => ({
    label: SEEDED_ONBOARDING_ISSUE_LABELS[i.kind],
    dataset: i.dataset,
    recordId: i.recordId,
    relatedId: null,
    description: i.description,
  })),
]
const issueByRecord = new Map(plantedRows.map((row) => [row.recordId, row]))

const flagIssue = (id: string) => issueByRecord.get(id)?.label

const Missing = ({ children = 'Missing' }: { children?: ReactNode }) => (
  <span className="font-medium text-accent-ink">{children}</span>
)
const yesNo = (value: boolean) => (value ? 'Yes' : 'No')
const minutesBetween = (from: number, to: number) => (to - from) / MINUTE_MS
const totalCost = ({ cost }: CallOut) =>
  cost.callOutFee + cost.labour + cost.parts + cost.generatorHire

function equipmentSummary(site: Site): string {
  const count = (kind: string) => site.equipment.filter((e) => e.kind === kind).length
  const kva = site.equipment.reduce(
    (sum, e) => (e.kind === 'transformer' ? sum + e.ratingKva : sum),
    0,
  )
  const generator = site.equipment.find((e) => e.kind === 'generator')
  return [
    `${count('rmu')} RMU`,
    count('switchgear') ? 'HV board' : null,
    `${count('transformer')} TX (${formatNumber(kva)} kVA)`,
    generator?.kind === 'generator' ? `Gen ${formatNumber(generator.ratingKva)} kVA` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

const id = <T extends { id: string }>(): Column<T> => ({
  key: 'id',
  header: 'ID',
  sortValue: (row) => row.id,
  render: (row) => <span className="font-mono text-xs text-ink">{row.id}</span>,
})

const date = <T,>(key: string, header: string, get: (row: T) => number | null): Column<T> => ({
  key,
  header,
  sortValue: get,
  render: (row) => {
    const value = get(row)
    return value === null ? <Missing /> : formatDate(value)
  },
})

const money = <T,>(key: string, header: string, get: (row: T) => number): Column<T> => ({
  key,
  header,
  align: 'right',
  sortValue: get,
  render: (row) => formatGBP(get(row)),
})

const townColumns: Column<Town>[] = [
  {
    key: 'name',
    header: 'Town',
    sortValue: (t) => t.name,
    render: (t) => <span className="text-ink">{t.name}</span>,
  },
  { key: 'nation', header: 'Nation', sortValue: (t) => t.nation },
  { key: 'region', header: 'Region', sortValue: (t) => t.region },
  { key: 'postcode', header: 'Postcode area', sortValue: (t) => t.postcodeArea },
  {
    key: 'lat',
    header: 'Lat',
    align: 'right',
    sortValue: (t) => t.lat,
    render: (t) => formatNumber(t.lat, 4),
  },
  {
    key: 'lng',
    header: 'Lng',
    align: 'right',
    sortValue: (t) => t.lng,
    render: (t) => formatNumber(t.lng, 4),
  },
  {
    key: 'spread',
    header: 'Spread',
    align: 'right',
    sortValue: (t) => t.spreadKm,
    render: (t) => `${t.spreadKm} km`,
  },
  {
    key: 'land',
    header: 'Land bearings',
    sortValue: (t) => (t.landBearings ? t.landBearings[0] : null),
    render: (t) => (t.landBearings ? `${t.landBearings[0]}° to ${t.landBearings[1]}°` : 'All'),
  },
  {
    key: 'responders',
    header: 'Responders based',
    align: 'right',
    sortValue: (t) => responders.filter((r) => r.town === t.name).length,
  },
  {
    key: 'sites',
    header: 'Sites',
    align: 'right',
    sortValue: (t) => sites.filter((s) => s.town === t.name).length,
  },
]

const customerColumns: Column<Customer>[] = [
  id(),
  {
    key: 'name',
    header: 'Name',
    sortValue: (c) => c.name,
    render: (c) => <span className="text-ink">{c.name}</span>,
  },
  { key: 'sector', header: 'Sector', sortValue: (c) => sectorLabel(c.sector) },
  { key: 'office', header: 'Head office', sortValue: (c) => c.headOffice },
  { key: 'sites', header: 'Sites', align: 'right', sortValue: (c) => c.sites.length },
  {
    key: 'criticality',
    header: 'Top criticality',
    align: 'right',
    sortValue: (c) => Math.max(...c.sites.map((s) => s.criticality)),
  },
  date('joined', 'Joined', (c) => c.joinedAt),
  {
    key: 'callOuts',
    header: 'Call-outs',
    align: 'right',
    sortValue: (c) => callOutsByCustomer.get(c.id)?.length ?? 0,
  },
  money('spend', 'Spend', (c) =>
    (callOutsByCustomer.get(c.id) ?? []).reduce((s, co) => s + totalCost(co), 0),
  ),
]

const siteColumns: Column<Site>[] = [
  id(),
  {
    key: 'name',
    header: 'Site',
    sortValue: (s) => s.name,
    render: (s) => <span className="text-ink">{s.name}</span>,
  },
  {
    key: 'customer',
    header: 'Customer',
    sortValue: (s) => customerById.get(s.customerId)?.name ?? null,
  },
  { key: 'town', header: 'Town', sortValue: (s) => s.town },
  { key: 'region', header: 'Region', sortValue: (s) => s.region },
  {
    key: 'postcode',
    header: 'Postcode area',
    sortValue: (s) => s.postcodeArea,
    render: (s) => s.postcodeArea ?? <Missing />,
  },
  {
    key: 'lat',
    header: 'Lat',
    align: 'right',
    sortValue: (s) => s.lat,
    render: (s) => formatNumber(s.lat, 4),
  },
  {
    key: 'lng',
    header: 'Lng',
    align: 'right',
    sortValue: (s) => s.lng,
    render: (s) => formatNumber(s.lng, 4),
  },
  { key: 'criticality', header: 'Criticality', align: 'right', sortValue: (s) => s.criticality },
  {
    key: 'equipment',
    header: 'Equipment',
    sortValue: (s) => s.equipment.length,
    render: equipmentSummary,
  },
  {
    key: 'contact',
    header: 'First contact',
    sortValue: (s) => s.contacts[0]?.name ?? null,
    render: (s) =>
      s.contacts[0] && `${s.contacts[0].name} (${s.contacts[0].role}) ${s.contacts[0].phone}`,
  },
]

const responderColumns: Column<Responder>[] = [
  id(),
  {
    key: 'name',
    header: 'Name',
    sortValue: (r) => r.name,
    render: (r) => <span className="text-ink">{r.name}</span>,
  },
  { key: 'town', header: 'Base', sortValue: (r) => r.town },
  {
    key: 'level',
    header: 'Authorisation',
    sortValue: (r) => AUTHORISATION_LABELS[r.authorisationLevel],
  },
  { key: 'kv', header: 'Max kV', align: 'right', sortValue: (r) => r.maxVoltageKv },
  date('authExpiry', 'Authorisation expiry', (r) => r.authorisationExpiry),
  date('insurance', 'Insurance expiry', (r) => r.insuranceExpiry),
  date('audit', 'Last audit', (r) => r.lastAuditAt),
  {
    key: 'rating',
    header: 'Rating',
    align: 'right',
    sortValue: (r) => r.rating,
    render: (r) => formatNumber(r.rating, 1),
  },
  { key: 'engineers', header: 'Engineers', align: 'right', sortValue: (r) => r.engineers },
  {
    key: 'onCall',
    header: 'On call',
    align: 'right',
    sortValue: (r) => r.availability.onCallEngineers,
  },
  { key: 'overnight', header: 'Overnight', sortValue: (r) => yesNo(r.availability.overnight) },
  { key: 'weekends', header: 'Weekends', sortValue: (r) => yesNo(r.availability.weekends) },
  money('fee', 'Call-out fee', (r) => r.rates.callOutFee),
  money('hourly', 'Hourly', (r) => r.rates.hourlyRate),
  {
    key: 'ooh',
    header: 'Out of hours',
    align: 'right',
    sortValue: (r) => r.rates.outOfHoursMultiplier,
    render: (r) => `× ${formatNumber(r.rates.outOfHoursMultiplier, 2)}`,
  },
  date('joined', 'Joined', (r) => r.joinedAt),
  {
    key: 'callOuts',
    header: 'Call-outs',
    align: 'right',
    sortValue: (r) => callOutsByResponder.get(r.id)?.length ?? 0,
  },
]

const supplierColumns: Column<Supplier>[] = [
  id(),
  {
    key: 'name',
    header: 'Name',
    sortValue: (s) => s.name,
    render: (s) => <span className="text-ink">{s.name}</span>,
  },
  { key: 'category', header: 'Category', sortValue: (s) => SUPPLIER_CATEGORY_LABELS[s.category] },
  { key: 'town', header: 'Base', sortValue: (s) => s.town },
  {
    key: 'regions',
    header: 'Regions served',
    sortValue: (s) => s.regionsServed.length,
    render: (s) =>
      s.regionsServed.length === 11 ? 'All mainland regions' : s.regionsServed.join(', '),
    wrap: true,
  },
  { key: 'emergency', header: 'Emergency line', sortValue: (s) => yesNo(s.emergencyLine) },
  { key: 'lines', header: 'Stock lines', align: 'right', sortValue: (s) => s.stock.length },
  {
    key: 'out',
    header: 'Out of stock',
    align: 'right',
    sortValue: (s) => s.stock.filter((i) => i.quantity === 0).length,
  },
  date('joined', 'Joined', (s) => s.joinedAt),
]

type StockRow = StockItem & { key: string; supplier: Supplier }
const stockRows: StockRow[] = suppliers.flatMap((supplier) =>
  supplier.stock.map((item, i) => ({ ...item, key: `${supplier.id}-${i}`, supplier })),
)
const stockColumns: Column<StockRow>[] = [
  { key: 'supplier', header: 'Supplier', sortValue: (r) => r.supplier.name },
  {
    key: 'item',
    header: 'Item',
    sortValue: (r) => r.description,
    render: (r) => <span className="text-ink">{r.description}</span>,
  },
  {
    key: 'quantity',
    header: 'In stock',
    align: 'right',
    sortValue: (r) => r.quantity,
    render: (r) =>
      r.quantity === 0 ? <Missing>None</Missing> : `${formatNumber(r.quantity)} ${r.unit}`,
  },
  {
    key: 'lead',
    header: 'Lead time',
    align: 'right',
    sortValue: (r) => r.leadTimeDays,
    render: (r) => (r.leadTimeDays === 0 ? 'Same day' : `${r.leadTimeDays} days`),
  },
]

const partnerColumns: Column<Partner>[] = [
  id(),
  {
    key: 'name',
    header: 'Name',
    sortValue: (p) => p.name,
    render: (p) => <span className="text-ink">{p.name}</span>,
  },
  { key: 'kind', header: 'Kind', sortValue: (p) => PARTNER_KIND_LABELS[p.kind] },
  { key: 'town', header: 'Town', sortValue: (p) => p.town },
  { key: 'referrals', header: 'Referrals', align: 'right', sortValue: (p) => p.referrals },
  { key: 'converted', header: 'Converted', align: 'right', sortValue: (p) => p.convertedReferrals },
  {
    key: 'leads',
    header: 'Open leads',
    align: 'right',
    sortValue: (p) => leads.filter((l) => l.partnerId === p.id).length,
  },
  date('since', 'Partner since', (p) => p.since),
  {
    key: 'contact',
    header: 'Contact',
    sortValue: (p) => p.contact.name,
    render: (p) => `${p.contact.name} (${p.contact.role})`,
  },
]

const callOutColumns: Column<CallOut>[] = [
  id(),
  {
    key: 'requested',
    header: 'Requested',
    sortValue: (c) => c.requestedAt,
    render: (c) => formatDateTime(c.requestedAt),
  },
  {
    key: 'site',
    header: 'Site',
    sortValue: (c) => siteById.get(c.siteId)?.name ?? null,
    render: (c) => siteById.get(c.siteId)?.name ?? <Missing>Deleted site {c.siteId}</Missing>,
  },
  {
    key: 'customer',
    header: 'Customer',
    sortValue: (c) => customerById.get(c.customerId)?.name ?? null,
  },
  {
    key: 'responder',
    header: 'Responder',
    sortValue: (c) => responderById.get(c.responderId)?.name ?? null,
  },
  { key: 'fault', header: 'Fault', sortValue: (c) => FAULT_LABELS[c.faultType] },
  { key: 'overnight', header: 'Overnight', sortValue: (c) => yesNo(isOvernight(c.requestedAt)) },
  {
    key: 'distance',
    header: 'Distance',
    align: 'right',
    sortValue: (c) => c.distanceMiles,
    render: (c) => `${formatNumber(c.distanceMiles, 1)} mi`,
  },
  {
    key: 'accept',
    header: 'To accept',
    align: 'right',
    sortValue: (c) => minutesBetween(c.requestedAt, c.acceptedAt),
    render: (c) => formatDuration(minutesBetween(c.requestedAt, c.acceptedAt)),
  },
  {
    key: 'arrive',
    header: 'To arrive',
    align: 'right',
    sortValue: (c) => minutesBetween(c.requestedAt, c.arrivedAt),
    render: (c) => formatDuration(minutesBetween(c.requestedAt, c.arrivedAt)),
  },
  {
    key: 'onSite',
    header: 'On site',
    align: 'right',
    sortValue: (c) => minutesBetween(c.arrivedAt, c.resolvedAt),
    render: (c) => formatDuration(minutesBetween(c.arrivedAt, c.resolvedAt)),
  },
  money('fee', 'Call-out fee', (c) => c.cost.callOutFee),
  money('labour', 'Labour', (c) => c.cost.labour),
  money('parts', 'Parts', (c) => c.cost.parts),
  money('hire', 'Generator hire', (c) => c.cost.generatorHire),
  money('total', 'Total', totalCost),
  { key: 'rating', header: 'Rating', align: 'right', sortValue: (c) => c.rating },
]

const leadColumns: Column<Lead>[] = [
  id(),
  {
    key: 'organisation',
    header: 'Organisation',
    sortValue: (l) => l.organisation,
    render: (l) => <span className="text-ink">{l.organisation}</span>,
  },
  { key: 'sector', header: 'Sector', sortValue: (l) => sectorLabel(l.sector) },
  { key: 'town', header: 'Town', sortValue: (l) => l.town },
  { key: 'stage', header: 'Stage', sortValue: (l) => LEAD_STAGE_LABELS[l.stage] },
  { key: 'sites', header: 'Est. sites', align: 'right', sortValue: (l) => l.estimatedSites },
  { key: 'source', header: 'Source', sortValue: (l) => LEAD_SOURCE_LABELS[l.source] },
  {
    key: 'partner',
    header: 'Partner',
    sortValue: (l) => (l.partnerId ? (partnerById.get(l.partnerId)?.name ?? null) : null),
  },
  date('created', 'Created', (l) => l.createdAt),
  {
    key: 'lastContact',
    header: 'Last contact',
    sortValue: (l) => l.lastContactAt,
    render: (l) => (l.lastContactAt === null ? 'Never' : formatDate(l.lastContactAt)),
  },
  {
    key: 'contact',
    header: 'Contact',
    sortValue: (l) => l.contact.name,
    render: (l) => `${l.contact.name} (${l.contact.role})`,
  },
  { key: 'notes', header: 'Notes', sortValue: (l) => l.notes, wrap: true },
]

const onboardingColumns: Column<OnboardingRecord>[] = [
  id(),
  {
    key: 'org',
    header: 'Organisation ID',
    sortValue: (r) => r.orgId,
    render: (r) => <span className="font-mono text-xs">{r.orgId}</span>,
  },
  { key: 'side', header: 'Side', sortValue: (r) => SIDE_LABELS[r.side].one },
  {
    key: 'name',
    header: 'Name',
    sortValue: (r) => r.name,
    render: (r) => <span className="text-ink">{r.name}</span>,
  },
  { key: 'stage', header: 'Stage', sortValue: (r) => STEP_LABELS[r.stage] },
  date('aware', 'Aware', (r) => r.entered.aware),
  {
    key: 'engaged',
    header: 'Demo',
    sortValue: (r) => r.entered.engaged,
    render: (r) => (r.entered.engaged === null ? '–' : formatDate(r.entered.engaged)),
  },
  {
    key: 'signed',
    header: 'Signed',
    sortValue: (r) => r.entered.signed,
    render: (r) => (r.entered.signed === null ? '–' : formatDate(r.entered.signed)),
  },
  {
    key: 'onboarded',
    header: 'Onboarded',
    sortValue: (r) => r.entered.onboarded,
    render: (r) => (r.entered.onboarded === null ? '–' : formatDate(r.entered.onboarded)),
  },
  {
    key: 'checklist',
    header: 'Checklist done',
    sortValue: (r) => r.checklist.filter((e) => e.doneAt !== null).length,
    render: (r) => {
      const open = r.checklist.filter((e) => e.doneAt === null).map((e) => checklistLabel(e.item))
      if (r.entered.signed === null) return '–'
      return open.length === 0 ? 'All done' : `Waiting on ${open.join(', ').toLowerCase()}`
    },
    wrap: true,
  },
  {
    key: 'lastActive',
    header: 'Last active',
    sortValue: (r) => r.lastActiveAt,
    render: (r) => (r.lastActiveAt === null ? '–' : formatDate(r.lastActiveAt)),
  },
  {
    key: 'left',
    header: 'Left',
    sortValue: (r) => r.churnedAt,
    render: (r) => (r.churnedAt === null ? '–' : formatDate(r.churnedAt)),
  },
]

const issueColumns: Column<PlantedRow>[] = [
  {
    key: 'kind',
    header: 'Issue',
    sortValue: (i) => i.label,
    render: (i) => <span className="text-ink">{i.label}</span>,
  },
  { key: 'dataset', header: 'Dataset', sortValue: (i) => i.dataset },
  {
    key: 'record',
    header: 'Record',
    sortValue: (i) => i.recordId,
    render: (i) => <span className="font-mono text-xs">{i.recordId}</span>,
  },
  {
    key: 'related',
    header: 'Related',
    sortValue: (i) => i.relatedId,
    render: (i) => <span className="font-mono text-xs">{i.relatedId ?? '–'}</span>,
  },
  { key: 'description', header: 'Description', sortValue: (i) => i.description, wrap: true },
]

interface Tab {
  id: string
  label: string
  count: number
  note?: string
  content: ReactNode
}

const tabs: Tab[] = [
  {
    id: 'customers',
    label: 'Customers',
    count: customers.length,
    content: (
      <DataTable
        caption="Customers"
        rows={customers}
        columns={customerColumns}
        rowKey={(c) => c.id}
      />
    ),
  },
  {
    id: 'sites',
    label: 'Sites',
    count: sites.length,
    content: (
      <DataTable
        caption="Sites"
        rows={sites}
        columns={siteColumns}
        rowKey={(s) => s.id}
        flag={(s) => flagIssue(s.id)}
      />
    ),
  },
  {
    id: 'responders',
    label: 'Responders',
    count: responders.length,
    content: (
      <DataTable
        caption="Responders"
        rows={responders}
        columns={responderColumns}
        rowKey={(r) => r.id}
        flag={(r) => flagIssue(r.id)}
      />
    ),
  },
  {
    id: 'suppliers',
    label: 'Suppliers',
    count: suppliers.length,
    note: 'Working definition',
    content: (
      <div className="space-y-8">
        <DataTable
          caption="Suppliers"
          rows={suppliers}
          columns={supplierColumns}
          rowKey={(s) => s.id}
        />
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">
            Stock ({formatNumber(stockRows.length)} lines)
          </h3>
          <DataTable
            caption="Supplier stock"
            rows={stockRows}
            columns={stockColumns}
            rowKey={(r) => r.key}
          />
        </div>
      </div>
    ),
  },
  {
    id: 'partners',
    label: 'Partners',
    count: partners.length,
    note: 'Working definition',
    content: (
      <DataTable caption="Partners" rows={partners} columns={partnerColumns} rowKey={(p) => p.id} />
    ),
  },
  {
    id: 'call-outs',
    label: 'Call-outs',
    count: callOuts.length,
    content: (
      <DataTable
        caption="Call-outs"
        rows={callOuts}
        columns={callOutColumns}
        rowKey={(c) => c.id}
        flag={(c) => flagIssue(c.id)}
      />
    ),
  },
  {
    id: 'leads',
    label: 'Leads',
    count: leads.length,
    content: <DataTable caption="Leads" rows={leads} columns={leadColumns} rowKey={(l) => l.id} />,
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    count: onboarding.length,
    content: (
      <DataTable
        caption="Onboarding records"
        rows={onboarding}
        columns={onboardingColumns}
        rowKey={(r) => r.id}
        flag={(r) => flagIssue(r.id)}
      />
    ),
  },
  {
    id: 'towns',
    label: 'Towns',
    count: TOWNS.length,
    note: 'Real places',
    content: (
      <DataTable caption="Anchor towns" rows={TOWNS} columns={townColumns} rowKey={(t) => t.name} />
    ),
  },
  {
    id: 'issues',
    label: 'Seeded issues',
    count: plantedRows.length,
    note: 'Planted on purpose',
    content: (
      <DataTable
        caption="Seeded data-quality issues"
        rows={plantedRows}
        columns={issueColumns}
        rowKey={(i) => i.recordId}
      />
    ),
  },
]

export default function DataExplorer() {
  const [searchParams, setSearchParams] = useSearchParams()
  const active = tabs.find((t) => t.id === searchParams.get('tab')) ?? (tabs[0] as Tab)
  const ids = tabIds('datasets', active.id)

  return (
    <article>
      <PageHeader
        eyebrow="Development only"
        title="Synthetic data"
        lead={`Every dataset behind the console, generated from seed ${DEFAULT_SEED} as at ${formatDate(DATA_AS_OF)}. This page is left out of production builds.`}
      />

      <div className="mt-10">
        <TabList
          tabs={tabs}
          selected={active.id}
          onSelect={(id) => setSearchParams({ tab: id }, { replace: true })}
          label="Datasets"
          group="datasets"
        />
      </div>

      {/* Keyed so each tab gets a fresh table: no sort or scroll carried across */}
      <section
        key={active.id}
        role="tabpanel"
        id={ids.panel}
        aria-labelledby={ids.tab}
        tabIndex={0}
        className="mt-6 focus-visible:outline-offset-4"
      >
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">
            {formatNumber(active.count)} {active.label.toLowerCase()}
          </h2>
          {active.note && <p className="text-xs text-ink-subtle">{active.note}</p>}
        </div>
        {active.content}
      </section>
    </article>
  )
}
