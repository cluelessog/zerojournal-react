import * as React from 'react'
import { Link } from 'react-router-dom'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { useUIStore } from '@/lib/store/ui-store'
import { TradeFilters } from '@/components/trades/TradeFilters'
import { TradesTable } from '@/components/trades/TradesTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { exportTradesCSV, exportSymbolPnLCSV } from '@/lib/persistence/import-export'
import { allocateCharges } from '@/lib/engine/charge-allocator'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const { trades, isLoaded } = usePortfolioStore()

  // Load snapshot from IndexedDB on first mount (if not already loaded)
  const symbolPnL = usePortfolioStore((s) => s.symbolPnL)
  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const loadFromDB = usePortfolioStore((s) => s.loadFromDB)
  React.useEffect(() => {
    if (!isLoaded) {
      loadFromDB()
    }
  }, [isLoaded, loadFromDB])

  const {
    selectedSymbols,
    dateRange,
    tradeTypeFilter,
    groupBy,
    setSymbols,
    setDateRange,
    setTradeType,
    setGroupBy,
    resetTradeFilters,
  } = useUIStore()

  // Build symbolPnL map from portfolio store for authoritative realized P&L in SymbolDetail
  const symbolPnLMap = React.useMemo(
    () => new Map(symbolPnL.map((s) => [s.symbol, s])),
    [symbolPnL],
  )

  // Derive all unique symbols for the combobox
  const allSymbols = React.useMemo(
    () => [...new Set(trades.map((t) => t.symbol))].sort(),
    [trades]
  )

  // Apply filters
  const filteredTrades = React.useMemo(() => {
    let result = trades

    // Symbol filter
    if (selectedSymbols.length > 0) {
      result = result.filter((t) => selectedSymbols.includes(t.symbol))
    }

    // Date range filter
    if (dateRange.from) {
      result = result.filter((t) => t.tradeDate >= dateRange.from)
    }
    if (dateRange.to) {
      result = result.filter((t) => t.tradeDate <= dateRange.to)
    }

    // Trade type filter
    if (tradeTypeFilter !== 'all') {
      result = result.filter((t) => t.tradeType === tradeTypeFilter)
    }

    return result
  }, [trades, selectedSymbols, dateRange, tradeTypeFilter])

  // Compute allocated charges when filters are active
  const allocatedCharges = React.useMemo(() => {
    if (!pnlSummary || filteredTrades.length === trades.length) return null
    return allocateCharges(pnlSummary.charges.total, trades, filteredTrades)
  }, [pnlSummary, trades, filteredTrades])

  if (!isLoaded || trades.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Trades</h1>
        <EmptyState
          title="No trades imported yet"
          description="Import your Zerodha tradebook and P&L files to view your trade history."
          action={
            <Button asChild>
              <Link to="/import">Go to Import</Link>
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div className="p-6 flex flex-col gap-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Trades</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filteredTrades.length.toLocaleString('en-IN')} of{' '}
            {trades.length.toLocaleString('en-IN')} trades
          </p>
        </div>
      </div>

      {/* Filters */}
      <TradeFilters
        symbols={allSymbols}
        selectedSymbols={selectedSymbols}
        dateFrom={dateRange.from}
        dateTo={dateRange.to}
        tradeTypeFilter={tradeTypeFilter}
        groupBy={groupBy}
        onSymbolsChange={setSymbols}
        onDateFromChange={(from) => setDateRange({ ...dateRange, from })}
        onDateToChange={(to) => setDateRange({ ...dateRange, to })}
        onTradeTypeChange={setTradeType}
        onGroupByChange={setGroupBy}
        onExportTradesCSV={() => exportTradesCSV(filteredTrades)}
        onExportPnLCSV={() => exportSymbolPnLCSV(symbolPnL, trades)}
        onReset={resetTradeFilters}
      />

      {/* Allocated charges when filters are active */}
      {allocatedCharges && pnlSummary && (
        <p className="text-sm text-muted-foreground">
          Estimated charges: Rs.{' '}
          {allocatedCharges.total.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{' '}
          ({(allocatedCharges.ratio * 100).toLocaleString('en-IN', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}% of total Rs.{' '}
          {pnlSummary.charges.total.toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })})
        </p>
      )}

      {/* Table */}
      <TradesTable
        trades={filteredTrades}
        symbolPnLMap={symbolPnLMap}
        groupBy={groupBy}
      />
    </div>
  )
}
