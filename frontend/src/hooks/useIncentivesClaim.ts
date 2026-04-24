import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Incentive } from '@/api/types'
import { useToast } from '@/hooks/useToast'

/**
 * Mutation hook for claiming an incentive.
 *
 * Optimistically decrements `remaining_budget` in the TanStack Query cache
 * for the `['incentives', 'all']` query key. On error, rolls back to the
 * previous cache snapshot and shows an error toast.
 */
export function useIncentivesClaim() {
  const queryClient = useQueryClient()
  const toast = useToast()

  const mutation = useMutation<void, Error, number, { previousIncentives: Incentive[] | undefined }>({
    mutationFn: async (_incentiveId: number) => {
      // The actual on-chain claim is handled by distributeRewards in the contract.
      // Here we simulate the claim action — in a real integration this would call
      // ScavengerClient.distributeRewards or a dedicated claim endpoint.
      // For now we resolve immediately; the optimistic update handles the UI.
      return Promise.resolve()
    },

    onMutate: async (incentiveId: number) => {
      // Cancel any in-flight refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['incentives', 'all'] })

      // Snapshot the previous value for rollback
      const previousIncentives = queryClient.getQueryData<Incentive[]>(['incentives', 'all'])

      // Optimistically decrement remaining_budget
      queryClient.setQueryData<Incentive[]>(['incentives', 'all'], (old) => {
        if (!old) return old
        return old.map((inc) =>
          inc.id === incentiveId
            ? { ...inc, remaining_budget: Math.max(0, inc.remaining_budget - 1) }
            : inc
        )
      })

      return { previousIncentives }
    },

    onError: (_err, _incentiveId, context) => {
      // Roll back to the snapshot
      if (context?.previousIncentives !== undefined) {
        queryClient.setQueryData(['incentives', 'all'], context.previousIncentives)
      }
      toast.error('Failed to claim incentive. Please try again.')
    },

    onSettled: () => {
      // Always refetch after error or success to sync with server
      queryClient.invalidateQueries({ queryKey: ['incentives'] })
    },
  })

  return {
    claimIncentive: (incentiveId: number) => mutation.mutateAsync(incentiveId),
    isClaiming: mutation.isPending,
  }
}
