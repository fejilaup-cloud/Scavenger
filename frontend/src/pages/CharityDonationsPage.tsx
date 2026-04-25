import { useState } from 'react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useCharityDonations } from '@/hooks/useCharityDonations'
import { useWallet } from '@/context/WalletContext'
import { Charity, CharityDonation } from '@/lib/charityStorage'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog'
import { TransactionConfirmDialog } from '@/components/ui/TransactionConfirmDialog'
import { Heart, Download, ExternalLink, History } from 'lucide-react'
import { formatTokenAmount, formatDate } from '@/lib/helpers'

// ── Charity Profile Card ──────────────────────────────────────────────────────

function CharityCard({
  charity,
  onDonate,
  onProfile,
}: {
  charity: Charity
  onDonate: (c: Charity) => void
  onProfile: (c: Charity) => void
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{charity.name}</CardTitle>
            <Badge variant="secondary" className="mt-1 text-xs">
              {charity.category}
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={() => onProfile(charity)}>
            Profile
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{charity.description}</p>
        <Button size="sm" className="w-full" onClick={() => onDonate(charity)}>
          <Heart className="mr-1 h-3 w-3" /> Donate
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Charity Profile Dialog ────────────────────────────────────────────────────

function CharityProfileDialog({
  charity,
  onClose,
  onDonate,
}: {
  charity: Charity | null
  onClose: () => void
  onDonate: (c: Charity) => void
}) {
  if (!charity) return null
  return (
    <Dialog open={!!charity} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{charity.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <Badge variant="secondary">{charity.category}</Badge>
          <p className="text-muted-foreground">{charity.description}</p>
          <div>
            <span className="font-medium">Contract Address: </span>
            <span className="break-all text-xs text-muted-foreground">{charity.address}</span>
          </div>
          {charity.website && (
            <a
              href={charity.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {charity.website}
            </a>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            onClick={() => {
              onClose()
              onDonate(charity)
            }}
          >
            <Heart className="mr-1 h-3 w-3" /> Donate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Donate Dialog ─────────────────────────────────────────────────────────────

function DonateDialog({
  charity,
  balance,
  isPending,
  onClose,
  onConfirm,
}: {
  charity: Charity | null
  balance: bigint
  isPending: boolean
  onClose: () => void
  onConfirm: (amount: bigint) => void
}) {
  const [amountStr, setAmountStr] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  if (!charity) return null

  const parsed = amountStr ? BigInt(amountStr) : 0n
  const invalid = parsed <= 0n || parsed > balance

  const handleSubmit = () => {
    if (invalid) return
    setShowConfirm(true)
  }

  return (
    <>
      <Dialog open={!!charity && !showConfirm} onOpenChange={(v) => !v && onClose()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Donate to {charity.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Available balance: <strong>{formatTokenAmount(balance)}</strong> tokens
            </p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Token Amount</label>
              <input
                type="number"
                min="1"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                placeholder="Enter amount"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value.replace(/\D/g, ''))}
              />
              {amountStr && invalid && (
                <p className="text-xs text-destructive">
                  {parsed <= 0n ? 'Amount must be greater than zero.' : 'Insufficient balance.'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={invalid || !amountStr}>
              Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TransactionConfirmDialog
        open={showConfirm}
        title={`Donate to ${charity.name}`}
        description={`You are donating ${formatTokenAmount(parsed)} tokens to ${charity.name}. This action cannot be undone.`}
        isLoading={isPending}
        onConfirm={() => onConfirm(parsed)}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}

// ── History Row ───────────────────────────────────────────────────────────────

function HistoryRow({
  donation,
  onDownload,
}: {
  donation: CharityDonation
  onDownload: (d: CharityDonation) => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{donation.charityName}</span>
        <Badge variant="outline">{formatTokenAmount(donation.tokenAmount)} tokens</Badge>
        <span className="text-xs text-muted-foreground">{formatDate(donation.timestamp / 1000)}</span>
      </div>
      <Button size="sm" variant="outline" onClick={() => onDownload(donation)}>
        <Download className="mr-1 h-3 w-3" /> Receipt
      </Button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function CharityDonationsPage() {
  useAppTitle('Charity Donations')
  const { address } = useWallet()
  const { charities, donations, totalDonated, balance, donate, downloadReceipt, isPending, error } =
    useCharityDonations(address)

  const [tab, setTab] = useState<'charities' | 'history'>('charities')
  const [donateTarget, setDonateTarget] = useState<Charity | null>(null)
  const [profileTarget, setProfileTarget] = useState<Charity | null>(null)

  if (!address) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Connect your wallet to donate to charities.
      </div>
    )
  }

  const handleConfirmDonate = async (amount: bigint) => {
    if (!donateTarget) return
    await donate({ charity: donateTarget, tokenAmount: amount })
    setDonateTarget(null)
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-0 sm:py-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Charity Donations</h1>
          <p className="text-sm text-muted-foreground">
            Total donated: <strong>{formatTokenAmount(totalDonated)}</strong> tokens
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border p-1 w-fit">
        {(['charities', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'charities' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {charities.map((c) => (
            <CharityCard
              key={c.id}
              charity={c}
              onDonate={setDonateTarget}
              onProfile={setProfileTarget}
            />
          ))}
        </div>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Donation History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {donations.length === 0 ? (
              <EmptyState
                icon={History}
                title="No donations yet"
                description="Your donation history will appear here"
              />
            ) : (
              donations.map((d) => (
                <HistoryRow key={d.id} donation={d} onDownload={downloadReceipt} />
              ))
            )}
          </CardContent>
        </Card>
      )}

      <CharityProfileDialog
        charity={profileTarget}
        onClose={() => setProfileTarget(null)}
        onDonate={(c) => { setProfileTarget(null); setDonateTarget(c) }}
      />

      <DonateDialog
        charity={donateTarget}
        balance={balance}
        isPending={isPending}
        onClose={() => setDonateTarget(null)}
        onConfirm={handleConfirmDonate}
      />
    </div>
  )
}
