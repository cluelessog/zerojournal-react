import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import type { TradeAnalytics, PnLSummary, MonthlyMetric } from '@/lib/types'
import { cn } from '@/lib/utils'
import { formatCurrencyINR as formatCurrency, formatPercent, formatNumber } from '@/lib/format'

interface MetricsCardsProps {
  analytics: TradeAnalytics
  pnlSummary: PnLSummary
  monthlyBreakdown?: MonthlyMetric[]
}

interface MetricCardProps {
  label: string
  value: string
  colorClass: string
  tooltip?: string
}

function MetricCard({ label, value, colorClass, tooltip }: MetricCardProps) {
  return (
    <Card className="py-4">
      <CardContent className="px-4 py-0">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className={cn('mt-1 text-2xl font-bold tracking-tight', colorClass)}>{value}</p>
      </CardContent>
    </Card>
  )
}

function getPnLColorClass(value: number): string {
  if (value > 0) return 'text-green-600 dark:text-green-400'
  if (value < 0) return 'text-red-600 dark:text-red-400'
  return 'text-gray-600 dark:text-gray-400'
}

export function MetricsCards({ analytics, pnlSummary, monthlyBreakdown }: MetricsCardsProps) {
  // Grand total charges including DP — matches Analysis Tab's "Grand Total (incl. DP)"
  const tradingCharges = monthlyBreakdown && monthlyBreakdown.length > 0
    ? monthlyBreakdown.reduce((sum, m) => sum + m.charges, 0)
    : pnlSummary.charges.total
  const totalChargesInclDP = tradingCharges + pnlSummary.charges.dpCharges

  return (
    <div className="space-y-4">
      {/* Row 1: P&L, Win Rate, Best Trade, Worst Trade */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total P&L"
          value={formatCurrency(analytics.totalRealizedPnL)}
          colorClass={getPnLColorClass(analytics.totalRealizedPnL)}
          tooltip="Gross realized P&L (before charges)"
        />
        <MetricCard
          label="Win Rate"
          value={formatPercent(analytics.winRate)}
          colorClass={
            analytics.winRate >= 50
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }
        />
        <MetricCard
          label="Best Trade"
          value={
            analytics.bestTrade
              ? `${analytics.bestTrade.symbol} ${formatCurrency(analytics.bestTrade.pnl)}`
              : '—'
          }
          colorClass="text-green-600 dark:text-green-400"
        />
        <MetricCard
          label="Worst Trade"
          value={
            analytics.worstTrade
              ? `${analytics.worstTrade.symbol} ${formatCurrency(analytics.worstTrade.pnl)}`
              : '—'
          }
          colorClass="text-red-600 dark:text-red-400"
        />
      </div>

      {/* Row 2: Charges, Trades, Symbols, Trading Days */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total Charges"
          value={formatCurrency(totalChargesInclDP)}
          colorClass="text-red-600 dark:text-red-400"
        />
        <MetricCard
          label="Trade Count"
          value={formatNumber(analytics.totalTrades)}
          colorClass="text-gray-900 dark:text-gray-100"
        />
        <MetricCard
          label="Symbol Count"
          value={formatNumber(analytics.totalSymbols)}
          colorClass="text-gray-900 dark:text-gray-100"
        />
        <MetricCard
          label="Trading Days"
          value={formatNumber(analytics.tradingDays)}
          colorClass="text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>
  )
}
