import type { RawTrade, SymbolPnL } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface SymbolDetailProps {
  symbol: string
  isin: string
  trades: RawTrade[]
  symbolPnL: SymbolPnL | undefined
}

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

export function SymbolDetail({ symbol, isin, trades, symbolPnL }: SymbolDetailProps) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  )

  const buyTrades = trades.filter((t) => t.tradeType === 'buy')
  const sellTrades = trades.filter((t) => t.tradeType === 'sell')

  const totalBuyQty = buyTrades.reduce((s, t) => s + t.quantity, 0)
  const totalBuyValue = buyTrades.reduce((s, t) => s + t.quantity * t.price, 0)
  const totalSellQty = sellTrades.reduce((s, t) => s + t.quantity, 0)
  const totalSellValue = sellTrades.reduce((s, t) => s + t.quantity * t.price, 0)
  const realizedPnL = symbolPnL?.realizedPnL ?? totalSellValue - totalBuyValue

  return (
    <div className="p-4 bg-muted/10 border-t border-border">
      {/* Header */}
      <div className="flex items-start gap-6 mb-4">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Symbol</p>
          <p className="text-base font-bold">{symbol}</p>
          <p className="text-xs text-muted-foreground font-mono">{isin}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Trades</p>
          <p className="text-base font-semibold">{trades.length}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Realized P&amp;L</p>
          <p className={`text-base font-semibold ${realizedPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatINR(realizedPnL)}
          </p>
        </div>
      </div>

      {/* Trades table */}
      <div className="rounded-md border border-border overflow-hidden mb-4">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Exchange</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs text-right">Qty</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs text-right">Value</TableHead>
              <TableHead className="text-xs">Trade ID</TableHead>
              <TableHead className="text-xs">Order ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((trade) => (
              <TableRow key={trade.tradeId} className="text-sm">
                <TableCell className="text-xs">{formatDate(trade.tradeDate)}</TableCell>
                <TableCell className="text-xs">{trade.exchange}</TableCell>
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
                <TableCell className="font-mono text-xs text-muted-foreground">{trade.tradeId}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{trade.orderId}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Bought</p>
          <p className="font-semibold">{totalBuyQty} shares</p>
          <p className="text-xs text-muted-foreground">{formatINR(totalBuyValue)}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Sold</p>
          <p className="font-semibold">{totalSellQty} shares</p>
          <p className="text-xs text-muted-foreground">{formatINR(totalSellValue)}</p>
        </div>
        <div className="rounded-md border border-border p-3">
          <p className="text-xs text-muted-foreground mb-1">Net P&amp;L</p>
          <p className={`font-semibold ${realizedPnL >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatINR(realizedPnL)}
          </p>
        </div>
      </div>
    </div>
  )
}
