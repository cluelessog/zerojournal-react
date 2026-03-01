import type { ParseTradebookResult, ParsePnLResult } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface ImportPreviewProps {
  tradebookResult: ParseTradebookResult
  pnlResult: ParsePnLResult
  hasErrors: boolean
  onConfirm: () => void
  onCancel: () => void
}

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtCurrency(n: number): string {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  return `${sign}₹${fmt(abs)}`
}

export function ImportPreview({
  tradebookResult,
  pnlResult,
  hasErrors,
  onConfirm,
  onCancel,
}: ImportPreviewProps) {
  // Derive tradebook stats
  const trades = tradebookResult.trades
  const tradeCount = trades.length
  const symbolCount = new Set(trades.map((t) => t.symbol)).size
  const buyCount = trades.filter((t) => t.tradeType === 'buy').length
  const sellCount = trades.filter((t) => t.tradeType === 'sell').length

  const dates = trades.map((t) => t.tradeDate).sort()
  const dateFrom = dates[0] ?? '—'
  const dateTo = dates[dates.length - 1] ?? '—'

  // PnL stats
  const { pnlSummary } = pnlResult
  const realizedPnL = pnlSummary.totalRealizedPnL
  const unrealizedPnL = pnlSummary.totalUnrealizedPnL
  const charges = pnlSummary.charges.total

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Tradebook summary */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tradebook</h3>
            <Badge variant="secondary" className="text-xs">
              {tradebookResult.skippedRows} rows skipped
            </Badge>
          </div>
          <dl className="space-y-2 text-sm">
            <Row label="Trades" value={tradeCount.toLocaleString('en-IN')} />
            <Row label="Symbols" value={symbolCount.toLocaleString('en-IN')} />
            <Row label="Date range" value={`${dateFrom} → ${dateTo}`} />
            <Row
              label="Buy / Sell"
              value={
                <span>
                  <span className="text-green-600 dark:text-green-400">{buyCount} buy</span>
                  {' / '}
                  <span className="text-red-600 dark:text-red-400">{sellCount} sell</span>
                </span>
              }
            />
          </dl>
        </div>

        {/* PnL summary */}
        <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">P&L Statement</h3>
            <Badge variant="secondary" className="text-xs">
              {pnlResult.symbolPnL.length} symbols
            </Badge>
          </div>
          <dl className="space-y-2 text-sm">
            <Row
              label="Realized P&L"
              value={
                <span className={realizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {fmtCurrency(realizedPnL)}
                </span>
              }
            />
            <Row
              label="Unrealized P&L"
              value={
                <span className={unrealizedPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {fmtCurrency(unrealizedPnL)}
                </span>
              }
            />
            <Row
              label="Total charges"
              value={<span className="text-red-600 dark:text-red-400">−₹{fmt(charges)}</span>}
            />
            <Row
              label="Net P&L"
              value={
                <span className={pnlSummary.netPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  {fmtCurrency(pnlSummary.netPnL)}
                </span>
              }
            />
          </dl>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={hasErrors}>
          {hasErrors ? 'Cannot import (fix errors first)' : 'Confirm Import'}
        </Button>
      </div>
    </div>
  )
}

function Row({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd className="font-medium text-gray-900 dark:text-gray-100 text-right">{value}</dd>
    </div>
  )
}
