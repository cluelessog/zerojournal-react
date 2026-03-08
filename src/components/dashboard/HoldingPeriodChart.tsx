import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FIFOMatch } from '@/lib/types'

interface HoldingPeriodChartProps {
  fifoMatches: FIFOMatch[]
}

interface HoldingEntry {
  symbol: string
  avgDays: number
  tradeCount: number
}

export function HoldingPeriodChart({ fifoMatches }: HoldingPeriodChartProps) {
  const data = useMemo(() => {
    if (fifoMatches.length === 0) return []

    const groups = new Map<string, { totalDays: number; count: number }>()
    for (const m of fifoMatches) {
      const entry = groups.get(m.symbol) ?? { totalDays: 0, count: 0 }
      entry.totalDays += m.holdingDays
      entry.count++
      groups.set(m.symbol, entry)
    }

    const entries: HoldingEntry[] = []
    for (const [symbol, { totalDays, count }] of groups) {
      entries.push({
        symbol,
        avgDays: Math.round((totalDays / count) * 10) / 10,
        tradeCount: count,
      })
    }

    return entries
      .sort((a, b) => b.avgDays - a.avgDays)
      .slice(0, 20)
  }, [fifoMatches])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Avg Holding Period by Symbol</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: Math.max(250, data.length * 28) }} className="w-full">
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
                  const d = payload[0].payload as HoldingEntry
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.symbol}</p>
                      <p>Avg: {d.avgDays.toFixed(1)} days</p>
                      <p className="text-muted-foreground">{d.tradeCount} trades</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="avgDays" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
