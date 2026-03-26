import { useState } from 'react'
import { Plus, PackageCheck, Zap, History, Loader2 } from 'lucide-react'
import { useManufacturerDashboard } from '@/hooks/useManufacturerDashboard'
import { WasteType } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'

const WASTE_TYPE_LABELS: Record<WasteType, string> = {
  [WasteType.Paper]: 'Paper',
  [WasteType.PetPlastic]: 'PET Plastic',
  [WasteType.Plastic]: 'Plastic',
  [WasteType.Metal]: 'Metal',
  [WasteType.Glass]: 'Glass',
}

export function ManufacturerDashboardPage() {
  const { pendingWastes, incentives, rewardHistory, isLoading, error, createIncentive, confirmWaste } =
    useManufacturerDashboard()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState({ wasteType: String(WasteType.Paper), rewardPoints: '', budget: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async () => {
    setSubmitting(true)
    try {
      await createIncentive(
        Number(form.wasteType) as WasteType,
        BigInt(form.rewardPoints),
        BigInt(form.budget)
      )
      setDialogOpen(false)
      setForm({ wasteType: String(WasteType.Paper), rewardPoints: '', budget: '' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Manufacturer Dashboard</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Incentive
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Pending Waste Confirmations */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <PackageCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Received Waste — Pending Confirmation</CardTitle>
            </CardHeader>
            <CardContent>
              {pendingWastes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending waste.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingWastes.map((w) => (
                    <li key={w.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {WASTE_TYPE_LABELS[w.waste_type]} — {w.weight.toString()} kg
                        </p>
                        <p className="text-xs text-muted-foreground">ID #{w.id}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => confirmWaste(w.id)}>
                        Confirm
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Active Incentives */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <Zap className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Active Incentives</CardTitle>
            </CardHeader>
            <CardContent>
              {incentives.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active incentives.</p>
              ) : (
                <ul className="space-y-3">
                  {incentives.map((inc) => (
                    <li key={inc.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{WASTE_TYPE_LABELS[inc.waste_type]}</p>
                        <p className="text-xs text-muted-foreground">
                          {inc.reward_points} pts/unit
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {inc.remaining_budget.toLocaleString()} left
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Reward Distribution History */}
          <Card className="md:col-span-2">
            <CardHeader className="flex flex-row items-center gap-2 pb-3">
              <History className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Reward Distribution History</CardTitle>
            </CardHeader>
            <CardContent>
              {rewardHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rewards distributed yet.</p>
              ) : (
                <ul className="space-y-3">
                  {rewardHistory.map((r, i) => (
                    <li key={i} className="flex items-center justify-between rounded-md border p-3">
                      <div className="space-y-0.5">
                        {r.wasteId > 0 && (
                          <p className="text-sm font-medium">
                            Waste #{r.wasteId} · Incentive #{r.incentiveId}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.distributedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>{r.amount.toLocaleString()} tokens</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Incentive Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Incentive</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Waste Type</label>
              <Select value={form.wasteType} onValueChange={(v) => setForm((f) => ({ ...f, wasteType: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(WASTE_TYPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reward Points (per unit)</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 100"
                value={form.rewardPoints}
                onChange={(e) => setForm((f) => ({ ...f, rewardPoints: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Total Budget (tokens)</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 10000"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={submitting || !form.rewardPoints || !form.budget}
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
