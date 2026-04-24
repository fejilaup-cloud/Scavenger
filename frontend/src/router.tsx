import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { PageSkeleton } from '@/components/ui/Skeletons'

// Eagerly load tiny pages that are always needed
import { LandingPage } from '@/pages/LandingPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Lazy-load all protected pages to reduce initial bundle size
const HomePage = lazy(() => import('@/pages/HomePage').then((m) => ({ default: m.HomePage })))
const RecyclerDashboard = lazy(() =>
  import('@/pages/RecyclerDashboard').then((m) => ({ default: m.RecyclerDashboard }))
)
const IncentivesMarketplacePage = lazy(() =>
  import('@/pages/IncentivesMarketplacePage').then((m) => ({ default: m.IncentivesMarketplacePage }))
)
const WasteListPage = lazy(() =>
  import('@/pages/WasteListPage').then((m) => ({ default: m.WasteListPage }))
)
const ManufacturerDashboardPage = lazy(() =>
  import('@/pages/ManufacturerDashboardPage').then((m) => ({
    default: m.ManufacturerDashboardPage
  }))
)
const CollectorDashboardPage = lazy(() =>
  import('@/pages/CollectorDashboardPage').then((m) => ({ default: m.CollectorDashboardPage }))
)
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage }))
)
const RewardsPage = lazy(() =>
  import('@/pages/RewardsPage').then((m) => ({ default: m.RewardsPage }))
)
const SupplyChainTrackerPage = lazy(() =>
  import('@/pages/SupplyChainTrackerPage').then((m) => ({ default: m.SupplyChainTrackerPage }))
)
const CommunityPage = lazy(() =>
  import('@/pages/CommunityPage').then((m) => ({ default: m.CommunityPage }))
)
const AnalyticsPage = lazy(() =>
  import('@/pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage }))
)
const ProfilePage = lazy(() =>
  import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage }))
)
const SearchResultsPage = lazy(() =>
  import('@/pages/SearchResultsPage').then((m) => ({ default: m.SearchResultsPage }))
)

// eslint-disable-next-line react-refresh/only-export-components
function PageFallback() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Outlet />
    </Suspense>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return null
  return isAuthenticated ? (
    <AppShell>
      <PageFallback />
    </AppShell>
  ) : (
    <Navigate to="/login" replace />
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <ProtectedLayout />,
    children: [
      { path: 'dashboard', element: <HomePage /> },
      { path: 'submit', element: <div>Submit Waste</div> },
      { path: 'collect', element: <CollectorDashboardPage /> },
      { path: 'incentives', element: <IncentivesMarketplacePage /> },
      { path: 'transfer', element: <div>Transfer</div> },
      { path: 'history', element: <div>History</div> },
      { path: 'dashboard/recycler', element: <RecyclerDashboard /> },
      { path: 'wastes', element: <WasteListPage /> },
      { path: 'manufacturer', element: <ManufacturerDashboardPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'rewards', element: <RewardsPage /> },
      { path: 'tracker', element: <SupplyChainTrackerPage /> },
      { path: 'community', element: <CommunityPage /> },
      { path: 'analytics', element: <AnalyticsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'search', element: <SearchResultsPage /> }
    ]
  },
  { path: '*', element: <NotFoundPage /> }
])
