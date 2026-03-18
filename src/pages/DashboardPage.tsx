import { lazy, Suspense, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { ExpectancyCards } from '@/components/dashboard/ExpectancyCards'
import { TradingStyleSection } from '@/components/dashboard/TradingStyleSection'
import { ChartSkeleton } from '@/components/dashboard/ChartSkeleton'
import { ChartErrorBoundary } from '@/components/dashboard/ChartErrorBoundary'
import { CapitalInput } from '@/components/dashboard/CapitalInput'
import { KeyInsights } from '@/components/dashboard/KeyInsights'
import { generateInsights } from '@/lib/engine/insights'
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
const RollingExpectancyChart = lazy(() =>
  import('@/components/dashboard/RollingExpectancyChart').then((m) => ({ default: m.RollingExpectancyChart }))
)
const CumulativeMetricsGrid = lazy(() =>
  import('@/components/dashboard/CumulativeMetricsGrid').then((m) => ({ default: m.CumulativeMetricsGrid }))
)
const HoldingPeriodChart = lazy(() =>
  import('@/components/dashboard/HoldingPeriodChart').then((m) => ({ default: m.HoldingPeriodChart }))
)
const DurationDistributionChart = lazy(() =>
  import('@/components/dashboard/DurationDistributionChart').then((m) => ({ default: m.DurationDistributionChart }))
)
const PnLBarCharts = lazy(() =>
  import('@/components/dashboard/PnLBarCharts').then((m) => ({ default: m.PnLBarCharts }))
)
const MonthlyExpectancyChart = lazy(() =>
  import('@/components/dashboard/MonthlyExpectancyChart').then((m) => ({ default: m.MonthlyExpectancyChart }))
)

export default function DashboardPage() {
  const navigate = useNavigate()
  const analytics = usePortfolioStore((s) => s.analytics)
  const trades = usePortfolioStore((s) => s.trades)
  const symbolPnL = usePortfolioStore((s) => s.symbolPnL)
  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const isLoaded = usePortfolioStore((s) => s.isLoaded)
  const initialCapital = usePortfolioStore((s) => s.initialCapital)

  const [tab, setTab] = useState<'overview' | 'analytics' | 'trades'>('overview')

  const insights = useMemo(() => {
    if (!analytics) return []
    return generateInsights(analytics)
  }, [analytics])

  const styleStreaks = analytics?.styleStreaks ?? null

  const monthTradeCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of trades) {
      const m = t.tradeDate.slice(0, 7)
      map.set(m, (map.get(m) ?? 0) + 1)
    }
    return map
  }, [trades])


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
        <TabsList className="overflow-x-auto flex-shrink-0 flex-nowrap">
          <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
          <TabsTrigger value="analytics" className="flex-shrink-0">Analytics</TabsTrigger>
          <TabsTrigger value="trades" className="flex-shrink-0">Trades</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ─────────────────────────────────────────────── */}
        <TabsContent value="overview">
          <div className="space-y-6 pt-4">
            {/* Metric Cards (2 rows of 4) — not lazy, no Recharts dependency */}
            <MetricsCards
              analytics={analytics}
              pnlSummary={pnlSummary}
              monthlyBreakdown={analytics.monthlyBreakdown}
            />

            {/* Row 3: P&L Timeline (full width) */}
            <ChartErrorBoundary chartName="P&L Timeline">
              <Suspense fallback={<ChartSkeleton height={300} />}>
                <PnLTimelineChart trades={trades} symbolPnL={symbolPnL} />
              </Suspense>
            </ChartErrorBoundary>

            {/* P&L by Period (horizontal bars) */}
            <ChartErrorBoundary chartName="P&L by Period">
              <Suspense fallback={<ChartSkeleton height={400} />}>
                <PnLBarCharts trades={trades} symbolPnL={symbolPnL} />
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
                <TopSymbolsChart symbolPnL={symbolPnL} fifoMatches={analytics.fifoMatches} />
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
            {/* Row 0: Key Insights */}
            <KeyInsights insights={insights} totalTrades={analytics.totalTrades} />

            {/* Row 1: Sharpe, Max DD, Min DU */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <div
                  className="text-sm text-gray-600 dark:text-gray-400"
                  title="Sharpe Ratio uses daily invested capital for percentage returns (standard methodology)"
                >
                  Sharpe Ratio
                </div>
                <div className="mt-1 text-2xl font-bold">{analytics.sharpeRatio.toFixed(2)}</div>
                <div className="text-xs text-gray-500">Risk-adjusted returns</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-gray-600 dark:text-gray-400">Max Drawdown</div>
                {analytics.maxDrawdown.status === 'no_data' ? (
                  <>
                    <div className="mt-1 text-2xl font-bold text-gray-400">No data</div>
                    <div className="text-xs text-gray-500">No closed positions</div>
                  </>
                ) : analytics.maxDrawdown.value === 0 ? (
                  <>
                    <div className="mt-1 text-2xl font-bold text-green-600">No drawdown</div>
                    <div className="text-xs text-gray-500">Equity curve is flat or rising</div>
                  </>
                ) : analytics.maxDrawdown.mode === 'absolute' ? (
                  <>
                    <div className="mt-1 text-2xl font-bold text-red-600">
                      Rs. {Math.abs(analytics.maxDrawdown.value).toLocaleString('en-IN')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {analytics.maxDrawdown.peakDate
                        ? `${analytics.maxDrawdown.peakDate} → ${analytics.maxDrawdown.troughDate}`
                        : ''}
                    </div>
                    <div className="mt-2">
                      <CapitalInput />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="mt-1 text-2xl font-bold text-red-600">
                      {analytics.maxDrawdown.value.toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-500">
                      {analytics.maxDrawdown.peakDate
                        ? `${analytics.maxDrawdown.peakDate} → ${analytics.maxDrawdown.troughDate}`
                        : 'No drawdown'}
                    </div>
                  </>
                )}
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
              <h3 className="text-lg font-semibold">Win/Loss Streaks (by trading day)</h3>
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
                      analytics.streaks.currentStreak.type === 'win' ? 'text-green-600' : analytics.streaks.currentStreak.type === 'loss' ? 'text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {analytics.streaks.currentStreak.count}{' '}
                    {analytics.streaks.currentStreak.type === 'win' ? 'W' : analytics.streaks.currentStreak.type === 'loss' ? 'L' : '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2b: Streaks by Trading Style */}
            {styleStreaks && (styleStreaks.intraday || styleStreaks.swing) ? (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400">By Trading Style (consecutive positions)</h4>
                {styleStreaks.intraday && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500">Intraday</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Longest Win</div>
                        <div className="mt-0.5 text-lg font-bold text-green-600">{styleStreaks.intraday.longestWinStreak}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Longest Loss</div>
                        <div className="mt-0.5 text-lg font-bold text-red-600">{styleStreaks.intraday.longestLossStreak}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Current</div>
                        <div className={`mt-0.5 text-lg font-bold ${styleStreaks.intraday.currentStreak.type === 'win' ? 'text-green-600' : styleStreaks.intraday.currentStreak.type === 'loss' ? 'text-red-600' : 'text-gray-500'}`}>
                          {styleStreaks.intraday.currentStreak.count} {styleStreaks.intraday.currentStreak.type === 'win' ? 'W' : styleStreaks.intraday.currentStreak.type === 'loss' ? 'L' : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {styleStreaks.swing && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-gray-500">Swing</p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Longest Win</div>
                        <div className="mt-0.5 text-lg font-bold text-green-600">{styleStreaks.swing.longestWinStreak}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Longest Loss</div>
                        <div className="mt-0.5 text-lg font-bold text-red-600">{styleStreaks.swing.longestLossStreak}</div>
                      </div>
                      <div className="rounded-lg border p-3">
                        <div className="text-xs text-gray-600 dark:text-gray-400">Current</div>
                        <div className={`mt-0.5 text-lg font-bold ${styleStreaks.swing.currentStreak.type === 'win' ? 'text-green-600' : styleStreaks.swing.currentStreak.type === 'loss' ? 'text-red-600' : 'text-gray-500'}`}>
                          {styleStreaks.swing.currentStreak.count} {styleStreaks.swing.currentStreak.type === 'win' ? 'W' : styleStreaks.swing.currentStreak.type === 'loss' ? 'L' : '-'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : styleStreaks && !styleStreaks.intraday && !styleStreaks.swing ? (
              <p className="text-xs text-gray-500">Not enough trades per style (need 20+)</p>
            ) : null}

            {/* Row 3: Expectancy + Risk-Reward Cards */}
            <ExpectancyCards
              expectancy={analytics.expectancy}
              riskReward={analytics.riskReward}
            />

            {/* Row 4: Trading Style Classification */}
            <TradingStyleSection tradingStyles={analytics.tradingStyles} />

            {/* Row 5: Monthly Performance Table */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Monthly Performance</h3>
              {analytics.monthlyBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">No monthly data available.</p>
              ) : (
                <>
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
                          <th
                            className="px-4 py-2 text-right font-medium"
                            title={initialCapital ? 'Percentage drawdown (based on initial capital)' : 'Values shown in INR when no capital is set'}
                          >Max DD{initialCapital ? ' %' : ''}</th>
                          <th className="px-4 py-2 text-right font-medium" title="Expectancy (INR/trade) for all trades closing this month">Exp.</th>
                          <th className="px-4 py-2 text-right font-medium" title="Intraday expectancy (INR/trade)">Intra.</th>
                          <th className="px-4 py-2 text-right font-medium" title="Swing expectancy (INR/trade)">Swing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.monthlyBreakdown.map((m) => {
                          const sparseMonth = (monthTradeCounts.get(m.month) ?? 0) < 5
                          return (
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
                            <td
                              className={`px-4 py-2 text-right ${m.maxDrawdown < 0 ? 'text-red-600' : 'text-gray-600'} ${sparseMonth ? 'text-gray-400 italic' : ''}`}
                              title={sparseMonth ? 'Based on limited data (< 5 trades)' : undefined}
                            >
                              {m.maxDrawdownMode === 'absolute'
                                ? `Rs. ${Math.abs(m.maxDrawdown).toLocaleString('en-IN')}`
                                : `${m.maxDrawdown.toFixed(1)}%`}
                              {sparseMonth ? '*' : ''}
                            </td>
                            <td className={`px-4 py-2 text-right ${m.overallExpectancy != null ? (m.overallExpectancy >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                              {m.overallExpectancy != null ? m.overallExpectancy.toFixed(2) : '—'}
                            </td>
                            <td className={`px-4 py-2 text-right ${m.intradayExpectancy != null ? (m.intradayExpectancy >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                              {m.intradayExpectancy != null ? m.intradayExpectancy.toFixed(2) : '—'}
                            </td>
                            <td className={`px-4 py-2 text-right ${m.swingExpectancy != null ? (m.swingExpectancy >= 0 ? 'text-green-600' : 'text-red-600') : 'text-gray-400'}`}>
                              {m.swingExpectancy != null ? m.swingExpectancy.toFixed(2) : '—'}
                            </td>
                          </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {analytics.monthlyBreakdown.some((m) => m.trades < 5) && (
                    <p className="mt-2 text-xs text-gray-500">
                      * Months with fewer than 5 trades — drawdown may be less reliable
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Row 4: Rolling 20-Trade Expectancy Chart */}
            <ChartErrorBoundary chartName="Rolling Expectancy">
              <Suspense fallback={<ChartSkeleton height={280} />}>
                <RollingExpectancyChart data={analytics.rollingExpectancy} />
              </Suspense>
            </ChartErrorBoundary>

            {/* Monthly Expectancy by Style (Intraday vs Swing) */}
            <ChartErrorBoundary chartName="Monthly Expectancy">
              <Suspense fallback={<ChartSkeleton height={350} />}>
                <MonthlyExpectancyChart monthlyBreakdown={analytics.monthlyBreakdown} />
              </Suspense>
            </ChartErrorBoundary>

            {/* Cumulative Metrics Evolution (4-grid) */}
            <ChartErrorBoundary chartName="Cumulative Metrics">
              <Suspense fallback={<ChartSkeleton height={500} />}>
                <CumulativeMetricsGrid fifoMatches={analytics.fifoMatches} />
              </Suspense>
            </ChartErrorBoundary>

            {/* Holding Period + Duration Distribution (side-by-side) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <ChartErrorBoundary chartName="Holding Period">
                <Suspense fallback={<ChartSkeleton height={350} />}>
                  <HoldingPeriodChart fifoMatches={analytics.fifoMatches} />
                </Suspense>
              </ChartErrorBoundary>
              <ChartErrorBoundary chartName="Duration Distribution">
                <Suspense fallback={<ChartSkeleton height={350} />}>
                  <DurationDistributionChart fifoMatches={analytics.fifoMatches} />
                </Suspense>
              </ChartErrorBoundary>
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
