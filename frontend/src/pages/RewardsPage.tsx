import { useState } from 'react'
import { Coins, Recycle, ArrowRightLeft, Heart, Package } from 'lucide-react'
import { useRewards } from '@/hooks/useRewards'
import { useWallet } from '@/context/WalletContext'
import { useDonateToCharity } from '@/hooks/useDonateToCharity'
import { Role } from '@/api/types'
import { wasteTypeLabel, formatDate } from '@/lib/helpers'
import { StatCard } from '@/components/ui/StatCard'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/Dialog'
import { useAppTitle } from '@/hooks/useAppTitle'

// ── Donate dialog ─────────────────────────────────────────────────────────────

function DonateButton({ balance }: { balance: bigint }) {
  const [open, setOpen] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [amount, setAmount] = useState('')
  const donate = useDonateToCharity()

  const parsed = amount ? BigInt(amount) : 0n
  const isInvalid = parsed <= 0n || parsed > balance

  const handleDonate = async () => {
    await donate.mutateAsync({ amount: parsed, balance })
    setShowConfirm(false)
    setOpen(false)
    setAmount('')
  }

  return (
    <>
      <TransactionConfirmDialog
        open={showConfirm}
        action="Donate to Charity"
        params={[
          { label: 'Amount', value: `${parsed.toLocaleString()} tokens` },
          { label: 'Remaining balance', value: `${(balance - parsed).toLocaleString()} tokens` },
        ]}
        isPending={donate.isPending}
        onConfirm={handleDonate}
        onCancel={() => !donate.isPending && setShowConfirm(false)}
      />
      <Button variant="outline" onClick={() => setOpen(true)} className="gap-2">
        <Heart className="h-4 w-4" />
        Donate to Charity
      </Button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Donate to Charity</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Available balance:{' '}
              <span className="font-medium text-foreground">{balance.toLocaleString()} tokens</span>
            </p>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount to donate</label>
              <Input
                type="number"
                min="1"
                max={balance.toString()}
                placeholder="e.g. 100"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amount && isInvalid && (
                <p className="text-xs text-destructive">
                  {parsed <= 0n
                    ? 'Amount must be greater than zero.'
                    : 'Amount exceeds your balance.'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowConfirm(true)} disabled={!amount || isInvalid}>
              Donate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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

  const totalActivity = materialsSubmitted + transfersCount || 1
  const recyclingEarned =
    role === Role.Recycler
      ? totalEarned
      : (totalEarned * BigInt(materialsSubmitted)) / BigInt(totalActivity)
  const collectingEarned =
    role === Role.Collector
      ? totalEarned
      : (totalEarned * BigInt(transfersCount)) / BigInt(totalActivity)

  return (
    <div className="space-y-6 px-4 py-6 sm:space-y-8 sm:py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Rewards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your token balance and earning history.
          </p>
        </div>
        <DonateButton balance={totalEarned} />
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
                const weightStr =
                  weightNum >= 1000 ? `${(weightNum / 1000).toFixed(2)} kg` : `${weightNum} g`

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
                      variant={
                        waste.is_confirmed ? 'default' : waste.is_active ? 'secondary' : 'outline'
                      }
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
