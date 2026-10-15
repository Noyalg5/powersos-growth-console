import { isRouteErrorResponse, useRouteError } from 'react-router'
import { overview } from '@/nav'

/** Last-resort screen if a page throws. Rendered outside the shell, so it stays self-contained. */
export default function RouteError() {
  const error = useRouteError()
  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : undefined

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <p className="font-mono text-xs tracking-wider text-accent-ink uppercase">Error</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        Something went wrong
      </h1>
      <p className="mt-4 leading-relaxed text-ink-muted">
        This page hit an error. Reloading usually fixes it.
      </p>
      {detail && (
        <pre className="mt-6 overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-xs text-ink-muted">
          {detail}
        </pre>
      )}
      <a
        href={overview.path}
        className="mt-8 inline-flex h-10 items-center self-start rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:brightness-95"
      >
        Back to the overview
      </a>
    </main>
  )
}
