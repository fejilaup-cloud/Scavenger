import { useState } from 'react'
import { Coins, Recycle, ArrowRightLeft, Heart, Package } from 'lucide-react'
import { useRewards } from '@/hooks/useRewards'
import { useWallet } from '@/context/WalletContext'
import { Role } from '@/api/types'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useAppTitle } from '@/hooks/useAppTitle'

// ── Donate dialog (simple confirm) ───────────────────────────────────────────

function DonateButton() {
  const [donated, setDonated] = useState(false)

  if (donated) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
        <Heart className="h-4 w-4 fill-current" />
        Donation submitted — thank you!
      </div>
    )
  }

  return (
    <Button
      variant="outline"
      onClick={() => setDonated(true)}
      className="gap-2"
    >
      <Heart className="h-4 w-4" />
      Donate to Charity
    </Button>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function RewardsPage() {
  useAppTitle('Rewards')
  const { address } = useWallet()
  const { stats, wastes, role, isLoading } = useRewards()

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to view your rewards.
      </div>
    )
  }

  const totalEarned = stats?.total_earned ?? 0n
  const materialsSubmitted = stats?.materials_submitted ?? 0
  const transfersCount = stats?.transfers_count ?? 0

  // Earnings breakdown: split total_earned proportionally by activity counts
  // Recyclers earn from submissions; Collectors earn from transfers
  const totalActivity = materialsSubmitted + transfersCount || 1
  const recyclingEarned = role === Role.Recycler
    ? totalEarned
    : (totalEarned * BigInt(materialsSubmitted)) / BigInt(totalActivity)
  const collectingEarned = role === Role.Collector
    ? totalEarned
    : (totalEarned * BigInt(transfersCount)) / BigInt(totalActivity)

  return (
    <div className="space-y-8 px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rewards</h1>
          <p className="mt-1 text-sm text-muted-foreground">Your token balance and earning history.</p>
        </div>
        <DonateButton />
      </div>

      {/* Balance + breakdown */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Coins className="h-4 w-4" />}
          label="Total Balance"
          value={isLoading ? '—' : totalEarned.toString()}
          variant="primary"
          isLoading={isLoading}
        />
        <StatCard
          icon={<Recycle className="h-4 w-4" />}
          label="From Recycling"
          value={isLoading ? '—' : recyclingEarned.toString()}
          variant="success"
          trendLabel={`${materialsSubmitted} submission${materialsSubmitted !== 1 ? 's' : ''}`}
          isLoading={isLoading}
        />
        <StatCard
          icon={<ArrowRightLeft className="h-4 w-4" />}
          label="From Collecting"
          value={isLoading ? '—' : collectingEarned.toString()}
          variant="warning"
          trendLabel={`${transfersCount} transfer${transfersCount !== 1 ? 's' : ''}`}
          isLoading={isLoading}
        />
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Transaction History</CardTitle>
          <span className="text-xs text-muted-foreground">Last 20 items</span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <div className="space-y-1.5">
                    <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
              ))}
            </div>
          ) : wastes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
              <Package className="h-8 w-8 opacity-40" />
              <p className="text-sm">No activity yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {wastes.map((waste) => {
                const weightNum = Number(waste.weight)
                const weightStr = weightNum >= 1000
                  ? `${(weightNum / 1000).toFixed(2)} kg`
                  : `${weightNum} g`

                return (
                  <div
                    key={waste.waste_id.toString()}
                    className="flex items-center justify-between py-3 text-sm"
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium">
                        {wasteTypeLabel(waste.waste_type)}{' '}
                        <span className="font-normal text-muted-foreground">
                          #{waste.waste_id.toString()}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {weightStr} · {formatDate(waste.recycled_timestamp)}
                      </p>
                    </div>
                    <Badge
                      variant={waste.is_confirmed ? 'default' : waste.is_active ? 'secondary' : 'outline'}
                    >
                      {waste.is_confirmed ? 'Confirmed' : waste.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
