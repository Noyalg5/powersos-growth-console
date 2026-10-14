import { Link } from 'react-router'
import { ArrowRightIcon } from '@/components/icons'
import { PageHeader } from '@/components/PageHeader'
import { formatSectionNumber, sections } from '@/nav'

/** From powersos.co.uk. The only figures in the console treated as real. */
const publicFacts = [
  { label: 'Target response', value: '75 min', note: 'Subject to distance and traffic' },
  { label: 'Availability', value: '24/7', note: 'Across mainland UK' },
  { label: 'Emergency request', value: '3 clicks', note: 'From a pre-loaded site' },
  { label: 'Membership', value: 'Unlimited', note: 'Call-outs; pricing not yet announced' },
]

const sides = [
  {
    name: 'End customers',
    role: 'Organisations running private HV networks: hospitals, campuses, factories, airports, data centres and more.',
    growth: 'Sites onboarded with complete equipment data',
    workingDefinition: false,
  },
  {
    name: 'Responders',
    role: 'Vetted engineers holding current HV authorisation, audited for competence and safety.',
    growth: 'Authorised responders within reach of every site',
    workingDefinition: false,
  },
  {
    name: 'Partners',
    role: 'Organisations that bring customers or capability, such as facilities managers, insurers and consultancies.',
    growth: 'Referrals and joint offers',
    workingDefinition: true,
  },
  {
    name: 'Suppliers',
    role: 'Firms that keep repairs moving, such as switchgear spares, cable and generator hire.',
    growth: 'Parts and plant ready when a job needs them',
    workingDefinition: true,
  },
]

export default function Overview() {
  return (
    <article>
      <PageHeader
        eyebrow="Overview"
        title="Growing a four-sided emergency-response ecosystem"
        lead="PowerSOS connects organisations that run private high-voltage networks with vetted, HV-authorised responders for emergency call-outs. This console shows how I would run business development for it: building supply and demand together, keeping the network compliant and choosing which markets to win next."
      />

      <section aria-labelledby="public-facts" className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="public-facts" className="text-sm font-semibold text-ink">
            What is public
          </h2>
          <p className="text-xs text-ink-subtle">
            Source: powersos.co.uk. Everything else in this console is synthetic.
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
          {publicFacts.map((fact) => (
            <div key={fact.label} className="bg-surface p-5 sm:p-6">
              <dt className="text-xs text-ink-subtle">{fact.label}</dt>
              <dd className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">
                {fact.value}
              </dd>
              <dd className="mt-1 text-xs leading-relaxed text-ink-muted">{fact.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="four-sides" className="mt-14">
        <h2 id="four-sides" className="text-sm font-semibold text-ink">
          The four sides
        </h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {sides.map((side) => (
            <li key={side.name} className="rounded-xl border border-line bg-surface p-5 sm:p-6">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-medium text-ink">{side.name}</h3>
                {side.workingDefinition && (
                  <span className="text-[11px] whitespace-nowrap text-ink-subtle">
                    Working definition
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{side.role}</p>
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-subtle">
                Growth looks like: <span className="text-ink-muted">{side.growth}</span>
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sections" className="mt-14">
        <h2 id="sections" className="text-sm font-semibold text-ink">
          Sections
        </h2>
        <ul className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {sections.map((section) => (
            <li key={section.id}>
              <Link
                to={section.path}
                className="group flex items-start gap-4 p-5 transition-colors hover:bg-surface-muted sm:p-6"
              >
                <span className="pt-0.5 font-mono text-xs text-ink-subtle tabular-nums">
                  {formatSectionNumber(section.number)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-ink">{section.title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                    {section.question}
                  </span>
                </span>
                <ArrowRightIcon className="mt-0.5 shrink-0 text-ink-subtle transition-colors group-hover:text-accent-ink" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
