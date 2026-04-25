import { useState } from 'react'
import { useAppTitle } from '@/hooks/useAppTitle'
import { useImpactCalculator } from '@/hooks/useImpactCalculator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Leaf, Zap, Droplets, Trees, Car, Smartphone, ShowerHead, Lightbulb, Share2, Check } from 'lucide-react'

// ── Impact metric card ────────────────────────────────────────────────────────

function ImpactCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  unit: string
  color: string
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <div className={`rounded-full p-3 ${color}`}>{icon}</div>
        <p className="text-3xl font-bold">{value.toLocaleString()}</p>
        <p className="text-sm font-medium">{unit}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  )
}

// ── Equivalent row ────────────────────────────────────────────────────────────

function EquivalentRow({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode
  value: number
  label: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-4 py-3">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <span className="font-semibold">{value.toLocaleString()}</span>{' '}
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ImpactCalculatorPage() {
  useAppTitle('Environmental Impact')
  const { impact, equivalents, shareText, isLoading, isError } = useImpactCalculator()
  const [copied, setCopied] = useState(false)

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ text: shareText }).catch(() => null)
    } else {
      await navigator.clipboard.writeText(shareText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return <p className="text-destructive">Failed to load waste data.</p>
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-0 sm:py-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Environmental Impact</h1>
          <p className="text-sm text-muted-foreground">
            The positive impact of your recycling activities
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={handleShare}>
          {copied ? (
            <><Check className="mr-1 h-4 w-4 text-green-500" /> Copied</>
          ) : (
            <><Share2 className="mr-1 h-4 w-4" /> Share</>
          )}
        </Button>
      </div>

      {/* Main impact metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ImpactCard
          icon={<Leaf className="h-6 w-6 text-green-600" />}
          label="CO₂ Saved"
          value={impact.co2Kg}
          unit="kg CO₂"
          color="bg-green-100 dark:bg-green-900/30"
        />
        <ImpactCard
          icon={<Zap className="h-6 w-6 text-yellow-600" />}
          label="Energy Saved"
          value={impact.energyKwh}
          unit="kWh"
          color="bg-yellow-100 dark:bg-yellow-900/30"
        />
        <ImpactCard
          icon={<Droplets className="h-6 w-6 text-blue-600" />}
          label="Water Saved"
          value={impact.waterLitres}
          unit="litres"
          color="bg-blue-100 dark:bg-blue-900/30"
        />
        <ImpactCard
          icon={<Trees className="h-6 w-6 text-emerald-600" />}
          label="Trees Equivalent"
          value={impact.treesEquivalent}
          unit="tree-years"
          color="bg-emerald-100 dark:bg-emerald-900/30"
        />
      </div>

      {/* Everyday equivalents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">That's equivalent to…</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <EquivalentRow
            icon={<Car className="h-4 w-4" />}
            value={equivalents.carKm}
            label="km not driven"
          />
          <EquivalentRow
            icon={<Smartphone className="h-4 w-4" />}
            value={equivalents.smartphoneCharges}
            label="smartphone charges"
          />
          <EquivalentRow
            icon={<ShowerHead className="h-4 w-4" />}
            value={equivalents.showerMinutes}
            label="minutes of showering saved"
          />
          <EquivalentRow
            icon={<Lightbulb className="h-4 w-4" />}
            value={equivalents.lightbulbHours}
            label="hours of LED lighting"
          />
        </CardContent>
      </Card>

      {/* Share preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Share your impact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="rounded-md bg-muted px-4 py-3 text-sm leading-relaxed">{shareText}</p>
          <Button onClick={handleShare} className="w-full sm:w-auto">
            {copied ? (
              <><Check className="mr-1 h-4 w-4" /> Copied to clipboard</>
            ) : (
              <><Share2 className="mr-1 h-4 w-4" /> Share on Social Media</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
