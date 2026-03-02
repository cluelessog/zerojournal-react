import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { ChartSkeleton } from '@/components/dashboard/ChartSkeleton'
import { ChartErrorBoundary } from '@/components/dashboard/ChartErrorBoundary'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const PnLTimelineChart = lazy(() =>
  import('@/components/dashboard/PnLTimelineChart').then((m) => ({ default: m.PnLTimelineChart }))
)
const WinLossDistribution = lazy(() =>
  import('@/components/dashboard/WinLossDistribution').then((m) => ({ default: m.WinLossDistribution }))
)
const TopSymbolsChart = lazy(() =>
  import('@/components/dashboard/TopSymbolsChart').then((m) => ({ default: m.TopSymbolsChart }))
)
const MonthlyVolumeChart = lazy(() =>
  import('@/components/dashboard/MonthlyVolumeChart').then((m) => ({ default: m.MonthlyVolumeChart }))
)
const TradingCalendar = lazy(() =>
  import('@/components/dashboard/TradingCalendar').then((m) => ({ default: m.TradingCalendar }))
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const analytics = usePortfolioStore((s) => s.analytics)
  const trades = usePortfolioStore((s) => s.trades)
  const symbolPnL = usePortfolioStore((s) => s.symbolPnL)
  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const isLoaded = usePortfolioStore((s) => s.isLoaded)

  const [tab, setTab] = useState<'overview' | 'analytics' | 'trades'>('overview')

  const startTime = useRef(performance.now())
  useEffect(() => {
    console.log(`Dashboard render: ${Math.round(performance.now() - startTime.current)}ms`)
  }, [])

  // Empty state: no data imported yet
  if (!isLoaded || !analytics || !pnlSummary || symbolPnL.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          title="No data yet"
          description="Import your Zerodha files to get started."
          action={
            <Button onClick={() => navigate('/import')}>
              Import Files
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>

      <Tabs value={tab} onValueChange={(value) => setTab(value as 'overview' | 'analytics' | 'trades')}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="trades">Trades</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="space-y-6 pt-4">
            {/* Metric Cards (2 rows of 4) — not lazy, no Recharts dependency */}
            <MetricsCards analytics={analytics} pnlSummary={pnlSummary} />

            {/* Row 3: P&L Timeline (full width) */}
            <ChartErrorBoundary chartName="P&L Timeline">
              <Suspense fallback={<ChartSkeleton height={300} />}>
                <PnLTimelineChart trades={trades} symbolPnL={symbolPnL} />
              </Suspense>
            </ChartErrorBoundary>

            {/* Row 4: Win/Loss Distribution + Monthly Volume (side by side) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartErrorBoundary chartName="Win/Loss Distribution">
                <Suspense fallback={<ChartSkeleton height={250} />}>
                  <WinLossDistribution symbolPnL={symbolPnL} />
                </Suspense>
              </ChartErrorBoundary>
              <ChartErrorBoundary chartName="Monthly Volume">
                <Suspense fallback={<ChartSkeleton height={250} />}>
                  <MonthlyVolumeChart trades={trades} />
                </Suspense>
              </ChartErrorBoundary>
            </div>

            {/* Row 5: Top Symbols (full width) */}
            <ChartErrorBoundary chartName="Top Symbols">
              <Suspense fallback={<ChartSkeleton height={350} />}>
                <TopSymbolsChart symbolPnL={symbolPnL} />
              </Suspense>
            </ChartErrorBoundary>

            {/* Row 6: Trading Calendar (full width) */}
            <ChartErrorBoundary chartName="Trading Calendar">
              <Suspense fallback={<ChartSkeleton height={200} />}>
                <TradingCalendar trades={trades} />
              </Suspense>
            </ChartErrorBoundary>
          </div>
        </TabsContent>

        {/* ── Analytics Tab ────────────────────────────────────────────── */}
        <TabsContent value="analytics">
          <div className="space-y-6 pt-4">
            {/* Row 1: Sharpe, Max DD, Min DU */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">Sharpe Ratio</div>
                <div className="mt-1 text-2xl font-bold">{analytics.sharpeRatio.toFixed(2)}</div>
                <div className="text-xs text-gray-500">Risk-adjusted returns</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</div>
                <div className="mt-1 text-2xl font-bold text-red-600">
                  {analytics.maxDrawdown.value.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {analytics.maxDrawdown.peakDate
                    ? `${analytics.maxDrawdown.peakDate} → ${analytics.maxDrawdown.troughDate}`
                    : 'No drawdown'}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">Min Drawup</div>
                <div className="mt-1 text-2xl font-bold text-green-600">
                  {analytics.minDrawup.value.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {analytics.minDrawup.troughDate
                    ? `Recovery: ${analytics.minDrawup.troughDate} → ${analytics.minDrawup.peakDate}`
                    : 'No drawup'}
                </div>
              </div>
            </div>

            {/* Row 2: Win/Loss Streaks */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Win/Loss Streaks</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Longest Win Streak</div>
                  <div className="mt-1 text-2xl font-bold text-green-600">
                    {analytics.streaks.longestWinStreak}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Longest Loss Streak</div>
                  <div className="mt-1 text-2xl font-bold text-red-600">
                    {analytics.streaks.longestLossStreak}
                  </div>
                </div>
                <div className="rounded-lg border p-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Current Streak</div>
                  <div
                    className={`mt-1 text-2xl font-bold ${
                      analytics.streaks.currentStreak.type === 'win' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {analytics.streaks.currentStreak.count}{' '}
                    {analytics.streaks.currentStreak.type === 'win' ? 'W' : 'L'}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Monthly Performance Table */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Monthly Performance</h3>
              {analytics.monthlyBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">No monthly data available.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Month</th>
                        <th className="px-4 py-2 text-right font-medium">Trades</th>
                        <th className="px-4 py-2 text-right font-medium">Gross P&amp;L</th>
                        <th className="px-4 py-2 text-right font-medium">Charges</th>
                        <th className="px-4 py-2 text-right font-medium">Net P&amp;L</th>
                        <th className="px-4 py-2 text-right font-medium">Win %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.monthlyBreakdown.map((m) => (
                        <tr key={m.month} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="px-4 py-2 font-medium">{m.month}</td>
                          <td className="px-4 py-2 text-right">{m.trades}</td>
                          <td className="px-4 py-2 text-right">{m.grossPnL.toFixed(2)}</td>
                          <td className="px-4 py-2 text-right">{m.charges.toFixed(2)}</td>
                          <td
                            className={`px-4 py-2 text-right font-semibold ${
                              m.netPnL >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {m.netPnL.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 text-right">{m.winRate.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ── Trades Tab ───────────────────────────────────────────────── */}
        <TabsContent value="trades">
          <div className="pt-4">
            <p className="text-sm text-gray-500">Navigate to the Trades page for detailed trade history.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
