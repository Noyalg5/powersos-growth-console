import { useCallback, useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation, useNavigation } from 'react-router'
import { APP_NAME, pageTitleFor } from '@/nav'
import { DemoTour } from './DemoTour'
import { Footer } from './Footer'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { Sidebar } from './Sidebar'

export function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const openNav = useCallback(() => setNavOpen(true), [])
  const closeNav = useCallback(() => setNavOpen(false), [])

  const { pathname } = useLocation()
  const title = pageTitleFor(pathname)
  // A page's code is still downloading after a link was followed
  const loading = useNavigation().state === 'loading'

  useEffect(() => {
    document.title = `${title ?? 'Page not found'} · ${APP_NAME}`
  }, [title])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block print:hidden">
        <Sidebar />
      </aside>
      {navOpen && <MobileNav onClose={closeNav} />}

      <div className="flex min-h-dvh flex-col lg:pl-64">
        {loading && (
          <div
            role="progressbar"
            aria-label="Loading the page"
            className="fixed inset-x-0 top-0 z-30 h-0.5 overflow-hidden lg:left-64 print:hidden"
          >
            <div className="h-full w-1/3 bg-accent motion-safe:animate-loading-bar motion-reduce:w-full motion-reduce:opacity-60" />
          </div>
        )}
        <Header title={title ?? 'Page not found'} onOpenNav={openNav} />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 outline-none sm:px-6 sm:py-10 lg:px-10 print:p-0"
        >
          <Outlet />
        </main>
        <Footer />
      </div>

      <DemoTour />
      <ScrollRestoration />
    </div>
  )
}
