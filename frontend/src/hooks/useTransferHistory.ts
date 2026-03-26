import { useQuery } from '@tanstack/react-query'
import { ScavengerClient } from '@/api/client'
import { WasteTransfer } from '@/api/types'
import { useContract } from '@/context/ContractContext'
import { networkConfig } from '@/lib/stellar'

export function useTransferHistory(wasteId: number | bigint | undefined) {
  const { config } = useContract()

  const { data, isLoading, isError } = useQuery<WasteTransfer[]>({
    queryKey: ['transfer-history', wasteId?.toString()],
    queryFn: async () => {
      const client = new ScavengerClient({
        rpcUrl: config.rpcUrl,
        networkPassphrase: networkConfig.networkPassphrase,
        contractId: config.contractId,
      })

      if (typeof wasteId === 'bigint') {
        return client.getWasteTransferHistoryV2(wasteId)
      }

      return client.getTransferHistory(wasteId as number)
    },
    enabled: wasteId !== undefined,
  })

  return {
    history: data ?? [],
    isLoading,
    isError,
  }
}
