import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import { useContract } from '@/context/ContractContext'
import { ScavengerClient } from '@/api/client'
import { Material } from '@/api/types'
import { getNetworkPassphrase } from '@/lib/stellar'

export function useWasteList() {
  const { address } = useWallet()
  const { config } = useContract()
  const [wastes, setWastes] = useState<Material[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const client = new ScavengerClient({
    rpcUrl: config.rpcUrl,
    networkPassphrase: getNetworkPassphrase(config.network),
    contractId: config.contractId,
  })

  const load = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const ids = await client.getParticipantWastes(address)
      const materials = await Promise.all(ids.map((id) => client.getMaterial(id)))
      setWastes(materials.filter((m): m is Material => m !== null))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load wastes')
    } finally {
      setIsLoading(false)
    }
  }, [address, config])

  useEffect(() => { load() }, [load])

  const confirmWaste = useCallback(async (wasteId: number) => {
    if (!address) return
    await client.confirmWaste(wasteId, address, address)
    await load()
  }, [address, config, load])

  const transferWaste = useCallback(async (wasteId: number, to: string) => {
    if (!address) return
    await client.transferWaste(wasteId, address, to, address)
    await load()
  }, [address, config, load])

  return { wastes, isLoading, error, reload: load, confirmWaste, transferWaste }
}
