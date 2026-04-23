import { useState, useEffect } from 'react'
import { Search, Eye, ArrowRightLeft, CheckCircle, Recycle } from 'lucide-react'
import { useWasteList } from '@/hooks/useWasteList'
import { Material, WasteType } from '@/api/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { WasteCardSkeleton } from '@/components/ui/Skeletons'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddressDisplay } from '@/components/ui/AddressDisplay'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/Select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/Dialog'

const PAGE_SIZE = 10

const WASTE_LABELS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass'
}

type StatusFilter = 'all' | 'active' | 'confirmed' | 'inactive'

function getStatus(w: Material): StatusFilter {
  if (!w.is_active) return 'inactive'
  if (w.is_confirmed) return 'confirmed'
  return 'active'
}

function statusBadge(w: Material) {
  const s = getStatus(w)
  const map: Record<
    StatusFilter,
    { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
  > = {
    active: { label: 'Active', variant: 'default' },
    confirmed: { label: 'Confirmed', variant: 'secondary' },
    inactive: { label: 'Inactive', variant: 'outline' },
    all: { label: '', variant: 'outline' }
  }
  return <Badge variant={map[s].variant}>{map[s].label}</Badge>
}

export function WasteListPage() {
  const { wastes, isLoading, error, confirmWaste, transferWaste } = useWasteList()

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(1)

  // Detail dialog
  const [detailWaste, setDetailWaste] = useState<Material | null>(null)
  // Transfer dialog
  const [transferTarget, setTransferTarget] = useState<Material | null>(null)
  const [toAddress, setToAddress] = useState('')
  const [transferring, setTransferring] = useState(false)
  // Confirm-waste dialog
  const [confirmTarget, setConfirmTarget] = useState<Material | null>(null)
  // Transfer confirm dialog
  const [showTransferConfirm, setShowTransferConfirm] = useState(false)

  // Auto-open transfer dialog when navigated from collector dashboard (?transfer=<id>)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const transferId = params.get('transfer')
    if (transferId && wastes.length > 0) {
      const target = wastes.find((w) => String(w.id) === transferId)
      if (target) {
        setTransferTarget(target)
        setToAddress('')
      }
    }
  }, [wastes])

  const filtered = wastes.filter((w) => {
    if (search && !String(w.id).includes(search.trim())) return false
    if (typeFilter !== 'all' && w.waste_type !== Number(typeFilter)) return false
    if (statusFilter !== 'all' && getStatus(w) !== statusFilter) return false
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleFilterChange = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setPage(1)
  }

  const handleTransfer = async () => {
    if (!transferTarget || !toAddress.trim()) return
    setTransferring(true)
    try {
      await transferWaste(transferTarget.id, toAddress.trim())
      setShowTransferConfirm(false)
      setTransferTarget(null)
      setToAddress('')
    } finally {
      setTransferring(false)
    }
  }

  const handleConfirmWaste = () => {
    if (!confirmTarget) return
    confirmWaste(confirmTarget.id)
    setConfirmTarget(null)
  }

  return (
    <div className="space-y-4 overflow-x-hidden px-4 py-6 sm:px-0 sm:py-0">
      <h1 className="text-xl font-bold sm:text-2xl">My Wastes</h1>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative w-full sm:w-40">
          <label htmlFor="waste-search-input" className="sr-only">
            Search wastes by ID
          </label>
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="waste-search-input"
            className="pl-9"
            placeholder="Search ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
          />
        </div>

        <label htmlFor="waste-type-filter" className="sr-only">
          Filter wastes by type
        </label>
        <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
          <SelectTrigger id="waste-type-filter" className="w-full sm:w-36">
            <SelectValue placeholder="Waste type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(WASTE_LABELS).map(([val, label]) => (
              <SelectItem key={val} value={val}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label htmlFor="waste-status-filter" className="sr-only">
          Filter wastes by status
        </label>
        <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
          <SelectTrigger id="waste-status-filter" className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">ID</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Weight (kg)</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Submitted</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <WasteCardSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Recycle}
          title={
            search || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'No wastes match your filters'
              : 'No wastes yet'
          }
          description={
            search || typeFilter !== 'all' || statusFilter !== 'all'
              ? 'Try adjusting your search or filters'
              : 'Start by registering your first waste'
          }
        />
      ) : (
        <>
          {/* Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">ID</th>
                  <th className="px-4 py-3 text-left font-medium">Type</th>
                  <th className="px-4 py-3 text-left font-medium">Weight (kg)</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Submitted</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginated.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-mono">#{w.id}</td>
                    <td className="px-4 py-3">{WASTE_LABELS[w.waste_type]}</td>
                    <td className="px-4 py-3">{w.weight}</td>
                    <td className="px-4 py-3">{statusBadge(w)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(w.submitted_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`View details for waste #${w.id}`}
                          title="View details"
                          onClick={() => setDetailWaste(w)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {w.is_active && !w.is_confirmed && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Confirm waste #${w.id}`}
                              title="Confirm"
                              onClick={() => setConfirmTarget(w)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Transfer waste #${w.id}`}
                              title="Transfer"
                              onClick={() => {
                                setTransferTarget(w)
                                setToAddress('')
                              }}
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>
              {filtered.length} waste{filtered.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span>
                Page {page} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!detailWaste} onOpenChange={(o) => !o && setDetailWaste(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waste #{detailWaste?.id}</DialogTitle>
          </DialogHeader>
          {detailWaste && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Type</dt>
              <dd>{WASTE_LABELS[detailWaste.waste_type]}</dd>
              <dt className="text-muted-foreground">Weight</dt>
              <dd>{detailWaste.weight} kg</dd>
              <dt className="text-muted-foreground">Status</dt>
              <dd>{statusBadge(detailWaste)}</dd>
              <dt className="text-muted-foreground">Verified</dt>
              <dd>{detailWaste.verified ? 'Yes' : 'No'}</dd>
              <dt className="text-muted-foreground">Submitter</dt>
              <dd>
                <AddressDisplay address={detailWaste.submitter} showExplorer />
              </dd>
              <dt className="text-muted-foreground">Current Owner</dt>
              <dd>
                <AddressDisplay address={detailWaste.current_owner} showExplorer />
              </dd>
              {detailWaste.is_confirmed && (
                <>
                  <dt className="text-muted-foreground">Confirmer</dt>
                  <dd>
                    <AddressDisplay address={detailWaste.confirmer} showExplorer />
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Submitted</dt>
              <dd>{new Date(detailWaste.submitted_at * 1000).toLocaleString()}</dd>
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Waste #{transferTarget?.id}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label htmlFor="waste-transfer-recipient" className="text-sm font-medium">
              Recipient Address
            </label>
            <Input
              id="waste-transfer-recipient"
              placeholder="G…"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferTarget(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => setShowTransferConfirm(true)}
              disabled={transferring || !toAddress.trim()}
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer — transaction confirm */}
      <TransactionConfirmDialog
        open={showTransferConfirm}
        action="Transfer Waste"
        params={transferTarget ? [
          { label: 'Waste ID', value: `#${transferTarget.id}` },
          { label: 'Type', value: WASTE_LABELS[transferTarget.waste_type] },
          { label: 'Recipient', value: toAddress.trim() },
        ] : []}
        isPending={transferring}
        onConfirm={handleTransfer}
        onCancel={() => !transferring && setShowTransferConfirm(false)}
      />

      {/* Confirm Waste — transaction confirm */}
      <TransactionConfirmDialog
        open={!!confirmTarget}
        action="Confirm Waste"
        params={confirmTarget ? [
          { label: 'Waste ID', value: `#${confirmTarget.id}` },
          { label: 'Type', value: WASTE_LABELS[confirmTarget.waste_type] },
          { label: 'Weight', value: `${confirmTarget.weight} kg` },
        ] : []}
        isPending={false}
        onConfirm={handleConfirmWaste}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  )
}
