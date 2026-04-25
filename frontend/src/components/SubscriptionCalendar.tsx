import { useMemo } from 'react'
import { Subscription } from '@/lib/subscriptionStorage'
import { cn } from '@/lib/cn'

interface Props {
  subscriptions: Subscription[]
  month?: Date
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export function SubscriptionCalendar({ subscriptions, month = new Date() }: Props) {
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const daysInMonth = getDaysInMonth(year, monthIdx)
  const firstDay = getFirstDayOfWeek(year, monthIdx)

  // Map day-of-month → pickups scheduled that day
  const pickupsByDay = useMemo(() => {
    const map: Record<number, Subscription[]> = {}
    subscriptions
      .filter((s) => s.status === 'active')
      .forEach((s) => {
        const d = new Date(s.nextPickup)
        if (d.getFullYear() === year && d.getMonth() === monthIdx) {
          const day = d.getDate()
          map[day] = [...(map[day] ?? []), s]
        }
      })
    return map
  }, [subscriptions, year, monthIdx])

  const today = new Date()
  const todayDay =
    today.getFullYear() === year && today.getMonth() === monthIdx ? today.getDate() : -1

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const monthLabel = month.toLocaleString('default', { month: 'long', year: 'numeric' })

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-sm font-semibold">{monthLabel}</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={i}
            className={cn(
              'relative flex h-8 w-full items-center justify-center rounded-md text-xs',
              day === null && 'invisible',
              day === todayDay && 'bg-primary text-primary-foreground font-bold',
              day !== null && day !== todayDay && 'hover:bg-muted'
            )}
            title={
              day && pickupsByDay[day]
                ? pickupsByDay[day].map((s) => s.recyclerName).join(', ')
                : undefined
            }
          >
            {day}
            {day && pickupsByDay[day] && (
              <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-green-500" />
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        Scheduled pickup
      </div>
    </div>
  )
}
