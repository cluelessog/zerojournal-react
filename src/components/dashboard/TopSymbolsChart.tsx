import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { SymbolPnL } from '@/lib/types'

interface TopSymbolsChartProps {
  symbolPnL: SymbolPnL[]
}

interface SymbolEntry {
  symbol: string
  pnl: number
}

export function TopSymbolsChart({ symbolPnL }: TopSymbolsChartProps) {
  const data = useMemo(() => {
    // Only closed positions
    const closed = symbolPnL.filter((s) => s.openQuantity === 0)

    // Sort by realized P&L descending
    const sorted = [...closed].sort((a, b) => b.realizedPnL - a.realizedPnL)

    // Top 5 best (most positive) and top 5 worst (most negative)
    const best5 = sorted.slice(0, 5)
    const worst5 = sorted.slice(-5).reverse()

    // Combine: worst first (bottom), then best (top) for visual layout
    const combined: SymbolEntry[] = [
      ...worst5.map((s) => ({ symbol: s.symbol, pnl: Math.round(s.realizedPnL * 100) / 100 })),
      ...best5.map((s) => ({ symbol: s.symbol, pnl: Math.round(s.realizedPnL * 100) / 100 })),
    ]

    return combined
  }, [symbolPnL])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Top Symbols by P&L</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 1000
                    ? `${(v / 1000).toFixed(1)}K`
                    : v.toFixed(0)
                }
              />
              <YAxis
                type="category"
                dataKey="symbol"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                width={75}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as SymbolEntry
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.symbol}</p>
                      <p className={d.pnl >= 0 ? 'text-green-600' : 'text-red-600'}>
                        Rs. {d.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )
                }}
              />
              <ReferenceLine x={0} stroke="#888" strokeDasharray="3 3" />
              <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.pnl >= 0 ? '#16a34a' : '#dc2626'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
