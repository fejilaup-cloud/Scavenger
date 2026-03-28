import { useState, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import { WasteType, Incentive } from '@/api/types'
import { wasteTypeLabel } from '@/lib/helpers'
import { useIncentives } from '@/hooks/useIncentives'

const WASTE_TYPES = [
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass,
]

interface Props {
  open: boolean
  onClose: () => void
  onSuccess?: (incentive: Incentive) => void
}

export function CreateIncentiveModal({ open, onClose, onSuccess }: Props) {
  const [wasteType, setWasteType]     = useState<WasteType>(WasteType.Paper)
  const [rewardInput, setRewardInput] = useState('')
  const [budgetInput, setBudgetInput] = useState('')
  const [isPending, setIsPending]     = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)

  const { createIncentive } = useIncentives()

  const rewardNum = parseFloat(rewardInput) || 0
  const budgetNum = parseFloat(budgetInput) || 0

  const estimatedCoverage = useMemo(() => {
    if (rewardNum <= 0 || budgetNum <= 0) return null
    const grams = Math.floor(budgetNum / rewardNum)
    return grams >= 1000
      ? `${(grams / 1000).toFixed(2)} kg`
      : `${grams} g`
  }, [rewardNum, budgetNum])

  function reset() {
    setWasteType(WasteType.Paper)
    setRewardInput('')
    setBudgetInput('')
    setError(null)
    setShowConfirm(false)
  }

  function handleClose() {
    if (isPending) return
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (rewardNum <= 0 || budgetNum <= 0) return
    setShowConfirm(true)
  }

  async function executeCreate() {
    const rewardPoints = BigInt(Math.round(rewardNum))
    const budget       = BigInt(Math.round(budgetNum))

    setIsPending(true)
    try {
      const incentive = await createIncentive(wasteType, rewardPoints, budget)
      onSuccess?.(incentive)
      reset()
      onClose()
    } catch (err) {
      setShowConfirm(false)
      setError(err instanceof Error ? err.message : 'Transaction failed')
    } finally {
      setIsPending(false)
    }
  }

  const canSubmit = rewardNum > 0 && budgetNum > 0 && !isPending

  return (
    <>
      <TransactionConfirmDialog
        open={showConfirm}
        action="Create Incentive"
        params={[
          { label: 'Waste type', value: wasteTypeLabel(wasteType) },
          { label: 'Reward per gram', value: `${rewardNum} pts` },
          { label: 'Total budget', value: `${budgetNum} pts` },
          ...(estimatedCoverage ? [{ label: 'Est. coverage', value: estimatedCoverage }] : []),
        ]}
        isPending={isPending}
        onConfirm={executeCreate}
        onCancel={() => !isPending && setShowConfirm(false)}
      />
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Incentive</DialogTitle>
          <DialogDescription>
            Set a reward for collectors who submit a specific waste type.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor="waste-type-trigger" className="text-sm font-medium">
              Waste type
            </label>
            <Select
              value={String(wasteType)}
              onValueChange={(v) => setWasteType(Number(v) as WasteType)}
            >
              <SelectTrigger id="waste-type-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WASTE_TYPES.map((t) => (
                  <SelectItem key={t} value={String(t)}>
                    {wasteTypeLabel(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label htmlFor="reward-input" className="text-sm font-medium">
              Reward per gram (pts)
            </label>
            <Input
              id="reward-input"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 10"
              value={rewardInput}
              onChange={(e) => setRewardInput(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="budget-input" className="text-sm font-medium">
              Total budget (pts)
            </label>
            <Input
              id="budget-input"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 10000"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              required
            />
          </div>

          {estimatedCoverage && (
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium">Estimated coverage</p>
              <p className="mt-0.5 text-muted-foreground">
                This budget covers approximately{' '}
                <span className="font-semibold text-foreground">{estimatedCoverage}</span>{' '}
                of {wasteTypeLabel(wasteType).toLowerCase()} at{' '}
                <span className="font-semibold text-foreground">{rewardNum} pts/g</span>.
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isPending ? 'Creating…' : 'Create incentive'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
