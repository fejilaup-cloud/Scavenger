import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
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
    // Public: home is accessible to everyone (wallet connect / login)
    path: '/',
    element: (
      <AppShell>
        <HomePage />
      </AppShell>
    ),
  },
  {
    // Protected routes share AppShell and require authentication
    element: <ProtectedLayout />,
    children: [
      { path: 'submit', element: <div>Submit Waste</div> },
      { path: 'collect', element: <CollectorDashboardPage /> },
      { path: 'incentives', element: <div>Incentives</div> },
      { path: 'transfer', element: <div>Transfer</div> },
      { path: 'history', element: <div>History</div> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
