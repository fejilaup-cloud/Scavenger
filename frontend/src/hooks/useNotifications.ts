import { useState, useEffect, useRef } from 'react'
import { onSnapshot, collection, orderBy, limit, query } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { NotificationStore, type Notification } from '@/lib/notifications'

const MAX_NOTIFICATIONS = 20
const UNREAD_CAP = 99

export function useNotifications(walletAddress: string | null | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const storeRef = useRef<NotificationStore | null>(null)

  // Create/update store when walletAddress changes
  useEffect(() => {
    if (!walletAddress) {
      setNotifications([])
      storeRef.current = null
      return
    }

    storeRef.current = new NotificationStore(walletAddress)

    let unsubscribe: (() => void) | null = null
    let pollInterval: ReturnType<typeof setInterval> | null = null

    try {
      const col = collection(db, 'notifications', walletAddress, 'items')
      const q = query(col, orderBy('createdAt', 'desc'), limit(MAX_NOTIFICATIONS))

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const items: Notification[] = snapshot.docs.map((d) => d.data() as Notification)
          setNotifications(items)
        },
        (_err) => {
          // Firebase unavailable — fall back to localStorage polling
          if (unsubscribe) {
            unsubscribe()
            unsubscribe = null
          }
          startLocalStoragePolling()
        }
      )
    } catch {
      startLocalStoragePolling()
    }

    function startLocalStoragePolling() {
      const lsKey = `scavngr_notifications_${walletAddress}`
      const readFromLS = () => {
        try {
          const raw = localStorage.getItem(lsKey)
          const items: Notification[] = raw ? (JSON.parse(raw) as Notification[]) : []
          const sorted = [...items]
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, MAX_NOTIFICATIONS)
          setNotifications(sorted)
        } catch {
          setNotifications([])
        }
      }
      readFromLS()
      pollInterval = setInterval(readFromLS, 3000)
    }

    return () => {
      if (unsubscribe) unsubscribe()
      if (pollInterval) clearInterval(pollInterval)
    }
  }, [walletAddress])

  const unreadCount = Math.min(
    notifications.filter((n) => !n.read).length,
    UNREAD_CAP
  )

  const markRead = async (id: string): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.markRead(id)
  }

  const markAllRead = async (): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.markAllRead()
  }

  const deleteNotification = async (id: string): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.delete(id)
  }

  const addNotification = async (
    n: Omit<Notification, 'id' | 'read' | 'count'>
  ): Promise<void> => {
    if (!storeRef.current) return
    await storeRef.current.add(n)
  }

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    deleteNotification,
    addNotification,
  }
}
