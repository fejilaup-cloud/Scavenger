import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import {
  addMutationToQueue,
  getPendingMutations,
  updateMutationStatus,
  removeMutationFromQueue,
  clearOldMutations
} from '@/lib/indexedDB'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { handleSyncConflict, detectConflict } from '@/lib/conflictResolution'
import { toast } from 'sonner'

interface OfflineMutationOptions<TData, TError, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>
  onSuccess?: (data: TData, variables: TVariables) => void
  onError?: (error: TError, variables: TVariables) => void
  onSettled?: (data: TData | undefined, error: TError | null, variables: TVariables) => void
  mutationKey?: string[]
}

export function useOfflineMutation<TData = unknown, TError = unknown, TVariables = unknown>({
  mutationFn,
  onSuccess,
  onError,
  onSettled,
  mutationKey = [],
}: OfflineMutationOptions<TData, TError, TVariables>) {
  const queryClient = useQueryClient()
  const isOnline = useOnlineStatus()

  const mutation = useMutation({
    mutationFn,
    onSuccess,
    onError,
    onSettled,
  })

  const executeOfflineMutation = useCallback(async (variables: TVariables) => {
    const mutationId = uuidv4()

    if (!isOnline) {
      // Queue mutation for offline
      await addMutationToQueue({
        id: mutationId,
        mutationKey,
        variables,
      })

      toast.info('Action queued for when connection is restored')
      return { queued: true, id: mutationId }
    }

    // Execute immediately if online
    return mutation.mutateAsync(variables)
  }, [isOnline, mutation, mutationKey])

  // Sync pending mutations when coming back online
  useEffect(() => {
    if (isOnline) {
      const syncPendingMutations = async () => {
        const pendingMutations = await getPendingMutations()

        for (const pendingMutation of pendingMutations) {
          try {
            await updateMutationStatus(pendingMutation.id, 'pending', pendingMutation.retryCount + 1)

            const result = await mutationFn(pendingMutation.variables)

            // Check for conflicts by comparing with current query cache
            const queryKey = pendingMutation.mutationKey
            const cachedData = queryClient.getQueryData(queryKey)

            if (cachedData && detectConflict(cachedData, result)) {
              // Handle conflict resolution
              const resolvedData = await handleSyncConflict(
                JSON.stringify(queryKey),
                cachedData,
                result,
                'remote-wins' // Default strategy
              )

              // Update query cache with resolved data
              queryClient.setQueryData(queryKey, resolvedData)

              toast.warning('Data conflict resolved during sync')
            }

            // Call success callback if provided
            if (onSuccess) {
              onSuccess(result, pendingMutation.variables)
            }

            await updateMutationStatus(pendingMutation.id, 'synced')
            await removeMutationFromQueue(pendingMutation.id)

            toast.success('Offline action synced successfully')
          } catch (error) {
            // Increment retry count
            const newRetryCount = pendingMutation.retryCount + 1

            if (newRetryCount >= 3) {
              // Mark as failed after 3 retries
              await updateMutationStatus(pendingMutation.id, 'failed', newRetryCount)
              toast.error('Failed to sync offline action after multiple attempts')

              if (onError) {
                onError(error as TError, pendingMutation.variables)
              }
            } else {
              // Keep as pending for retry
              await updateMutationStatus(pendingMutation.id, 'pending', newRetryCount)
            }
          }
        }

        // Clean up old mutations
        await clearOldMutations()
      }

      syncPendingMutations()
    }
  }, [isOnline, mutationFn, onSuccess, onError, queryClient])

  return {
    ...mutation,
    mutateAsync: executeOfflineMutation,
    isOnline,
  }
}