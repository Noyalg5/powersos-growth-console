import type { ReactNode } from 'react'
import { sectorLabel } from '@/data'
import { formatDate, formatDuration, formatGBP, formatNumber } from '@/lib/format'
import type { Proposal } from '@/lib/proposal'
import { APP_NAME, NOTICE } from '@/nav'
import { SiteMap } from './SiteMap'

interface ProposalSheetProps {
  proposal: Proposal
  /** Where the call-out rate behind the tier comes from, e.g. "the telecoms average on record". */
  rateBasis: string
}

const pounds = (n: number) => formatGBP(n, { pence: false })
const siteCount = (n: number) => `${formatNumber(n)} ${n === 1 ? 'site' : 'sites'}`

const STATUS_LABELS = { covered: 'Covered', thin: 'Thin', uncovered: 'Uncovered' } as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 break-inside-avoid">
      <h3 className="text-xs font-semibold tracking-wide text-ink uppercase">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

/** Under 5 minutes reads better than "2 min" for a responder based next door. */
const eta = (minutes: number | null) =>
  minutes === null ? 'None eligible' : minutes < 5 ? 'Under 5 min' : formatDuration(minutes)

/**
 * A one-page proposal, laid out to print on a single A4 sheet. Every figure on it is
 * illustrative and the sheet says so, top and bottom.
 */
export function ProposalSheet({ proposal, rateBasis }: ProposalSheetProps) {
  const { lead, sites, coverage, overnight, recommendation, downtime } = proposal
  const n = sites.length
  const gaps = coverage.thin + coverage.uncovered

  return (
    <article
      aria-labelledby="proposal-title"
      className="mx-auto max-w-[52rem] space-y-6 rounded-xl border border-line bg-surface p-5 text-ink shadow-sm [print-color-adjust:exact] sm:p-8 print:max-w-none print:space-y-5 print:rounded-none print:border-0 print:p-0 print:shadow-none"
    >
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wider text-accent-ink uppercase">
            Illustrative proposal
          </p>
          <h2 id="proposal-title" className="mt-1 text-xl font-semibold tracking-tight text-balance">
            Prepared for {lead.organisation}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            24/7 HV emergency response membership · {formatDate(proposal.preparedOn)}
          </p>
          <p className="text-sm text-ink-muted">
            For {lead.contact.name}, {lead.contact.role}
          </p>
        </div>
        <div className="text-xs text-ink-muted sm:text-right">
          <p className="font-medium text-ink">{APP_NAME}</p>
          <p>
            {sectorLabel(lead.sector)} · {siteCount(n)}
          </p>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 font-medium">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Synthetic data
          </p>
        </div>
      </header>

      <div className="grid gap-6 sm:grid-cols-[13rem_minmax(0,1fr)]">
        <Section title="Your sites">
          <SiteMap
            sites={sites}
            responders={proposal.responders}
            label={`Map of ${lead.organisation}'s ${siteCount(n)}, numbered as in the cover table, with ${formatNumber(proposal.responders.length)} responder bases within reach.`}
          />
        </Section>
        <Section title="Cover at your sites today">
          <p className="text-sm leading-relaxed">
            {formatNumber(coverage.covered)} of {siteCount(n)} have two or more eligible responders
            within an estimated 75-minute drive on a weekday, and {formatNumber(overnight.covered)}{' '}
            overnight.
            {gaps > 0 && ` ${formatNumber(gaps)} ${gaps === 1 ? 'needs' : 'need'} a cover plan before go-live.`}
          </p>
          <table className="mt-3 w-full text-xs">
            <caption className="sr-only">Cover at each site</caption>
            <thead className="border-b border-line text-ink-subtle">
              <tr>
                <th scope="col" className="py-1 pr-2 text-left font-medium">
                  #
                </th>
                <th scope="col" className="py-1 pr-2 text-left font-medium">
                  Site
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Within 75 min
                  <span className="block font-normal">day / night</span>
                </th>
                <th scope="col" className="py-1 pr-2 text-right font-medium">
                  Best ETA*
                </th>
                <th scope="col" className="py-1 text-left font-medium">
                  Cover
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {sites.map((s) => (
                <tr key={s.site.id}>
                  <td className="py-1 pr-2 text-ink-subtle">{s.number}</td>
                  <th scope="row" className="py-1 pr-2 text-left font-normal">
                    {s.site.name}
                  </th>
                  <td className="py-1 pr-2 text-right">
                    {formatNumber(s.inReach)} / {formatNumber(s.inReachOvernight)}
                  </td>
                  <td className="py-1 pr-2 text-right whitespace-nowrap">{eta(s.bestMinutes)}</td>
                  <td
                    className={`py-1 ${s.status === 'uncovered' ? 'font-medium text-danger-ink' : s.status === 'thin' ? 'text-ink' : 'text-ink-muted'}`}
                  >
                    {STATUS_LABELS[s.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-[11px] leading-snug text-ink-subtle">
            *Estimated drive from the nearest eligible responder&apos;s base. Mobilisation and
            traffic add to it on the day. Eligible means HV authorisation and insurance in date and
            on call at that hour.
          </p>
        </Section>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Cost of downtime against membership">
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className="text-xs text-ink-subtle">An hour without power, one site</dt>
              <dd className="text-lg font-semibold tabular-nums">{pounds(downtime.perHour)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-subtle">Membership, {siteCount(n)}, a year</dt>
              <dd className="text-lg font-semibold tabular-nums">{pounds(proposal.annualCost)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-sm leading-relaxed">{downtime.sentence}</p>
          <p className="mt-1 text-[11px] leading-snug text-ink-subtle">
            Illustrative: {sectorLabel(lead.sector)} scores {downtime.score} of 5 for cost of
            downtime in the market model, and the hourly figure for each score is an assumption.
          </p>
        </Section>
        <Section title={`Recommended: ${recommendation.tier.name}`}>
          <p className="text-lg font-semibold tabular-nums">
            {pounds(recommendation.perSite)}{' '}
            <span className="text-sm font-normal text-ink-muted">per site a year</span>
          </p>
          <p className="mt-1 text-sm leading-relaxed">{recommendation.reason}</p>
          <table className="mt-2 w-full text-xs">
            <caption className="sr-only">Every tier, per site a year</caption>
            <tbody className="divide-y divide-line tabular-nums">
              {recommendation.costs.map((c) => (
                <tr key={c.tier.id}>
                  <th scope="row" className="py-1 text-left font-normal">
                    {c.tier.name}
                    {c.tier.id === recommendation.tier.id && (
                      <span className="ml-1.5 text-accent-ink">Recommended</span>
                    )}
                  </th>
                  <td className="py-1 text-right">{pounds(c.perSite)} per site a year</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] leading-snug text-ink-subtle">
            At the pricing sandbox defaults, with {formatNumber(recommendation.callOutsPerSite, 1)}{' '}
            call-outs per site a year: {rateBasis}.
          </p>
        </Section>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Section title="Onboarding plan">
          <ol className="space-y-1.5 text-sm">
            {proposal.plan.map((step) => (
              <li key={step.id} className="grid grid-cols-[4.5rem_1fr] gap-2">
                <span className="text-xs text-ink-subtle tabular-nums">{step.when}</span>
                <span>
                  <span className="font-medium">{step.label}.</span>{' '}
                  <span className="text-ink-muted">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>
        <Section title="Next steps">
          <ol className="list-decimal space-y-1.5 pl-4 text-sm leading-relaxed marker:text-ink-subtle">
            {proposal.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Section>
      </div>

      <footer className="space-y-1 border-t border-line pt-3 text-[11px] leading-snug text-ink-subtle">
        <p>
          Synthetic data. An illustrative proposal built from synthetic data and stated
          assumptions; it is not a quote.
        </p>
        <p>{NOTICE}</p>
      </footer>
    </article>
  )
}
