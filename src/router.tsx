import { createBrowserRouter } from 'react-router'
import { AppShell } from '@/components/layout/AppShell'
import { overview, sectionPath } from '@/nav'
import EcosystemSimulator from '@/pages/EcosystemSimulator'
import MarketStrategy from '@/pages/MarketStrategy'
import NetworkHealth from '@/pages/NetworkHealth'
import NotFound from '@/pages/NotFound'
import Onboarding from '@/pages/Onboarding'
import Overview from '@/pages/Overview'
import Pipeline from '@/pages/Pipeline'
import RouteError from '@/pages/RouteError'

export const router = createBrowserRouter([
  {
    path: overview.path,
    element: <AppShell />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <Overview /> },
      { path: sectionPath('simulator'), element: <EcosystemSimulator /> },
      { path: sectionPath('network'), element: <NetworkHealth /> },
      { path: sectionPath('onboarding'), element: <Onboarding /> },
      { path: sectionPath('market'), element: <MarketStrategy /> },
      { path: sectionPath('pipeline'), element: <Pipeline /> },
      { path: '*', element: <NotFound /> },
    ],
  },
])
