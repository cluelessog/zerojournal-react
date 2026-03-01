import type { RawTrade } from '@/lib/types'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface OrderGroupViewProps {
  trades: RawTrade[]
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

export function OrderGroupView({ trades }: OrderGroupViewProps) {
  if (trades.length === 0) return null

  const totalQty = trades.reduce((sum, t) => sum + t.quantity, 0)
  const totalValue = trades.reduce((sum, t) => sum + t.quantity * t.price, 0)
  const weightedAvgPrice = totalQty > 0 ? totalValue / totalQty : 0

  return (
    <div className="p-4 bg-muted/10 border-t border-border">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
        Partial Fills — Order {trades[0].orderId}
      </p>
      <div className="rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="text-xs">Trade ID</TableHead>
              <TableHead className="text-xs">Date &amp; Time</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs text-right">Qty</TableHead>
              <TableHead className="text-xs text-right">Price</TableHead>
              <TableHead className="text-xs text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {trades.map((trade) => (
              <TableRow key={trade.tradeId} className="text-sm">
                <TableCell className="font-mono text-xs text-muted-foreground">{trade.tradeId}</TableCell>
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
              <TableCell className="text-right tabular-nums">{weightedAvgPrice.toFixed(2)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatINR(totalValue)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </div>
  )
}
