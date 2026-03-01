import type { RawTrade, SymbolPnL, PnLSummary } from '@/lib/types'
import { buildCrossReference } from '@/lib/engine/cross-reference'
import { cn } from '@/lib/utils'

interface CrossReferenceViewProps {
  trades: RawTrade[]
  symbolPnL: SymbolPnL[]
  pnlSummary: PnLSummary
}

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Compute per-symbol tradebook P&L (sell - buy) within the tradebook data */
function buildTradebookSymbolPnL(trades: RawTrade[]): Map<string, { buy: number; sell: number }> {
  const map = new Map<string, { buy: number; sell: number }>()
  for (const t of trades) {
    const value = t.quantity * t.price
    if (!map.has(t.symbol)) map.set(t.symbol, { buy: 0, sell: 0 })
    const entry = map.get(t.symbol)!
    if (t.tradeType === 'buy') entry.buy += value
    else entry.sell += value
  }
  return map
}

export function CrossReferenceView({ trades, symbolPnL, pnlSummary }: CrossReferenceViewProps) {
  const crossRef = buildCrossReference(trades, symbolPnL, pnlSummary)
  const tradebookMap = buildTradebookSymbolPnL(trades)

  // Build per-symbol comparison rows
  const rows = symbolPnL.map((s) => {
    const tb = tradebookMap.get(s.symbol) ?? { buy: 0, sell: 0 }
    const tbGrossPnL = tb.sell - tb.buy
    const pnlRealizedPnL = s.realizedPnL
    const diff = Math.abs(pnlRealizedPnL - tbGrossPnL)
    const withinTolerance = diff <= 1
    return { symbol: s.symbol, isin: s.isin, pnlRealizedPnL, tbGrossPnL, diff, withinTolerance }
  })

  const discrepancyCount = rows.filter((r) => !r.withinTolerance).length
  const matchPct = rows.length > 0 ? ((rows.length - discrepancyCount) / rows.length) * 100 : 100

  return (
    <div className="flex flex-col gap-4">
      {/* Info note */}
      <div className="rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
        <strong>Note:</strong> Tradebook covers current FY only. The P&L file includes prior-year cost basis (carry-forward positions).
        {crossRef.hasCarryForward && (
          <span> Carry-forward cost: <strong>Rs. {fmt(crossRef.carryForwardCost)}</strong>.</span>
        )}
        {' '}Discrepancies for symbols with prior-year buys are expected.
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Symbols</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{rows.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Matched</p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">{rows.length - discrepancyCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Discrepancies</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">{discrepancyCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Match Rate</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{matchPct.toFixed(1)}%</p>
        </div>
      </div>

      {/* Per-symbol table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Symbol</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">PnL File P&L</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">Tradebook Gross P&L</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Diff</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((row) => (
              <tr key={row.isin} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {row.symbol}
                </td>
                <td className={cn('px-3 py-2 text-right whitespace-nowrap font-mono', row.pnlRealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {row.pnlRealizedPnL >= 0 ? '+' : ''}{fmt(row.pnlRealizedPnL)}
                </td>
                <td className={cn('px-3 py-2 text-right whitespace-nowrap font-mono', row.tbGrossPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {row.tbGrossPnL >= 0 ? '+' : ''}{fmt(row.tbGrossPnL)}
                </td>
                <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  {fmt(row.diff)}
                </td>
                <td className="px-3 py-2 text-center">
                  {row.withinTolerance ? (
                    <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 text-xs font-medium">
                      <span>✓</span> Match
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 text-xs font-medium">
                      <span>⚠</span> Diff
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
            <tr>
              <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">Totals</td>
              <td className={cn('px-3 py-2 text-right font-bold font-mono whitespace-nowrap', crossRef.pnlRealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {crossRef.pnlRealizedPnL >= 0 ? '+' : ''}{fmt(crossRef.pnlRealizedPnL)}
              </td>
              <td className={cn('px-3 py-2 text-right font-bold font-mono whitespace-nowrap', crossRef.tradebookGrossPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                {crossRef.tradebookGrossPnL >= 0 ? '+' : ''}{fmt(crossRef.tradebookGrossPnL)}
              </td>
              <td className="px-3 py-2 text-right font-bold font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                {fmt(Math.abs(crossRef.pnlRealizedPnL - crossRef.tradebookGrossPnL))}
              </td>
              <td className="px-3 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                {discrepancyCount} discrepanc{discrepancyCount === 1 ? 'y' : 'ies'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
