/**
 * Shown while a page's code downloads on the first visit. It takes the shape of a
 * page header so the page does not jump when it arrives.
 */
export function PageLoading() {
  return (
    <div role="status" className="max-w-3xl motion-safe:animate-pulse">
      <span className="sr-only">Loading the page…</span>
      <div aria-hidden="true">
        <div className="h-3 w-24 rounded bg-surface-muted" />
        <div className="mt-4 h-9 w-3/4 rounded bg-surface-muted" />
        <div className="mt-5 h-4 w-full rounded bg-surface-muted" />
        <div className="mt-2 h-4 w-2/3 rounded bg-surface-muted" />
      </div>
    </div>
  )
}
