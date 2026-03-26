import { useQuery } from '@tanstack/react-query'
import { Incentive, WasteType } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'
import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@/context/WalletContext'
import { ScavengerClient } from '@/api/client'
import { getNetworkPassphrase } from '@/lib/stellar'

const INCENTIVES_STALE_TIME = 30 * 1000 // 30 seconds

const ALL_WASTE_TYPES = [
  WasteType.Paper,
  WasteType.PetPlastic,
  WasteType.Plastic,
  WasteType.Metal,
  WasteType.Glass,
]


export function useIncentives(wasteType?: WasteType) {
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<Incentive[]>({
    queryKey: ['incentives', wasteType ?? 'all'],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })

      if (wasteType !== undefined) {
        return client.getIncentives(wasteType)
      }

      return client.getAllActiveIncentives()
    },
    staleTime: INCENTIVES_STALE_TIME,
  })
  
    const client = new ScavengerClient({
    rpcUrl: config.rpcUrl,
    networkPassphrase: getNetworkPassphrase(config.network),
    contractId: config.contractId,
  })

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const idSets = await Promise.all(
        ALL_WASTE_TYPES.map((wt) => client.getIncentivesByWasteType(wt))
      )
      const allIds = [...new Set(idSets.flat())]
      const results = await Promise.all(allIds.map((id) => client.getIncentiveById(id)))
      setIncentives(results.filter((i): i is Incentive => i !== null && i.active))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load incentives')
    } finally {
      setIsLoading(false)
    }
  }, [config])

  useEffect(() => { load() }, [load])

  const createIncentive = useCallback(
    async (wasteType: WasteType, rewardPoints: bigint, budget: bigint) => {
      if (!address) return
      await client.createIncentive(address, wasteType, rewardPoints, budget, address)
      await load()
    },
    [address, config, load]
  )

  const updateIncentive = useCallback(
    async (id: number, rewardPoints: bigint, budget: bigint) => {
      if (!address) return
      await client.updateIncentive(id, rewardPoints, budget, address)
      await load()
    },
    [address, config, load]
  )

  const deactivateIncentive = useCallback(
    async (id: number) => {
      if (!address) return
      await client.deactivateIncentive(address, id, address)
      await load()
    },
    [address, config, load]
  )

  return {
    incentives: data ?? [],
    isLoading,
    isError, isLoading, error, address, createIncentive, updateIncentive, deactivateIncentive
  }
}
