import { useState, useRef } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { NotificationPanel } from '@/components/ui/NotificationPanel'
import { useNotifications } from '@/hooks/useNotifications'
import { useWallet } from '@/context/WalletContext'
import { cn } from '@/lib/utils'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { address } = useWallet()
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification } =
    useNotifications(address)
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLDivElement>(null)

  const badgeLabel = unreadCount > 99 ? '99+' : String(unreadCount)
  const showBadge = unreadCount > 0

  return (
    <div ref={bellRef} className={cn('relative', className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Notifications${showBadge ? `, ${badgeLabel} unread` : ''}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Bell className="h-4 w-4" />
        {showBadge && (
          <span
            className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold leading-none text-destructive-foreground"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </Button>

      {open && (
        <NotificationPanel
          notifications={notifications}
          onClose={() => setOpen(false)}
          onMarkRead={markRead}
          onMarkAllRead={markAllRead}
          onDelete={deleteNotification}
        />
      )}
    </div>
  )
}
