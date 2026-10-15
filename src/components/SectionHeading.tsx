/** A section's heading with a line or two on what it shows. */
export function SectionHeading({ id, title, lead }: { id: string; title: string; lead: string }) {
  return (
    <div className="max-w-3xl">
      <h2 id={id} className="text-lg font-semibold tracking-tight text-ink">
        {title}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-muted">{lead}</p>
    </div>
  )
}
