import { BarChart3, TrendingUp, Package, Users } from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { useStats } from '@/hooks/useStats'
import { useAppTitle } from '@/hooks/useAppTitle'

export function AnalyticsPage() {
  useAppTitle('Analytics')
  const { totalWastes, isLoading } = useStats()

  const chartData = [
    { month: 'Jan', plastic: 45, metal: 30, glass: 25 },
    { month: 'Feb', plastic: 52, metal: 35, glass: 28 },
    { month: 'Mar', plastic: 61, metal: 42, glass: 33 },
    { month: 'Apr', plastic: 58, metal: 38, glass: 31 },
    { month: 'May', plastic: 67, metal: 45, glass: 36 },
    { month: 'Jun', plastic: 73, metal: 51, glass: 42 }
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Track waste management trends and performance metrics
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Package className="h-4 w-4" />}
          label="Total Waste Processed"
          value={Number(totalWastes)}
          trend="up"
          trendLabel="+12% from last month"
          isLoading={isLoading}
          variant="primary"
        />
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Active Participants"
          value={0}
          trend="up"
          trendLabel="+5 new this week"
          isLoading={isLoading}
          variant="success"
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Recycling Rate"
          value="87%"
          trend="up"
          trendLabel="+3% improvement"
          isLoading={isLoading}
          variant="default"
        />
        <StatCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Avg Processing Time"
          value="2.4 days"
          trend="down"
          trendLabel="15% faster"
          isLoading={isLoading}
          variant="warning"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Waste Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chartData[chartData.length - 1] && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Plastic</span>
                      <span className="font-medium">
                        {chartData[chartData.length - 1].plastic}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${chartData[chartData.length - 1].plastic}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Metal</span>
                      <span className="font-medium">{chartData[chartData.length - 1].metal}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${chartData[chartData.length - 1].metal}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Glass</span>
                      <span className="font-medium">{chartData[chartData.length - 1].glass}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-purple-500"
                        style={{ width: `${chartData[chartData.length - 1].glass}%` }}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {chartData.map((data) => (
                <div key={data.month} className="flex items-center gap-3">
                  <span className="w-12 text-sm text-muted-foreground">{data.month}</span>
                  <div className="flex flex-1 gap-1">
                    <div
                      className="h-8 rounded bg-blue-500/80"
                      style={{ width: `${data.plastic}%` }}
                      title={`Plastic: ${data.plastic}%`}
                    />
                    <div
                      className="h-8 rounded bg-green-500/80"
                      style={{ width: `${data.metal}%` }}
                      title={`Metal: ${data.metal}%`}
                    />
                    <div
                      className="h-8 rounded bg-purple-500/80"
                      style={{ width: `${data.glass}%` }}
                      title={`Glass: ${data.glass}%`}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-blue-500" />
                <span>Plastic</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-green-500" />
                <span>Metal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-3 w-3 rounded bg-purple-500" />
                <span>Glass</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
