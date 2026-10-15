import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { CloseIcon } from '@/components/icons'
import { NumberField } from '@/components/NumberField'
import { ResetBar } from '@/components/ResetBar'
import { Tag } from '@/components/Tag'
import type { Persisted } from '@/components/usePersistentState'
import { demoTarget } from '@/demo'
import { formatGBP, formatGBPCompact, formatMonth, formatNumber, formatPercent } from '@/lib/format'
import {
  breakEvenSentence,
  LIMITS,
  MAX_TIERS,
  nextTier,
  priceModel,
  projectGrowth,
  PROJECTION_MONTHS,
  TIER_NAME_MAX_LENGTH,
  type NumericInput,
  type PricingInputs,
  type Tier,
} from '@/lib/pricing'
import { monthStart } from '@/lib/retention'
import { ProjectionChart } from './ProjectionChart'

/** Where each default read from the synthetic data comes from, in a sentence. */
export type PricingSources = Record<
  | 'customers'
  | 'callOutsPerSite'
  | 'adHocCost'
  | 'materialsPerCallOut'
  | 'sitesPerCustomer'
  | 'newCustomers'
  | 'monthlyChurn',
  string
>

interface PricingSandboxProps {
  state: Persisted<PricingInputs>
  defaults: PricingInputs
  sources: PricingSources
  asOf: number
}

const pounds = (n: number) => formatGBP(n, { pence: false })
const one = (n: number) => formatNumber(n, 1)
/** 10%, or 1.1% when the share has a fraction of a percent. */
const share = (n: number) => formatPercent(n, Number.isInteger(Math.round(n * 1e6) / 1e4) ? 0 : 1)
const TICKS = [0, 12, 24]

function Synthetic({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="font-medium text-ink-muted">Synthetic data:</span> {children}
    </>
  )
}

function Assumption({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="font-medium text-ink-muted">Assumption:</span> {children}
    </>
  )
}

/** The formula behind an output, with today's numbers in it. */
function Workings({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-3 border-t border-line pt-2 text-xs">
      <summary className="cursor-pointer font-medium text-ink-muted hover:text-ink">
        How this is calculated
      </summary>
      <div className="mt-2 space-y-1.5 leading-relaxed text-ink-muted">
        {children}
        <p className="text-ink-subtle">
          Amounts are rounded to the pound, so totals can differ by £1.
        </p>
      </div>
    </details>
  )
}

function Formula({ children }: { children: ReactNode }) {
  return <p className="font-medium text-ink">{children}</p>
}

function Output({
  label,
  value,
  caption,
  children,
}: {
  label: string
  value: string
  caption: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col rounded-xl border border-line bg-surface p-4">
      <h4 className="text-xs leading-snug text-ink-subtle">{label}</h4>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight text-ink">{value}</p>
        <Tag kind="illustrative" />
      </div>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">{caption}</p>
      <div className="mt-auto">
        <Workings>{children}</Workings>
      </div>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-line bg-surface p-4">
      <legend className="float-left mb-3 w-full text-sm font-semibold text-ink">{title}</legend>
      <div className="clear-left space-y-4">{children}</div>
    </fieldset>
  )
}

/** Tab 3: a what-if model of membership pricing, for the platform, responders and customers. */
export function PricingSandbox({ state, defaults, sources, asOf }: PricingSandboxProps) {
  const inputs = state.value
  const model = useMemo(() => priceModel(inputs), [inputs])
  const projection = useMemo(() => projectGrowth(inputs), [inputs])
  const end = projection[projection.length - 1]
  const labels = projection.map((p) => formatMonth(monthStart(asOf, p.month)))

  const set = <K extends NumericInput>(key: K, value: PricingInputs[K]) =>
    state.set({ ...inputs, [key]: value })
  const setTier = (id: string, patch: Partial<Tier>) =>
    state.set({ ...inputs, tiers: inputs.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  const removeTier = (id: string) =>
    state.set({ ...inputs, tiers: inputs.tiers.filter((t) => t.id !== id) })
  const addTier = () => {
    const tier = nextTier(inputs.tiers)
    if (tier) state.set({ ...inputs, tiers: [...inputs.tiers, tier] })
  }

  const field = (key: NumericInput) => ({
    value: inputs[key],
    onChange: (value: number) => set(key, value),
    min: LIMITS[key].min,
    max: LIMITS[key].max,
    defaultValue: defaults[key],
  })

  return (
    <div className="space-y-8">
      <ResetBar
        edited={state.edited}
        saved={state.saved}
        onReset={state.reset}
        what="pricing inputs"
      >
        <Tag kind="illustrative" />
        <span>PowerSOS pricing is not public: every figure here is a what-if.</span>
        <Tag kind="synthetic" />
        <span>Defaults read from the synthetic data where they can be.</span>
      </ResetBar>

      <Group title="Membership tiers">
        <div className="grid gap-4 md:grid-cols-3">
          {inputs.tiers.map((tier) => {
            const original = defaults.tiers.find((t) => t.id === tier.id)
            return (
              <div key={tier.id} className="rounded-lg border border-line p-3">
                <div className="flex items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`tier-name-${tier.id}`}
                      className="mb-1 block text-xs text-ink-subtle"
                    >
                      Tier name
                    </label>
                    <input
                      id={`tier-name-${tier.id}`}
                      type="text"
                      value={tier.name}
                      maxLength={TIER_NAME_MAX_LENGTH}
                      onChange={(e) => setTier(tier.id, { name: e.target.value })}
                      onBlur={(e) => {
                        if (e.target.value.trim() === '')
                          setTier(tier.id, { name: original?.name ?? 'Tier' })
                      }}
                      className="h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm font-medium text-ink focus-visible:border-accent"
                    />
                  </div>
                  {inputs.tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTier(tier.id)}
                      aria-label={`Remove the ${tier.name} tier`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-muted hover:text-ink"
                    >
                      <CloseIcon width={16} height={16} />
                    </button>
                  )}
                </div>
                <div className="mt-3 grid gap-3">
                  <NumberField
                    label="Price per site a month"
                    unit="pounds"
                    value={tier.pricePerSite}
                    onChange={(v) => setTier(tier.id, { pricePerSite: v })}
                    min={LIMITS.pricePerSite.min}
                    max={LIMITS.pricePerSite.max}
                    defaultValue={original?.pricePerSite}
                    note={<Assumption>no public pricing.</Assumption>}
                  />
                  <div>
                    <NumberField
                      label="Call-outs included per site a year"
                      value={tier.allowance ?? 0}
                      onChange={(v) => setTier(tier.id, { allowance: v })}
                      min={LIMITS.allowance.min}
                      max={LIMITS.allowance.max}
                      decimals={1}
                      disabled={tier.allowance === null}
                      disabledText="Unlimited"
                    />
                    <label className="mt-1.5 flex items-center gap-2 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={tier.allowance === null}
                        onChange={(e) =>
                          setTier(tier.id, {
                            allowance: e.target.checked ? null : (original?.allowance ?? 3),
                          })
                        }
                        className="size-4 accent-accent"
                      />
                      Unlimited call-outs
                    </label>
                  </div>
                  <NumberField
                    label="Customers on this tier"
                    value={tier.customers}
                    onChange={(v) => setTier(tier.id, { customers: v })}
                    min={LIMITS.customers.min}
                    max={LIMITS.customers.max}
                    defaultValue={original?.customers}
                  />
                </div>
              </div>
            )
          })}
          {inputs.tiers.length < MAX_TIERS && (
            <button
              type="button"
              onClick={addTier}
              className="min-h-24 rounded-lg border border-dashed border-line text-sm font-medium text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink"
            >
              Add a tier
            </button>
          )}
        </div>
        <p className="text-[11px] leading-relaxed text-ink-subtle">{sources.customers}</p>
      </Group>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Group title="Call-outs">
            <NumberField
              label="Call-outs per site a year"
              decimals={1}
              {...field('callOutsPerSite')}
              note={<Synthetic>{sources.callOutsPerSite}</Synthetic>}
            />
            <NumberField
              label="Ad-hoc cost of a call-out: attendance and labour"
              unit="pounds"
              {...field('adHocCost')}
              note={<Synthetic>{sources.adHocCost}</Synthetic>}
            />
            <NumberField
              label="Pay-per-call-out price, beyond the allowance"
              unit="pounds"
              {...field('payPerCallOut')}
              note={
                <Assumption>
                  what PowerSOS charges for each call-out a tier does not include.
                </Assumption>
              }
            />
            <NumberField
              label="Parts and generator hire per call-out"
              unit="pounds"
              {...field('materialsPerCallOut')}
              note={<Synthetic>{sources.materialsPerCallOut}</Synthetic>}
            />
          </Group>

          <Group title="Who gets what">
            <NumberField
              label="Responder payout"
              unit="percent"
              suffix="of the pay-per-call-out price"
              {...field('responderPayout')}
              note={<Assumption>paid for every call-out, included in a tier or not.</Assumption>}
            />
            <NumberField
              label="Supplier margin"
              unit="percent"
              suffix="of parts and hire"
              decimals={1}
              {...field('supplierMargin')}
              note={
                <Assumption>
                  what suppliers pay the platform on orders placed through it.
                </Assumption>
              }
            />
          </Group>

          <Group title="Customers">
            <NumberField
              label="Sites per customer"
              decimals={1}
              {...field('sitesPerCustomer')}
              note={<Synthetic>{sources.sitesPerCustomer}</Synthetic>}
            />
            <NumberField
              label="New customers a month"
              decimals={1}
              {...field('newCustomers')}
              note={<Synthetic>{sources.newCustomers}</Synthetic>}
            />
            <NumberField
              label="Monthly churn"
              unit="percent"
              decimals={1}
              {...field('monthlyChurn')}
              note={
                <Synthetic>
                  {sources.monthlyChurn}{' '}
                  <Link
                    to="/onboarding#retention"
                    className="underline decoration-line underline-offset-2 hover:text-ink"
                  >
                    See the retention grid
                  </Link>
                  .
                </Synthetic>
              }
            />
          </Group>
        </div>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="outputs-heading">
            <h3 id="outputs-heading" className="sr-only">
              A month at today's customers
            </h3>
            <div className="grid gap-4 md:grid-cols-3">
              <Output
                label="Monthly recurring revenue"
                value={pounds(model.mrr)}
                caption={`Membership fees from ${formatNumber(model.customers)} customers and ${formatNumber(model.sites)} sites.`}
              >
                <Formula>
                  Customers × sites per customer × price per site a month, for each tier
                </Formula>
                {model.tiers.map((t) => (
                  <p key={t.tier.id} className="tabular-nums">
                    {t.tier.name}: {formatNumber(t.tier.customers)} × {one(inputs.sitesPerCustomer)}{' '}
                    × {pounds(t.tier.pricePerSite)} = {pounds(t.membership)}
                  </p>
                ))}
                <p>
                  Charges for call-outs beyond an allowance are not recurring, so they are left out.
                </p>
              </Output>
              <Output
                label="Platform take a month"
                value={pounds(model.take)}
                caption={
                  model.take < 0
                    ? 'Negative: responder payouts cost more than the fees bring in.'
                    : `${formatPercent(model.revenue === 0 ? 0 : model.take / model.revenue)} of ${pounds(model.revenue)} revenue.`
                }
              >
                <Formula>Revenue − responder earnings</Formula>
                <p className="tabular-nums">
                  Revenue: {pounds(model.mrr)} membership + {pounds(model.callOutCharges)} call-out
                  charges + {pounds(model.supplierIncome)} supplier margin = {pounds(model.revenue)}
                </p>
                <p>
                  Call-out charges: each tier's sites × call-outs beyond its allowance ÷ 12 ×{' '}
                  {pounds(inputs.payPerCallOut)}. Supplier margin: {one(model.callOuts)} call-outs a
                  month × {pounds(inputs.materialsPerCallOut)} × {share(inputs.supplierMargin)}.
                </p>
                <p className="tabular-nums">
                  Take: {pounds(model.revenue)} − {pounds(model.responderEarnings)} ={' '}
                  {pounds(model.take)}
                </p>
              </Output>
              <Output
                label="Responder earnings a month"
                value={pounds(model.responderEarnings)}
                caption={`${formatGBP(model.payoutPerCallOut)} a call-out: ${formatPercent(inputs.adHocCost === 0 ? 0 : model.payoutPerCallOut / inputs.adHocCost)} of what the same work costs ad hoc.`}
              >
                <Formula>Call-outs a month × pay-per-call-out price × payout share</Formula>
                <p className="tabular-nums">
                  {one(model.sites)} sites × {one(inputs.callOutsPerSite)} ÷ 12 ={' '}
                  {one(model.callOuts)} call-outs a month
                </p>
                <p className="tabular-nums">
                  {one(model.callOuts)} × {pounds(inputs.payPerCallOut)} ×{' '}
                  {share(inputs.responderPayout)} = {pounds(model.responderEarnings)}
                </p>
                <p>
                  Responders are paid for included call-outs too: the membership fee funds them.
                </p>
              </Output>
            </div>
          </section>

          <section aria-labelledby="break-even-heading" {...demoTarget('break-even')}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h3 id="break-even-heading" className="text-sm font-semibold text-ink">
                Customer break-even against ad-hoc call-outs
              </h3>
              <Tag kind="illustrative" />
            </div>
            <p className="mb-3 max-w-3xl text-sm text-ink" aria-live="polite">
              {breakEvenSentence(model, inputs.callOutsPerSite)}
            </p>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="w-full min-w-[40rem] text-sm">
                <caption className="sr-only">
                  What a member pays per site a year on each tier, against paying ad hoc
                </caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-subtle">
                    <th scope="col" className="px-4 py-2.5 font-medium">
                      Tier
                    </th>
                    <th scope="col" className="px-3 py-2.5 font-medium">
                      Included
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Member pays
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Ad hoc
                    </th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">
                      Difference
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">
                      Pays for itself from
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {model.tiers.map((t) => (
                    <tr key={t.tier.id}>
                      <th scope="row" className="px-4 py-2.5 text-left font-medium text-ink">
                        {t.tier.name}
                        <span className="block text-xs font-normal text-ink-subtle">
                          {pounds(t.tier.pricePerSite)} per site a month
                        </span>
                      </th>
                      <td className="px-3 py-2.5 text-ink-muted">
                        {t.tier.allowance === null
                          ? 'Unlimited'
                          : `${one(t.tier.allowance)} a year`}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink tabular-nums">
                        {pounds(t.memberCost)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-ink-muted tabular-nums">
                        {pounds(t.adHocCost)}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right whitespace-nowrap tabular-nums ${t.saving < 0 ? 'text-accent-ink' : 'text-ink'}`}
                      >
                        {t.saving >= 0 ? `Saves ${pounds(t.saving)}` : `${pounds(-t.saving)} more`}
                      </td>
                      <td className="px-4 py-2.5 text-right text-ink tabular-nums">
                        {t.breakEven === null ? 'Never' : `${one(t.breakEven)} call-outs`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-line px-4 py-2.5 text-xs text-ink-subtle">
                Per site a year at {one(inputs.callOutsPerSite)} call-outs, attendance and labour
                only: parts and hire cost the same either way.
              </p>
            </div>
            <Workings>
              <Formula>
                Member pays: 12 × price per site + call-outs beyond the allowance × pay-per-call-out
                price
              </Formula>
              <p>Ad hoc: call-outs per site a year × {pounds(inputs.adHocCost)}.</p>
              <Formula>Pays for itself from</Formula>
              <p>
                Within the allowance: 12 × price ÷ ad-hoc cost. Beyond it, each extra call-out saves
                the ad-hoc cost less the pay-per-call-out price, so: (12 × price − allowance ×
                pay-per-call-out price) ÷ (ad-hoc cost − pay-per-call-out price). If a charged
                call-out costs as much as one ad hoc, the tier never pays for itself.
              </p>
              {model.tiers.map((t) => (
                <p key={t.tier.id} className="tabular-nums">
                  {t.tier.name}: 12 × {pounds(t.tier.pricePerSite)} ={' '}
                  {pounds(12 * t.tier.pricePerSite)} a year;{' '}
                  {t.breakEven === null
                    ? 'never pays for itself.'
                    : `pays for itself from ${one(t.breakEven)} call-outs.`}
                </p>
              ))}
            </Workings>
          </section>

          <section aria-labelledby="projection-heading">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <h3 id="projection-heading" className="text-sm font-semibold text-ink">
                {PROJECTION_MONTHS}-month projection
              </h3>
              <Tag kind="illustrative" />
            </div>
            {end && (
              <p className="mb-4 max-w-3xl text-sm text-ink-muted">
                By {labels[labels.length - 1]}: {formatNumber(end.customers)} customers (from{' '}
                {formatNumber(model.customers)} today), {pounds(end.revenue)} revenue a month and a
                platform take of {pounds(end.take)} a month.
              </p>
            )}
            <div className="grid gap-6 rounded-xl border border-line bg-surface p-4 md:grid-cols-2">
              <ProjectionChart
                title="Customers"
                labels={labels}
                ticks={TICKS}
                format={(v) => formatNumber(v)}
                axisFormat={(v) => formatNumber(v)}
                series={[
                  {
                    key: 'customers',
                    label: 'customers',
                    values: projection.map((p) => p.customers),
                    stroke: 'stroke-viz-1',
                    fill: 'fill-viz-1',
                  },
                ]}
              />
              <ProjectionChart
                title="Revenue a month"
                labels={labels}
                ticks={TICKS}
                format={pounds}
                axisFormat={formatGBPCompact}
                series={[
                  {
                    key: 'revenue',
                    label: 'revenue',
                    values: projection.map((p) => p.revenue),
                    stroke: 'stroke-viz-1',
                    fill: 'fill-viz-1',
                  },
                  {
                    key: 'take',
                    label: 'platform take',
                    values: projection.map((p) => p.take),
                    stroke: 'stroke-viz-2',
                    fill: 'fill-viz-2',
                  },
                ]}
              />
            </div>
            <Workings>
              <Formula>Customers next month = customers × (1 − churn) + new customers</Formula>
              <p className="tabular-nums">
                {formatNumber(model.customers)} × (1 − {share(inputs.monthlyChurn)}) +{' '}
                {one(inputs.newCustomers)} = {one(projection[1]?.customers ?? 0)} after the first
                month. New customers join in today's mix of tiers, or evenly when there are none
                yet.
              </p>
              <Formula>
                Revenue = customers on each tier × what one customer on it brings in a month
              </Formula>
              <p>
                Prices, call-out rates and the payout stay as set above for all {PROJECTION_MONTHS}{' '}
                months. Customers are expected values, so they need not be whole.
              </p>
            </Workings>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer font-medium text-ink-muted hover:text-ink">
                Show the projection as a table
              </summary>
              <div className="mt-2 max-h-80 overflow-auto rounded-lg border border-line">
                <table className="w-full min-w-[28rem] text-xs">
                  <caption className="sr-only">
                    Customers and revenue for each month of the projection
                  </caption>
                  <thead className="sticky top-0 bg-surface">
                    <tr className="border-b border-line text-left text-ink-subtle">
                      <th scope="col" className="px-3 py-2 font-medium">
                        Month
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Customers
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Recurring
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Revenue
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">
                        Platform take
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {projection.map((p, i) => (
                      <tr key={p.month}>
                        <th
                          scope="row"
                          className="px-3 py-1.5 text-left font-normal text-ink-muted"
                        >
                          {labels[i]}
                        </th>
                        <td className="px-3 py-1.5 text-right text-ink tabular-nums">
                          {one(p.customers)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink tabular-nums">
                          {pounds(p.mrr)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink tabular-nums">
                          {pounds(p.revenue)}
                        </td>
                        <td className="px-3 py-1.5 text-right text-ink tabular-nums">
                          {pounds(p.take)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </div>
      </div>
    </div>
  )
}
