import type { ReactNode } from 'react'

interface PageHeaderProps {
  eyebrow: string
  title: string
  lead?: ReactNode
  children?: ReactNode
}

export function PageHeader({ eyebrow, title, lead, children }: PageHeaderProps) {
  return (
    <header className="max-w-3xl">
      <p className="font-mono text-xs tracking-wider text-accent-ink uppercase">{eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
        {title}
      </h1>
      {lead && <p className="mt-4 text-lg leading-relaxed text-pretty text-ink-muted">{lead}</p>}
      {children}
    </header>
  )
}
