import { useCallback, useEffect, useState } from 'react'
import { Outlet, ScrollRestoration, useLocation } from 'react-router'
import { APP_NAME, pageTitleFor } from '@/nav'
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

  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : APP_NAME
  }, [title])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2 focus:text-sm focus:shadow-lg"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        <Sidebar />
      </aside>
      {navOpen && <MobileNav onClose={closeNav} />}

      <div className="flex min-h-dvh flex-col lg:pl-64">
        <Header title={title ?? 'Page not found'} onOpenNav={openNav} />
        <main
          id="main"
          className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-10 lg:py-14"
        >
          <Outlet />
        </main>
        <Footer />
      </div>

      <ScrollRestoration />
    </div>
  )
}
