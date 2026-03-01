import { useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { PnLTimelineChart } from '@/components/dashboard/PnLTimelineChart'
import { WinLossDistribution } from '@/components/dashboard/WinLossDistribution'
import { TopSymbolsChart } from '@/components/dashboard/TopSymbolsChart'
import { MonthlyVolumeChart } from '@/components/dashboard/MonthlyVolumeChart'
import { TradingCalendar } from '@/components/dashboard/TradingCalendar'

export default function DashboardPage() {
  const navigate = useNavigate()
  const analytics = usePortfolioStore((s) => s.analytics)
  const trades = usePortfolioStore((s) => s.trades)
  const symbolPnL = usePortfolioStore((s) => s.symbolPnL)
  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const isLoaded = usePortfolioStore((s) => s.isLoaded)

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

      {/* Metric Cards (2 rows of 4) */}
      <MetricsCards analytics={analytics} pnlSummary={pnlSummary} />

      {/* Row 3: P&L Timeline (full width) */}
      <PnLTimelineChart trades={trades} symbolPnL={symbolPnL} />

      {/* Row 4: Win/Loss Distribution + Monthly Volume (side by side) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <WinLossDistribution symbolPnL={symbolPnL} />
        <MonthlyVolumeChart trades={trades} />
      </div>

      {/* Row 5: Top Symbols (full width) */}
      <TopSymbolsChart symbolPnL={symbolPnL} />

      {/* Row 6: Trading Calendar (full width) */}
      <TradingCalendar trades={trades} />
    </div>
  )
}
