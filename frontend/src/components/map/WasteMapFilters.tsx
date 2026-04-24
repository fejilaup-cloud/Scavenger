import { WasteType } from '@/api/types'
import { wasteTypeLabel } from '@/lib/helpers'
import { MapFilters } from '@/hooks/useMapData'
import { Select } from '@/components/ui/Select'
import { Switch } from '@/components/ui/Switch'

interface Props {
  filters: MapFilters
  onChange: (f: MapFilters) => void
}

const WASTE_TYPES = [WasteType.Paper, WasteType.PetPlastic, WasteType.Plastic, WasteType.Metal, WasteType.Glass]

export function WasteMapFilters({ filters, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
      {/* Waste type */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Type</label>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.wasteType ?? ''}
          onChange={(e) =>
            onChange({
              ...filters,
              wasteType: e.target.value === '' ? undefined : (Number(e.target.value) as WasteType),
            })
          }
        >
          <option value="">All types</option>
          {WASTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {wasteTypeLabel(t)}
            </option>
          ))}
        </select>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Status</label>
        <select
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          value={filters.status ?? 'all'}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as MapFilters['status'] })
          }
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="confirmed">Confirmed</option>
          <option value="pending">Pending</option>
        </select>
      </div>

      {/* Date from */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">From</label>
        <input
          type="date"
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          onChange={(e) =>
            onChange({
              ...filters,
              dateFrom: e.target.value ? new Date(e.target.value).getTime() / 1000 : undefined,
            })
          }
        />
      </div>

      {/* Date to */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">To</label>
        <input
          type="date"
          className="h-8 rounded-md border bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          onChange={(e) =>
            onChange({
              ...filters,
              dateTo: e.target.value ? new Date(e.target.value).getTime() / 1000 : undefined,
            })
          }
        />
      </div>

      {/* Show participants */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-muted-foreground">Participants</label>
        <Switch
          checked={filters.showParticipants ?? true}
          onCheckedChange={(v) => onChange({ ...filters, showParticipants: v })}
        />
      </div>
    </div>
  )
}
