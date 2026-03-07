import type { SymbolPnL } from '@/lib/types'
import { cn } from '@/lib/utils'

interface OpenPositionsProps {
  symbolPnL: SymbolPnL[]
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(pnl: number, cost: number) {
  if (cost === 0) return 0
  return (pnl / cost) * 100
}

export function OpenPositions({ symbolPnL }: OpenPositionsProps) {
  const openPositions = symbolPnL.filter((s) => s.openQuantity !== 0)

  if (openPositions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 dark:text-gray-400">
        <div className="text-3xl mb-3">✓</div>
        <p className="text-sm font-medium">No open positions</p>
        <p className="text-xs mt-1">All positions have been fully closed this period.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            {['Symbol', 'Quantity', 'Open Value', 'Prev Close', 'Unrealized P&L', 'P&L %'].map((h) => (
              <th
                key={h}
                className={cn(
                  'px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap',
                  h === 'Symbol' ? 'text-left' : 'text-right'
                )}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          {openPositions.map((pos) => {
            // Open value = buyValue that hasn't been sold yet (proportional)
            // We approximate: openValue = openQuantity * avgBuyPrice
            // avg buy price = buyValue / quantity
            const avgBuyPrice = pos.quantity > 0 ? pos.buyValue / pos.quantity : 0
            const openValue = pos.openQuantity * avgBuyPrice
            const currentValue = pos.openQuantity * pos.previousClosingPrice
            const unrealizedPnL = currentValue - openValue
            const unrealizedPct = pct(unrealizedPnL, openValue)
            const isGain = unrealizedPnL >= 0

            return (
              <tr key={pos.isin} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {pos.symbol}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">
                  {pos.openQuantity}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {fmt(openValue)}
                </td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">
                  {fmt(pos.previousClosingPrice)}
                </td>
                <td className={cn('px-3 py-2 text-right font-medium whitespace-nowrap', isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {isGain ? '+' : ''}{fmt(unrealizedPnL)}
                </td>
                <td className={cn('px-3 py-2 text-right whitespace-nowrap', isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {isGain ? '+' : ''}{unrealizedPct.toFixed(2)}%
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
          <tr>
            <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100" colSpan={4}>
              Total ({openPositions.length} position{openPositions.length !== 1 ? 's' : ''})
            </td>
            <td className={cn('px-3 py-2 text-right font-bold whitespace-nowrap', (() => {
                const total = openPositions.reduce((s, p) => {
                  const avg = p.quantity > 0 ? p.buyValue / p.quantity : 0
                  return s + (p.openQuantity * p.previousClosingPrice - p.openQuantity * avg)
                }, 0)
                return total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              })())}>
              {(() => {
                const total = openPositions.reduce((s, p) => {
                  const avg = p.quantity > 0 ? p.buyValue / p.quantity : 0
                  return s + (p.openQuantity * p.previousClosingPrice - p.openQuantity * avg)
                }, 0)
                return `${total >= 0 ? '+' : ''}${fmt(total)}`
              })()}
            </td>
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
