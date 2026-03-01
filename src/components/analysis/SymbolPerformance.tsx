import * as React from 'react'
import type { SymbolPnL } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SymbolPerformanceProps {
  symbolPnL: SymbolPnL[]
}

type SortKey = 'symbol' | 'buyValue' | 'sellValue' | 'realizedPnL' | 'realizedPnLPct' | 'isin'
type SortDir = 'asc' | 'desc'

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pct(pnl: number, buyValue: number) {
  if (buyValue === 0) return 0
  return (pnl / buyValue) * 100
}

export function SymbolPerformance({ symbolPnL }: SymbolPerformanceProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>('realizedPnL')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const sorted = React.useMemo(() => {
    return [...symbolPnL].sort((a, b) => {
      let av: number | string
      let bv: number | string
      switch (sortKey) {
        case 'symbol': av = a.symbol; bv = b.symbol; break
        case 'buyValue': av = a.buyValue; bv = b.buyValue; break
        case 'sellValue': av = a.sellValue; bv = b.sellValue; break
        case 'realizedPnL': av = a.realizedPnL; bv = b.realizedPnL; break
        case 'realizedPnLPct': av = pct(a.realizedPnL, a.buyValue); bv = pct(b.realizedPnL, b.buyValue); break
        case 'isin': av = a.isin; bv = b.isin; break
        default: av = a.realizedPnL; bv = b.realizedPnL
      }
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
  }, [symbolPnL, sortKey, sortDir])

  const totals = React.useMemo(() => ({
    buyValue: symbolPnL.reduce((s, r) => s + r.buyValue, 0),
    sellValue: symbolPnL.reduce((s, r) => s + r.sellValue, 0),
    realizedPnL: symbolPnL.reduce((s, r) => s + r.realizedPnL, 0),
  }), [symbolPnL])

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function indicator(key: SortKey) {
    if (sortKey !== key) return <span className="ml-1 text-gray-300 dark:text-gray-600">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const th = 'px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer select-none whitespace-nowrap hover:text-gray-700 dark:hover:text-gray-200'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className={th} onClick={() => toggle('symbol')}>Symbol{indicator('symbol')}</th>
            <th className={cn(th, 'text-right')} onClick={() => toggle('buyValue')}>Buy Value{indicator('buyValue')}</th>
            <th className={cn(th, 'text-right')} onClick={() => toggle('sellValue')}>Sell Value{indicator('sellValue')}</th>
            <th className={cn(th, 'text-right')} onClick={() => toggle('realizedPnL')}>Realized P&L{indicator('realizedPnL')}</th>
            <th className={cn(th, 'text-right')} onClick={() => toggle('realizedPnLPct')}>P&L %{indicator('realizedPnLPct')}</th>
            <th className={th} onClick={() => toggle('isin')}>ISIN{indicator('isin')}</th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.map((row) => {
            const p = pct(row.realizedPnL, row.buyValue)
            const isGain = row.realizedPnL >= 0
            return (
              <tr key={row.isin} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">{row.symbol}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(row.buyValue)}</td>
                <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap">{fmt(row.sellValue)}</td>
                <td className={cn('px-3 py-2 text-right font-medium whitespace-nowrap', isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {isGain ? '+' : ''}{fmt(row.realizedPnL)}
                </td>
                <td className={cn('px-3 py-2 text-right whitespace-nowrap', isGain ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
                  {isGain ? '+' : ''}{p.toFixed(2)}%
                </td>
                <td className="px-3 py-2 text-gray-500 dark:text-gray-400 font-mono text-xs whitespace-nowrap">{row.isin}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
          <tr>
            <td className="px-3 py-2 font-bold text-gray-900 dark:text-gray-100">
              Total ({symbolPnL.length} symbols)
            </td>
            <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">{fmt(totals.buyValue)}</td>
            <td className="px-3 py-2 text-right font-bold text-gray-900 dark:text-gray-100">{fmt(totals.sellValue)}</td>
            <td className={cn('px-3 py-2 text-right font-bold', totals.realizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {totals.realizedPnL >= 0 ? '+' : ''}{fmt(totals.realizedPnL)}
            </td>
            <td className={cn('px-3 py-2 text-right font-bold', totals.realizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {totals.buyValue > 0 ? `${totals.realizedPnL >= 0 ? '+' : ''}${pct(totals.realizedPnL, totals.buyValue).toFixed(2)}%` : '—'}
            </td>
            <td className="px-3 py-2" />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
