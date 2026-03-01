import { Card, CardContent } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
import type { TradeAnalytics, PnLSummary } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MetricsCardsProps {
  analytics: TradeAnalytics
  pnlSummary: PnLSummary
}

function formatCurrency(value: number): string {
  return `Rs. ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-IN')
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

export function MetricsCards({ analytics, pnlSummary }: MetricsCardsProps) {
  const totalChargesExclDP = pnlSummary.charges.total - pnlSummary.charges.dpCharges

  return (
    <div className="space-y-4">
      {/* Row 1: P&L, Win Rate, Best Trade, Worst Trade */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Total P&L"
          value={formatCurrency(analytics.totalRealizedPnL)}
          colorClass={getPnLColorClass(analytics.totalRealizedPnL)}
          tooltip="Realized P&L (net of broker charges)"
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
          value={formatCurrency(totalChargesExclDP)}
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
