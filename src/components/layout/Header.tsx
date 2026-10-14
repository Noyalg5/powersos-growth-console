import { MenuIcon } from '@/components/icons'
import { SyntheticDataBadge } from './SyntheticDataBadge'
import { ThemeToggle } from './ThemeToggle'

interface HeaderProps {
  title: string
  onOpenNav: () => void
}

export function Header({ title, onOpenNav }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={onOpenNav}
          aria-label="Open navigation"
          className="-ml-2 rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink lg:hidden"
        >
          <MenuIcon />
        </button>

        <p className="min-w-0 truncate text-sm text-ink-muted">
          <span className="hidden sm:inline">Growth Console</span>
          <span className="mx-2 hidden text-ink-subtle sm:inline" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-ink">{title}</span>
        </p>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <SyntheticDataBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
