import { useAppTitle } from '@/hooks/useAppTitle'
import { useCollectorDashboard } from '@/hooks/useCollectorDashboard'
import { useWallet } from '@/context/WalletContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { WasteType, Material } from '@/api/types'
import { formatTokenAmount, wasteTypeLabel, formatDate, formatAddress } from '@/lib/helpers'
import { Coins, ArrowDownToLine, Package, BarChart3 } from 'lucide-react'

const ALL_WASTE_TYPES = [
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass,
]

function WasteRow({ material, onTransfer }: { material: Material; onTransfer: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-4 py-3 text-sm">
      <div className="flex items-center gap-3">
        <Badge variant="secondary">{wasteTypeLabel(material.waste_type)}</Badge>
        <span className="text-muted-foreground">ID #{material.id}</span>
        <span>{material.weight.toLocaleString()} g</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{formatDate(material.submitted_at)}</span>
        <Button size="sm" variant="outline" onClick={() => onTransfer(material.id)}>
          Transfer
        </Button>
      </div>
    </div>
  )
}

export function CollectorDashboardPage() {
  useAppTitle('Collector Dashboard')
  const { address } = useWallet()
  const {
    tokenBalance,
    pendingTransfers,
    collectedWastes,
    stats,
    statsByWasteType,
    isLoading,
    error,
    refetch,
  } = useCollectorDashboard()

  const handleTransfer = (wasteId: number) => {
    // Navigate to transfer page with pre-filled waste ID
    window.location.href = `/transfer?wasteId=${wasteId}`
  }

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to view the dashboard.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading dashboard…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3 text-destructive">
        <p>{error}</p>
        <Button variant="outline" size="sm" onClick={refetch}>
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collector Dashboard</h1>
        <p className="text-sm text-muted-foreground">{formatAddress(address)}</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Coins className="h-4 w-4" /> Token Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatTokenAmount(tokenBalance)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ArrowDownToLine className="h-4 w-4" /> Pending Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{pendingTransfers.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4" /> Collected Wastes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{collectedWastes.length}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart3 className="h-4 w-4" /> Total Transfers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats?.transfers_count ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending incoming transfers */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending Incoming Transfers</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingTransfers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending transfers.</p>
          ) : (
            pendingTransfers.map((m) => (
              <WasteRow key={m.id} material={m} onTransfer={handleTransfer} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Collected wastes with transfer actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collected Wastes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {collectedWastes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No collected wastes yet.</p>
          ) : (
            collectedWastes.map((m) => (
              <WasteRow key={m.id} material={m} onTransfer={handleTransfer} />
            ))
          )}
        </CardContent>
      </Card>

      {/* Collection statistics by waste type */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Collection Statistics by Waste Type</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {ALL_WASTE_TYPES.map((type) => (
              <div
                key={type}
                className="flex flex-col items-center rounded-md border p-3 text-center"
              >
                <span className="text-xs text-muted-foreground">{wasteTypeLabel(type)}</span>
                <span className="mt-1 text-xl font-bold">{statsByWasteType[type] ?? 0}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
