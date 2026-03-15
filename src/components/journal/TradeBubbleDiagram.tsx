import type { FIFOMatch, OrderGroup } from '@/lib/types'

interface TradeBubbleDiagramProps {
  fifoMatches: FIFOMatch[]
  orderGroups: OrderGroup[]
  onBubbleClick: (symbol: string) => void
}

interface BubbleData {
  symbol: string
  pnl: number
  radius: number
  source: 'fifo' | 'open'
}

function calcRadius(pnl: number): number {
  return Math.max(20, Math.min(48, 20 + Math.sqrt(Math.abs(pnl)) * 0.15))
}

function getBubbleColors(pnl: number, source: 'fifo' | 'open'): string {
  if (source === 'open') {
    return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
  }
  if (pnl > 0) {
    return 'bg-green-500/20 dark:bg-green-500/25 text-green-700 dark:text-green-300 border border-green-500/40 dark:border-green-500/50'
  }
  if (pnl < 0) {
    return 'bg-red-500/20 dark:bg-red-500/25 text-red-700 dark:text-red-300 border border-red-500/40 dark:border-red-500/50'
  }
  return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600'
}

export function TradeBubbleDiagram({
  fifoMatches,
  orderGroups,
  onBubbleClick,
}: TradeBubbleDiagramProps) {
  // Aggregate P&L per symbol from FIFO matches
  const fifoBySymbol = new Map<string, number>()
  for (const m of fifoMatches) {
    fifoBySymbol.set(m.symbol, (fifoBySymbol.get(m.symbol) ?? 0) + m.pnl)
  }

  // Build bubble list: closed positions first, then open-only
  const bubbles: BubbleData[] = []

  for (const [symbol, pnl] of fifoBySymbol.entries()) {
    bubbles.push({ symbol, pnl, radius: calcRadius(pnl), source: 'fifo' })
  }

  // Add buy-only order groups that have no FIFO match on this date
  for (const og of orderGroups) {
    if (!fifoBySymbol.has(og.symbol)) {
      bubbles.push({ symbol: og.symbol, pnl: 0, radius: calcRadius(0), source: 'open' })
    }
  }

  if (bubbles.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-4">No trades</p>
    )
  }

  return (
    <div className="flex flex-wrap gap-3 py-2">
      {bubbles.map((b) => {
        const size = b.radius * 2
        const colorClass = getBubbleColors(b.pnl, b.source)
        // Truncate long symbols for display
        const displaySymbol =
          b.symbol.length > 8 ? b.symbol.slice(0, 7) + '…' : b.symbol

        return (
          <button
            key={b.symbol}
            type="button"
            title={`${b.symbol}${b.source === 'fifo' ? ` — P&L: ${b.pnl >= 0 ? '+' : ''}${b.pnl.toFixed(0)}` : ' (open position)'}`}
            onClick={() => onBubbleClick(b.symbol)}
            style={{ width: size, height: size }}
            className={[
              'rounded-full flex items-center justify-center text-center transition-transform duration-150',
              'hover:scale-110 cursor-pointer select-none',
              'text-[10px] font-semibold leading-tight px-1',
              colorClass,
            ].join(' ')}
          >
            {displaySymbol}
          </button>
        )
      })}
    </div>
  )
}
