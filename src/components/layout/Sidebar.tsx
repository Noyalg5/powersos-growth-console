import { Link, NavLink } from 'react-router'
import { BrandMark } from '@/components/icons'
import { formatSectionNumber, overview, sections } from '@/nav'

interface SidebarProps {
  /** Called after a link is followed, so the mobile drawer can close. */
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <div className="flex h-full flex-col">
      <Link to={overview.path} onClick={onNavigate} className="flex items-center gap-3 px-5 py-5">
        <BrandMark />
        <span className="leading-tight">
          <span className="block text-sm font-semibold text-ink">Growth Console</span>
          <span className="block text-xs text-ink-subtle">PowerSOS concept</span>
        </span>
      </Link>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pt-2 pb-6">
        <ul className="space-y-0.5">
          <li>
            <NavItem to={overview.path} label={overview.title} onNavigate={onNavigate} />
          </li>
        </ul>

        <p className="mt-7 mb-2 px-3 text-[11px] font-medium tracking-wider text-ink-subtle uppercase">
          Sections
        </p>
        <ul className="space-y-0.5">
          {sections.map((section) => (
            <li key={section.id}>
              <NavItem
                to={section.path}
                label={section.title}
                number={formatSectionNumber(section.number)}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-line px-5 py-4 text-xs leading-relaxed text-ink-subtle">
        <p className="font-medium text-ink-muted">Noyal George</p>
        <p>KTP application · concept prototype</p>
      </div>
    </div>
  )
}

interface NavItemProps {
  to: string
  label: string
  number?: string
  onNavigate?: () => void
}

function NavItem({ to, label, number, onNavigate }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end
      onClick={onNavigate}
      className={({ isActive }) =>
        [
          'relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-surface-muted font-medium text-ink'
            : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute top-1/2 left-0 h-5 w-[3px] -translate-y-1/2 rounded-full bg-accent"
              aria-hidden="true"
            />
          )}
          {number && (
            <span className="font-mono text-xs text-ink-subtle tabular-nums">{number}</span>
          )}
          <span>{label}</span>
        </>
      )}
    </NavLink>
  )
}
