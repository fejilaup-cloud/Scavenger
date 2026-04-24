import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Home,
  Package,
  PlusCircle,
  Truck,
  Factory,
  Gift,
  ArrowRightLeft,
  History,
  Wallet,
  LogOut,
  Recycle,
  User
} from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { SearchBar } from '@/components/ui/SearchBar'
import { NotificationBell } from '@/components/ui/NotificationBell'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Home
  },
  {
    label: 'My Wastes',
    href: '/wastes',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Package
  },
  { label: 'Submit Waste', href: '/submit', roles: ['Recycler'], icon: PlusCircle },
  { label: 'Collect', href: '/collect', roles: ['Collector'], icon: Truck },
  { label: 'My Dashboard', href: '/manufacturer', roles: ['Manufacturer'], icon: Factory },
  {
    label: 'Incentives',
    href: '/incentives',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: Gift
  },
  { label: 'Transfer', href: '/transfer', roles: ['Recycler', 'Collector'], icon: ArrowRightLeft },
  {
    label: 'History',
    href: '/history',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: History
  },
  {
    label: 'Profile',
    href: '/profile',
    roles: ['Recycler', 'Collector', 'Manufacturer'],
    icon: User
  }
]

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export function AppShell({ children }: PropsWithChildren) {
  const { address, isConnected, connect, disconnect, isLoading } = useWallet()
  const { user, logout } = useAuth()

  const role = user?.role ?? ''
  const links = NAV_LINKS.filter((l) => !role || l.roles.includes(role))

  const Sidebar = (
    <nav className="flex flex-col gap-1 p-4">
      <div className="mb-4 flex items-center gap-2 px-2">
        <Recycle className="h-6 w-6 text-primary" />
        <span className="text-lg font-bold">Scavngr</span>
      </div>
      {links.map((link) => (
        <NavLink
          key={link.href}
          to={link.href}
          className={({ isActive }) =>
            cn(
              'flex min-h-11 items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive ? 'bg-accent text-accent-foreground' : 'text-foreground'
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
      {user && (
        <button
          onClick={() => {
            logout()
          }}
          className="mt-auto flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      )}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r md:flex md:flex-col">{Sidebar}</aside>

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <span className="text-sm font-medium md:hidden">Scavngr</span>

          <div className="mx-4 hidden flex-1 md:flex">
            <SearchBar />
          </div>

          <div className="ml-auto flex items-center gap-3">
            <NotificationBell />
            <ThemeToggle className="shrink-0" />

            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium sm:flex">
                  <Wallet className="h-3.5 w-3.5 text-primary" />
                  {truncate(address)}
                </span>
                <Button variant="ghost" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={connect} disabled={isLoading}>
                {isLoading ? 'Connecting…' : 'Connect Wallet'}
              </Button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className={cn('flex-1 overflow-x-hidden p-4 pb-20 sm:p-6 sm:pb-6')}>{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <div className="flex min-h-16 items-center justify-around gap-1 px-2 py-1">
          {links.filter((l) => l.href !== '/profile').slice(0, 4).map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.href}
                to={link.href}
                className={({ isActive }) =>
                  cn(
                    'flex min-h-12 min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                    isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  )
                }
              >
                <Icon className="mb-0.5 h-5 w-5" />
                <span className="truncate">{link.label}</span>
              </NavLink>
            )
          })}
          <NavLink
            to="/profile"
            className={({ isActive }) =>
              cn(
                'flex min-h-12 min-w-[3.5rem] flex-1 flex-col items-center justify-center rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )
            }
          >
            <User className="mb-0.5 h-5 w-5" />
            <span className="truncate">Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
