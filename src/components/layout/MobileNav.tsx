import { useEffect, useRef } from 'react'
import { CloseIcon } from '@/components/icons'
import { Sidebar } from './Sidebar'

/** Slide-over navigation for screens narrower than the fixed sidebar. */
export function MobileNav({ onClose }: { onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    closeButton.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative h-full w-72 max-w-[85%] border-r border-line bg-surface shadow-xl">
        <button
          ref={closeButton}
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
          className="absolute top-4 right-3 rounded-md p-2 text-ink-muted hover:bg-surface-muted hover:text-ink"
        >
          <CloseIcon />
        </button>
        <Sidebar onNavigate={onClose} />
      </div>
    </div>
  )
}
