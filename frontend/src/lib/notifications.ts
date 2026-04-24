import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  increment,
} from 'firebase/firestore'
import { db } from './firebase'

export type NotificationType = 'transfer' | 'confirmation' | 'reward' | 'system'

export interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  read: boolean
  createdAt: number
  count: number
}

export type NotificationPreferences = Record<NotificationType, boolean>

export const DEFAULT_PREFS: NotificationPreferences = {
  transfer: true,
  confirmation: true,
  reward: true,
  system: true,
}

const PREFS_KEY = 'scavngr_notif_prefs'
const LS_KEY = (address: string) => `scavngr_notifications_${address}`
const BATCH_WINDOW_MS = 10_000

function loadPrefs(): NotificationPreferences {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? (JSON.parse(raw) as NotificationPreferences) : { ...DEFAULT_PREFS }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function savePrefs(prefs: NotificationPreferences): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

function lsLoad(address: string): Notification[] {
  try {
    const raw = localStorage.getItem(LS_KEY(address))
    return raw ? (JSON.parse(raw) as Notification[]) : []
  } catch {
    return []
  }
}

function lsSave(address: string, notifications: Notification[]): void {
  localStorage.setItem(LS_KEY(address), JSON.stringify(notifications))
}

export class NotificationStore {
  private walletAddress: string

  constructor(walletAddress: string) {
    this.walletAddress = walletAddress
  }

  private col() {
    return collection(db, 'notifications', this.walletAddress, 'items')
  }

  async add(notification: Omit<Notification, 'id' | 'read' | 'count'>): Promise<void> {
    const prefs = loadPrefs()
    if (!prefs[notification.type]) return

    const now = Date.now()
    const windowStart = now - BATCH_WINDOW_MS

    try {
      const q = query(
        this.col(),
        where('type', '==', notification.type),
        where('read', '==', false),
        where('createdAt', '>=', windowStart),
        orderBy('createdAt', 'desc'),
      )
      const snap = await getDocs(q)

      if (!snap.empty) {
        const existing = snap.docs[0]
        await updateDoc(existing.ref, { count: increment(1) })
        return
      }

      const id = `${notification.type}_${now}`
      const newDoc: Notification = { ...notification, id, read: false, count: 1 }
      await setDoc(doc(this.col(), id), newDoc)
    } catch {
      // localStorage fallback
      const items = lsLoad(this.walletAddress)
      const recent = items.find(
        (n) =>
          n.type === notification.type &&
          !n.read &&
          n.createdAt >= windowStart,
      )
      if (recent) {
        recent.count += 1
      } else {
        const id = `${notification.type}_${now}`
        items.unshift({ ...notification, id, read: false, count: 1 })
      }
      lsSave(this.walletAddress, items)
    }
  }

  async markRead(id: string): Promise<void> {
    try {
      await updateDoc(doc(this.col(), id), { read: true })
    } catch {
      const items = lsLoad(this.walletAddress)
      const n = items.find((x) => x.id === id)
      if (n) n.read = true
      lsSave(this.walletAddress, items)
    }
  }

  async markAllRead(): Promise<void> {
    try {
      const snap = await getDocs(query(this.col(), where('read', '==', false)))
      await Promise.all(snap.docs.map((d) => updateDoc(d.ref, { read: true })))
    } catch {
      const items = lsLoad(this.walletAddress).map((n) => ({ ...n, read: true }))
      lsSave(this.walletAddress, items)
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await deleteDoc(doc(this.col(), id))
    } catch {
      const items = lsLoad(this.walletAddress).filter((n) => n.id !== id)
      lsSave(this.walletAddress, items)
    }
  }

  static loadPrefs = loadPrefs
  static savePrefs = savePrefs
}
