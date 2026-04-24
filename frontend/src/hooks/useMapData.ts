import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { Waste, Participant, WasteType } from '@/api/types'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'

export interface MapFilters {
  wasteType?: WasteType
  status?: 'all' | 'active' | 'confirmed' | 'pending'
  dateFrom?: number
  dateTo?: number
  showParticipants?: boolean
}

export interface WasteMapPoint {
  id: string
  lat: number
  lng: number
  waste: Waste
}

export interface ParticipantMapPoint {
  id: string
  lat: number
  lng: number
  participant: Participant
}

/** Coordinates are stored as i128 scaled by 1e7 (microdegrees * 10) */
function decodeCoord(raw: bigint): number {
  return Number(raw) / 1e7
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

export function useMapData(filters?: MapFilters) {
  const { address } = useWallet()
  const { config } = useContract()

  const { data: wastes = [], isLoading: wastesLoading } = useQuery<WasteMapPoint[]>({
    queryKey: ['map-wastes', address, filters],
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const ids = await client.getParticipantWastes(address)
      const results = await Promise.all(ids.map((id) => client.getWaste(id)))
      let items = results.filter((w): w is Waste => w !== null)

      // Apply filters
      if (filters?.wasteType !== undefined) {
        items = items.filter((w) => w.waste_type === filters.wasteType)
      }
      if (filters?.status && filters.status !== 'all') {
        if (filters.status === 'active') items = items.filter((w) => w.is_active)
        if (filters.status === 'confirmed') items = items.filter((w) => w.is_confirmed)
        if (filters.status === 'pending') items = items.filter((w) => w.is_active && !w.is_confirmed)
      }
      if (filters?.dateFrom) {
        items = items.filter((w) => w.recycled_timestamp >= (filters.dateFrom ?? 0))
      }
      if (filters?.dateTo) {
        items = items.filter((w) => w.recycled_timestamp <= (filters.dateTo ?? Infinity))
      }

      return items
        .map((w) => {
          const lat = decodeCoord(w.latitude)
          const lng = decodeCoord(w.longitude)
          return { id: String(w.waste_id), lat, lng, waste: w }
        })
        .filter((p) => isValidCoord(p.lat, p.lng))
    },
    enabled: !!address,
    staleTime: 2 * 60 * 1000,
  })

  const { data: participants = [], isLoading: participantsLoading } = useQuery<ParticipantMapPoint[]>({
    queryKey: ['map-participant', address],
    queryFn: async () => {
      if (!address) return []
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })
      const p = await client.getParticipant(address)
      if (!p) return []
      const lat = Number(p.latitude) / 1e7
      const lng = Number(p.longitude) / 1e7
      if (!isValidCoord(lat, lng)) return []
      return [{ id: p.address, lat, lng, participant: p }]
    },
    enabled: !!address && (filters?.showParticipants ?? true),
    staleTime: 5 * 60 * 1000,
  })

  return {
    wastes,
    participants,
    isLoading: wastesLoading || participantsLoading,
  }
}
