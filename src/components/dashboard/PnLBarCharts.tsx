import { useMemo, useState } from 'react'
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
import { buildTimeline } from '@/lib/engine/timeline'
import type { RawTrade, SymbolPnL } from '@/lib/types'

interface PnLBarChartsProps {
  trades: RawTrade[]
  symbolPnL: SymbolPnL[]
}

type Aggregation = 'daily' | 'weekly' | 'monthly'

export function PnLBarCharts({ trades, symbolPnL }: PnLBarChartsProps) {
  const [aggregation, setAggregation] = useState<Aggregation>('daily')

  const data = useMemo(() => {
    if (trades.length === 0) return []
    return buildTimeline(trades, symbolPnL, aggregation)
  }, [trades, symbolPnL, aggregation])

  if (trades.length === 0) return null

  const buttons: { label: string; value: Aggregation }[] = [
    { label: 'D', value: 'daily' },
    { label: 'W', value: 'weekly' },
    { label: 'M', value: 'monthly' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">P&L by Period</CardTitle>
          <div className="flex gap-1">
            {buttons.map((b) => (
              <button
                key={b.value}
                onClick={() => setAggregation(b.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  aggregation === b.value
                    ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] w-full">
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
                dataKey="date"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={75}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as { date: string; dailyPnL: number }
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.date}</p>
                      <p className={d.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}>
                        Rs. {d.dailyPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )
                }}
              />
              <ReferenceLine x={0} stroke="#888" strokeDasharray="3 3" />
              <Bar dataKey="dailyPnL" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.dailyPnL >= 0 ? '#16a34a' : '#dc2626'}
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
