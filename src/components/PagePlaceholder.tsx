import { formatSectionNumber, type Section } from '@/nav'
import { PageHeader } from './PageHeader'

/** Stand-in for a section until its modules are built: states the question and the plan. */
export function PagePlaceholder({ section }: { section: Section }) {
  return (
    <article>
      <PageHeader
        eyebrow={`Section ${formatSectionNumber(section.number)}`}
        title={section.title}
        lead={section.question}
      >
        <p className="mt-4 leading-relaxed text-pretty text-ink-muted">{section.summary}</p>
      </PageHeader>

      <section aria-labelledby="planned-modules" className="mt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="planned-modules" className="text-sm font-semibold text-ink">
            Planned modules
          </h2>
          <p className="text-xs text-ink-subtle">Scaffold only. Modules arrive in later builds.</p>
        </div>

        <ul className="mt-4 grid gap-4 sm:grid-cols-2">
          {section.modules.map((module) => (
            <li
              key={module.title}
              className="rounded-xl border border-dashed border-line bg-surface p-5 sm:p-6"
            >
              <h3 className="font-medium text-ink">{module.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{module.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
