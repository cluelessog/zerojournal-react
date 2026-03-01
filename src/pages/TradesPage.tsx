import * as React from 'react'
import { Link } from 'react-router-dom'
import type { SymbolPnL } from '@/lib/types'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { useUIStore } from '@/lib/store/ui-store'
import { TradeFilters } from '@/components/trades/TradeFilters'
import { TradesTable } from '@/components/trades/TradesTable'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { exportTradesCSV } from '@/lib/persistence/import-export'

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TradesPage() {
  const { trades, isLoaded } = usePortfolioStore()

  // Load snapshot from IndexedDB on first mount (if not already loaded)
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

  // Build symbolPnL map from portfolio store (snapshot)
  const [symbolPnLMap, setSymbolPnLMap] = React.useState<Map<string, SymbolPnL>>(new Map())
  React.useEffect(() => {
    // Access symbolPnL directly from the snapshot via portfolio-store state
    // The store doesn't expose symbolPnL directly, but it's in the snapshot.
    // We'll derive it from the portfolio store by subscribing to it.
    // For now, we use an empty map — symbolPnL detail comes from SymbolDetail.
    setSymbolPnLMap(new Map())
  }, [])

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
        onExportCSV={() => exportTradesCSV(filteredTrades)}
        onReset={resetTradeFilters}
      />

      {/* Table */}
      <TradesTable
        trades={filteredTrades}
        symbolPnLMap={symbolPnLMap}
        groupBy={groupBy}
      />
    </div>
  )
}
