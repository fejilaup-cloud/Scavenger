import React, { useState } from 'react'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import { useOfflineMutation } from '@/hooks/useOfflineMutation'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Wifi, WifiOff, Send, Clock } from 'lucide-react'

// Mock API call that simulates network request
const mockApiCall = async (data: any): Promise<any> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000))

  // Simulate occasional failures
  if (Math.random() < 0.1) {
    throw new Error('Network error')
  }

  return {
    id: Date.now(),
    ...data,
    timestamp: new Date().toISOString(),
    status: 'success'
  }
}

export function OfflineDemo() {
  const isOnline = useOnlineStatus()
  const [submittedData, setSubmittedData] = useState<any[]>([])

  const mutation = useOfflineMutation({
    mutationFn: mockApiCall,
    onSuccess: (result) => {
      setSubmittedData(prev => [...prev, result])
    },
    mutationKey: ['demo-submission'],
  })

  const handleSubmit = async () => {
    const data = {
      message: `Demo submission ${Date.now()}`,
      userAgent: navigator.userAgent,
    }

    try {
      const result = await mutation.mutateAsync(data)
      console.log('Submission result:', result)
    } catch (error) {
      console.error('Submission failed:', error)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Offline Functionality Demo</h1>
        <p className="text-muted-foreground">
          Test the offline capabilities of the Scavenger application
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isOnline ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-500" />}
            Connection Status
          </CardTitle>
          <CardDescription>
            Current online/offline status and functionality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={isOnline ? 'default' : 'destructive'}>
              {isOnline ? 'Online' : 'Offline'}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {isOnline
                ? 'All features are available'
                : 'Mutations will be queued and synced when connection is restored'
              }
            </span>
          </div>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleSubmit}
              disabled={mutation.isPending}
              className="flex items-center gap-2"
            >
              {mutation.isPending ? (
                <Clock className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {isOnline ? 'Submit Data' : 'Queue Data'}
            </Button>

            {mutation.isPending && (
              <span className="text-sm text-muted-foreground">
                Processing...
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submitted Data</CardTitle>
          <CardDescription>
            Data that has been successfully submitted (online) or queued (offline)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submittedData.length === 0 ? (
            <p className="text-muted-foreground">No data submitted yet</p>
          ) : (
            <div className="space-y-2">
              {submittedData.map((item, index) => (
                <div key={item.id || index} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">{item.message}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted: {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline">{item.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How to Test Offline Functionality</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Open browser developer tools (F12)</li>
            <li>Go to Network tab and set throttling to "Offline"</li>
            <li>Click "Submit Data" - it should show "Queue Data" and queue the action</li>
            <li>Restore connection by setting throttling back to "No throttling"</li>
            <li>The queued action should automatically sync</li>
            <li>Check the console for sync messages</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}