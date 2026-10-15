import { createBrowserRouter, type RouteObject } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { PageLoading } from '@/components/PageLoading'
import { dataExplorer, overview, sectionPath } from '@/nav'
import NotFound from '@/pages/NotFound'
import RouteError from '@/pages/RouteError'

/** Shown while a page's code loads, when it is the first page opened. */
const loading = <PageLoading />

/**
 * Pages that only exist under `npm run dev`. In a production build
 * `import.meta.env.DEV` is false, so this branch and the lazy import inside it are
 * dropped, and the page and its data never reach the bundle.
 */
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: dataExplorer.path,
        lazy: async () => ({ Component: (await import('@/pages/DataExplorer')).default }),
        hydrateFallbackElement: loading,
      },
    ]
  : []

// Every page is its own download, fetched when first opened: the shell appears at once,
// and the map, drag and drop and each page's analysis load only with the page that uses them
export const router = createBrowserRouter([
  {
    path: overview.path,
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('@/pages/Overview')).default }),
        hydrateFallbackElement: loading,
      },
      {
        path: sectionPath('simulator'),
        lazy: async () => ({ Component: (await import('@/pages/EcosystemSimulator')).default }),
        hydrateFallbackElement: loading,
      },
      {
        path: sectionPath('network'),
        lazy: async () => ({ Component: (await import('@/pages/NetworkHealth')).default }),
        hydrateFallbackElement: loading,
      },
      {
        path: sectionPath('onboarding'),
        lazy: async () => ({ Component: (await import('@/pages/Onboarding')).default }),
        hydrateFallbackElement: loading,
      },
      {
        path: sectionPath('market'),
        lazy: async () => ({ Component: (await import('@/pages/MarketStrategy')).default }),
        hydrateFallbackElement: loading,
      },
      {
        path: sectionPath('pipeline'),
        lazy: async () => ({ Component: (await import('@/pages/Pipeline')).default }),
        hydrateFallbackElement: loading,
      },
      ...devRoutes,
      { path: '*', element: <NotFound /> },
    ],
  },
])
