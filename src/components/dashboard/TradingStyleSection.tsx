import type { TradingStyleResult, TradingStyleMetrics } from '@/lib/types'
import { formatCurrencyINR as formatCurrency } from '@/lib/format'

interface TradingStyleSectionProps {
  tradingStyles: TradingStyleResult
}

const STYLE_LABELS: Array<{ key: keyof Pick<TradingStyleResult, 'intraday' | 'btst' | 'velocity' | 'swing'>; label: string; description: string }> = [
  { key: 'intraday', label: 'Intraday', description: '0 days' },
  { key: 'btst', label: 'BTST', description: '1 day' },
  { key: 'velocity', label: 'Velocity', description: '2-4 days' },
  { key: 'swing', label: 'Swing', description: '>0 days (incl. BTST & Velocity)' },
]

function StyleCard({
  label,
  description,
  metrics,
  isBest,
  isWorst,
}: {
  label: string
  description: string
  metrics: TradingStyleMetrics
  isBest: boolean
  isWorst: boolean
}) {
  if (metrics.count === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center opacity-40">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No {label} Trades</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">Holding: {description}</p>
      </div>
    )
  }

  const isPositive = metrics.avgPnL >= 0
  const avgPnLColor = isPositive
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400'
  const totalPnLColor = metrics.totalPnL >= 0
    ? 'text-emerald-600 dark:text-emerald-400'
    : 'text-rose-600 dark:text-rose-400'

  const borderClass = isBest
    ? 'border-emerald-500/50 shadow-[0_0_15px_-5px_rgba(16,185,129,0.3)]'
    : isWorst
      ? 'border-rose-500/50'
      : ''

  return (
    <div className={`relative overflow-hidden rounded-xl border p-5 transition-all hover:shadow-md ${borderClass}`}>
      {/* Best/Worst corner badge */}
      {(isBest || isWorst) && (
        <div
          className={`absolute top-0 right-0 rounded-bl-lg px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isBest
              ? 'bg-emerald-500 text-white'
              : 'bg-rose-500 text-white'
          }`}
        >
          {isBest ? 'Best' : 'Worst'}
        </div>
      )}

      {/* Header: style name + total P&L */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-lg font-semibold">{label}</h4>
          <p className="text-xs text-gray-400 dark:text-gray-500">{description}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase text-gray-400 dark:text-gray-500">Total P&L</p>
          <p className={`text-sm font-bold ${totalPnLColor}`}>
            {formatCurrency(metrics.totalPnL)}
          </p>
        </div>
      </div>

      {/* Hero metric: Avg P&L */}
      <div className="mb-4 rounded-lg bg-gray-50 p-3 text-center dark:bg-gray-800/50">
        <span className="mb-1 block text-[10px] uppercase tracking-tight text-gray-400 dark:text-gray-500">
          Avg P&L / Trade
        </span>
        <span className={`text-2xl font-extrabold tabular-nums ${avgPnLColor}`}>
          {formatCurrency(metrics.avgPnL)}
        </span>
      </div>

      {/* Win rate with progress bar */}
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-gray-500 dark:text-gray-400">Win Rate</span>
            <span className="font-bold">{metrics.winRate.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
            <div
              className={`h-full transition-all ${metrics.winRate > 50 ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(metrics.winRate, 100)}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t pt-2 dark:border-gray-700">
          <span className="text-xs text-gray-400 dark:text-gray-500">Trades</span>
          <span className="text-sm font-semibold">{metrics.count}</span>
        </div>
      </div>
    </div>
  )
}

export function TradingStyleSection({ tradingStyles }: TradingStyleSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-lg font-semibold">Trading Style</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Performance by holding period (FIFO-matched trades)
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {STYLE_LABELS.map(({ key, label, description }) => (
          <StyleCard
            key={key}
            label={label}
            description={description}
            metrics={tradingStyles[key]}
            isBest={tradingStyles.bestStyle === label}
            isWorst={tradingStyles.worstStyle === label}
          />
        ))}
      </div>
      {tradingStyles.bestStyle === null && (
        <p className="text-xs text-gray-500 italic">
          Need at least 3 trades in 2+ styles for best/worst recommendation
        </p>
      )}
    </div>
  )
}
