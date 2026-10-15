import { NOTICE } from '@/nav'

export function Footer() {
  return (
    <footer className="border-t border-line print:hidden">
      <p className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-ink-subtle sm:px-6 lg:px-10">
        {NOTICE}
      </p>
    </footer>
  )
}
