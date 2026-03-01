import * as React from 'react'
import type { ColumnDef } from '@tanstack/table-core'
import type { RawTrade, SymbolPnL } from '@/lib/types'
import { DataTable } from '@/components/common/DataTable'
import { OrderGroupView } from './OrderGroupView'
import { SymbolDetail } from './SymbolDetail'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

// ─── Formatters ───────────────────────────────────────────────────────────────

function formatINR(value: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace('₹', 'Rs. ')
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface TradesTableProps {
  trades: RawTrade[]
  symbolPnLMap: Map<string, SymbolPnL>
  groupBy: 'none' | 'symbol' | 'order'
  globalFilter?: string
}

// ─── Flat trade columns ───────────────────────────────────────────────────────

const tradeColumns: ColumnDef<RawTrade, unknown>[] = [
  {
    accessorKey: 'symbol',
    header: 'Symbol',
    cell: ({ getValue }) => (
      <span className="font-medium">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'isin',
    header: 'ISIN',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'tradeDate',
    header: 'Trade Date',
    cell: ({ getValue }) => formatDate(getValue() as string),
  },
  {
    accessorKey: 'exchange',
    header: 'Exchange',
  },
  {
    accessorKey: 'tradeType',
    header: 'Type',
    cell: ({ getValue }) => {
      const v = getValue() as string
      return (
        <Badge
          className={
            v === 'buy'
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
              : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
          }
        >
          {v.toUpperCase()}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'quantity',
    header: 'Qty',
    meta: { className: 'text-right' },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{(getValue() as number).toLocaleString('en-IN')}</span>
    ),
  },
  {
    accessorKey: 'price',
    header: 'Price',
    meta: { className: 'text-right' },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{(getValue() as number).toFixed(2)}</span>
    ),
  },
  {
    id: 'value',
    header: 'Value',
    meta: { className: 'text-right' },
    accessorFn: (row) => row.quantity * row.price,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatINR(getValue() as number)}</span>
    ),
  },
  {
    accessorKey: 'tradeId',
    header: 'Trade ID',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'orderId',
    header: 'Order ID',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
]

// ─── Symbol group row type ────────────────────────────────────────────────────

interface SymbolGroup {
  id: string
  symbol: string
  isin: string
  tradeCount: number
  trades: RawTrade[]
}

const symbolGroupColumns: ColumnDef<SymbolGroup, unknown>[] = [
  {
    accessorKey: 'symbol',
    header: 'Symbol',
    cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
  },
  {
    accessorKey: 'isin',
    header: 'ISIN',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'tradeCount',
    header: 'Trades',
    meta: { className: 'text-right' },
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  {
    id: 'totalBuyQty',
    header: 'Buy Qty',
    meta: { className: 'text-right' },
    accessorFn: (row) =>
      row.trades.filter((t) => t.tradeType === 'buy').reduce((s, t) => s + t.quantity, 0),
    cell: ({ getValue }) => (
      <span className="tabular-nums text-emerald-600">{getValue() as number}</span>
    ),
  },
  {
    id: 'totalSellQty',
    header: 'Sell Qty',
    meta: { className: 'text-right' },
    accessorFn: (row) =>
      row.trades.filter((t) => t.tradeType === 'sell').reduce((s, t) => s + t.quantity, 0),
    cell: ({ getValue }) => (
      <span className="tabular-nums text-red-500">{getValue() as number}</span>
    ),
  },
  {
    id: 'totalValue',
    header: 'Total Value',
    meta: { className: 'text-right' },
    accessorFn: (row) => row.trades.reduce((s, t) => s + t.quantity * t.price, 0),
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatINR(getValue() as number)}</span>
    ),
  },
]

// ─── Order group row type ─────────────────────────────────────────────────────

interface OrderGroup {
  id: string
  orderId: string
  symbol: string
  isin: string
  fillCount: number
  trades: RawTrade[]
}

function buildOrderGroups(trades: RawTrade[]): OrderGroup[] {
  const map = new Map<string, RawTrade[]>()
  for (const t of trades) {
    if (!map.has(t.orderId)) map.set(t.orderId, [])
    map.get(t.orderId)!.push(t)
  }
  return Array.from(map.entries()).map(([orderId, fills]) => ({
    id: orderId,
    orderId,
    symbol: fills[0].symbol,
    isin: fills[0].isin,
    fillCount: fills.length,
    trades: fills,
  }))
}

function buildSymbolGroups(trades: RawTrade[]): SymbolGroup[] {
  const map = new Map<string, RawTrade[]>()
  for (const t of trades) {
    if (!map.has(t.symbol)) map.set(t.symbol, [])
    map.get(t.symbol)!.push(t)
  }
  return Array.from(map.entries()).map(([symbol, ts]) => ({
    id: symbol,
    symbol,
    isin: ts[0].isin,
    tradeCount: ts.length,
    trades: ts,
  }))
}

const orderGroupColumns: ColumnDef<OrderGroup, unknown>[] = [
  {
    accessorKey: 'orderId',
    header: 'Order ID',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'symbol',
    header: 'Symbol',
    cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
  },
  {
    accessorKey: 'isin',
    header: 'ISIN',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-muted-foreground">{getValue() as string}</span>
    ),
  },
  {
    accessorKey: 'fillCount',
    header: 'Fills',
    meta: { className: 'text-right' },
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  {
    id: 'totalQty',
    header: 'Total Qty',
    meta: { className: 'text-right' },
    accessorFn: (row) => row.trades.reduce((s, t) => s + t.quantity, 0),
    cell: ({ getValue }) => <span className="tabular-nums">{getValue() as number}</span>,
  },
  {
    id: 'avgPrice',
    header: 'Avg Price',
    meta: { className: 'text-right' },
    accessorFn: (row) => {
      const totalQty = row.trades.reduce((s, t) => s + t.quantity, 0)
      const totalValue = row.trades.reduce((s, t) => s + t.quantity * t.price, 0)
      return totalQty > 0 ? totalValue / totalQty : 0
    },
    cell: ({ getValue }) => (
      <span className="tabular-nums">{(getValue() as number).toFixed(2)}</span>
    ),
  },
  {
    id: 'totalValue',
    header: 'Total Value',
    meta: { className: 'text-right' },
    accessorFn: (row) => row.trades.reduce((s, t) => s + t.quantity * t.price, 0),
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatINR(getValue() as number)}</span>
    ),
  },
  {
    id: 'tradeType',
    header: 'Type',
    accessorFn: (row) => {
      const types = [...new Set(row.trades.map((t) => t.tradeType))]
      return types.join('/')
    },
    cell: ({ getValue }) => {
      const v = getValue() as string
      if (v === 'buy') {
        return (
          <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0">
            BUY
          </Badge>
        )
      }
      if (v === 'sell') {
        return (
          <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0">
            SELL
          </Badge>
        )
      }
      return <span className="text-xs text-muted-foreground">{v.toUpperCase()}</span>
    },
  },
]

// ─── Order fills sub-row ──────────────────────────────────────────────────────

function OrderFillsRow({ trades }: { trades: RawTrade[] }) {
  const totalQty = trades.reduce((s, t) => s + t.quantity, 0)
  const totalValue = trades.reduce((s, t) => s + t.quantity * t.price, 0)
  const avgPrice = totalQty > 0 ? totalValue / totalQty : 0

  return (
    <div className="p-4 bg-muted/10 border-t border-border">
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs">Trade ID</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs text-right">Qty</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.tradeId} className="text-sm">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {trade.tradeId}
                </TableCell>
                <TableCell className="text-xs">{formatDate(trade.orderExecutionTime)}</TableCell>
                <TableCell>
                  <Badge
                    className={
                      trade.tradeType === 'buy'
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-0'
                    }
                  >
                    {trade.tradeType.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">{trade.quantity}</TableCell>
                <TableCell className="text-right tabular-nums">{trade.price.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatINR(trade.quantity * trade.price)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-medium text-sm bg-muted/20">
              <TableCell colSpan={3}>Total / Weighted Avg</TableCell>
              <TableCell className="text-right tabular-nums">{totalQty}</TableCell>
              <TableCell className="text-right tabular-nums">{avgPrice.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(totalValue)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TradesTable({ trades, symbolPnLMap, groupBy, globalFilter }: TradesTableProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null)

  const handleRowClick = React.useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }, [])

  // Reset expansion when groupBy changes
  React.useEffect(() => {
    setExpandedId(null)
  }, [groupBy])

  // Build derived data — all hooks must be called unconditionally
  const symbolGroups = React.useMemo(() => buildSymbolGroups(trades), [trades])
  const orderGroups = React.useMemo(() => buildOrderGroups(trades), [trades])

  if (groupBy === 'symbol') {
    return (
      <DataTable
        columns={symbolGroupColumns}
        data={symbolGroups}
        globalFilter={globalFilter}
        expandedRowId={expandedId}
        getRowId={(row) => row.id}
        onRowClick={(row) => handleRowClick(row.id)}
        renderSubRow={(row) => (
          <SymbolDetail
            symbol={row.symbol}
            isin={row.isin}
            trades={row.trades}
            symbolPnL={symbolPnLMap.get(row.symbol)}
          />
        )}
      />
    )
  }

  if (groupBy === 'order') {
    return (
      <DataTable
        columns={orderGroupColumns}
        data={orderGroups}
        globalFilter={globalFilter}
        expandedRowId={expandedId}
        getRowId={(row) => row.id}
        onRowClick={(row) => handleRowClick(row.id)}
        renderSubRow={(row) => <OrderFillsRow trades={row.trades} />}
      />
    )
  }

  // groupBy === 'none' — flat trade list
  return (
    <DataTable
      columns={tradeColumns}
      data={trades}
      globalFilter={globalFilter}
      expandedRowId={expandedId}
      getRowId={(t) => t.tradeId}
      onRowClick={(trade) => handleRowClick(trade.tradeId)}
      renderSubRow={(trade) => {
        const fills = trades.filter((t) => t.orderId === trade.orderId)
        if (fills.length <= 1) return null
        return <OrderGroupView trades={fills} />
      }}
    />
  )
}
