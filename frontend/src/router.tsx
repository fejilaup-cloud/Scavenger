import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { LandingPage } from '@/pages/LandingPage'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { IncentivesPage } from '@/pages/IncentivesPage'
import { WasteListPage } from '@/pages/WasteListPage'
import { ManufacturerDashboardPage } from '@/pages/ManufacturerDashboardPage'
import { CollectorDashboardPage } from '@/pages/CollectorDashboardPage'

function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? (
    <AppShell>
      <Outlet />
    </AppShell>
  ) : (
    <Navigate to="/" replace />
  )
}

export const router = createBrowserRouter([
  {
    // Public landing page
    path: '/',
    element: <LandingPage />,
  },
  {
    // Protected routes share AppShell and require authentication
    element: <ProtectedLayout />,
    children: [
      { path: 'dashboard', element: <HomePage /> },
      { path: 'submit', element: <div>Submit Waste</div> },
      { path: 'collect', element: <div>Collect</div> },
      { path: 'incentives', element: <IncentivesPage /> },
      { path: 'collect', element: <CollectorDashboardPage /> },
      { path: 'incentives', element: <div>Incentives</div> },
      { path: 'transfer', element: <div>Transfer</div> },
      { path: 'history', element: <div>History</div> },
      { path: 'wastes', element: <WasteListPage /> },
      { path: 'manufacturer', element: <ManufacturerDashboardPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
