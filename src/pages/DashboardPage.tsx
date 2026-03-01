import { lazy, Suspense, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { ChartSkeleton } from '@/components/dashboard/ChartSkeleton'

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

      {/* Metric Cards (2 rows of 4) — not lazy, no Recharts dependency */}
      <MetricsCards analytics={analytics} pnlSummary={pnlSummary} />

      {/* Row 3: P&L Timeline (full width) */}
      <Suspense fallback={<ChartSkeleton height={300} />}>
        <PnLTimelineChart trades={trades} symbolPnL={symbolPnL} />
      </Suspense>

      {/* Row 4: Win/Loss Distribution + Monthly Volume (side by side) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<ChartSkeleton height={250} />}>
          <WinLossDistribution symbolPnL={symbolPnL} />
        </Suspense>
        <Suspense fallback={<ChartSkeleton height={250} />}>
          <MonthlyVolumeChart trades={trades} />
        </Suspense>
      </div>

      {/* Row 5: Top Symbols (full width) */}
      <Suspense fallback={<ChartSkeleton height={350} />}>
        <TopSymbolsChart symbolPnL={symbolPnL} />
      </Suspense>

      {/* Row 6: Trading Calendar (full width) */}
      <Suspense fallback={<ChartSkeleton height={200} />}>
        <TradingCalendar trades={trades} />
      </Suspense>
    </div>
  )
}
