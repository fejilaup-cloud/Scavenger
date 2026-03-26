import { useState } from 'react'
import type { PropsWithChildren } from 'react'
import { NavLink } from 'react-router-dom'
import { Menu, X, Wallet, LogOut, Recycle } from 'lucide-react'
import { useWallet } from '@/context/WalletContext'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const NAV_LINKS = [
  { label: 'Dashboard', href: '/', roles: ['Recycler', 'Collector', 'Manufacturer'] },
  { label: 'My Wastes', href: '/wastes', roles: ['Recycler', 'Collector', 'Manufacturer'] },
  { label: 'Submit Waste', href: '/submit', roles: ['Recycler'] },
  { label: 'Collect', href: '/collect', roles: ['Collector'] },
  { label: 'My Dashboard', href: '/manufacturer', roles: ['Manufacturer'] },
  { label: 'Incentives', href: '/incentives', roles: ['Manufacturer'] },
  { label: 'Transfer', href: '/transfer', roles: ['Recycler', 'Collector'] },
  { label: 'History', href: '/history', roles: ['Recycler', 'Collector', 'Manufacturer'] }
]

function truncate(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`
}

export function AppShell({ children }: PropsWithChildren) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
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
          onClick={() => setSidebarOpen(false)}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
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
            setSidebarOpen(false)
          }}
          className="mt-auto flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-accent"
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

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative z-50 w-56 bg-background shadow-xl">
            <button
              className="absolute right-3 top-3 rounded-sm p-1 hover:bg-accent"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
            {Sidebar}
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b px-4">
          <button
            className="rounded-md p-1 hover:bg-accent md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>

          <span className="text-sm font-medium md:hidden">Scavngr</span>

          <div className="ml-auto flex items-center gap-3">
            {isConnected && address ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
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
        <main className={cn('flex-1 p-6')}>{children}</main>
      </div>
    </div>
  )
}
