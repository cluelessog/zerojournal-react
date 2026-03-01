import { useState, useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { RawTrade, SymbolPnL } from '@/lib/types'
import { buildTimeline } from '@/lib/engine/timeline'

type Aggregation = 'daily' | 'weekly' | 'monthly'

interface PnLTimelineChartProps {
  trades: RawTrade[]
  symbolPnL: SymbolPnL[]
}

function formatCurrencyShort(value: number): string {
  if (Math.abs(value) >= 100000) {
    return `${(value / 100000).toFixed(1)}L`
  }
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0 || !label) return null

  const dailyPnL = payload.find((p) => p.dataKey === 'cumulativePnL')
  const dateStr = new Date(label).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  // Find the original data point for dailyPnL
  const dataPoint = payload[0] as unknown as { payload: { dailyPnL: number; cumulativePnL: number } }

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">{dateStr}</p>
      <p className="text-sm text-muted-foreground">
        Daily P&L:{' '}
        <span
          className={
            dataPoint.payload.dailyPnL >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }
        >
          Rs. {dataPoint.payload.dailyPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">
        Cumulative:{' '}
        <span
          className={
            (dailyPnL?.value ?? 0) >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }
        >
          Rs. {(dailyPnL?.value ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </p>
    </div>
  )
}

export function PnLTimelineChart({ trades, symbolPnL }: PnLTimelineChartProps) {
  const [aggregation, setAggregation] = useState<Aggregation>('daily')

  const timeline = useMemo(
    () => buildTimeline(trades, symbolPnL, aggregation),
    [trades, symbolPnL, aggregation]
  )

  const aggregationOptions: { key: Aggregation; label: string }[] = [
    { key: 'daily', label: 'D' },
    { key: 'weekly', label: 'W' },
    { key: 'monthly', label: 'M' },
  ]

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">P&L Timeline</CardTitle>
        <div className="flex gap-1">
          {aggregationOptions.map((opt) => (
            <Button
              key={opt.key}
              variant={aggregation === opt.key ? 'default' : 'outline'}
              size="sm"
              className="h-7 w-8 px-0 text-xs"
              onClick={() => setAggregation(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="pnlGradientPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#16a34a" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="pnlGradientNeg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#dc2626" stopOpacity={0.05} />
                  <stop offset="100%" stopColor="#dc2626" stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tickFormatter={formatCurrencyShort}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                width={60}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="cumulativePnL"
                stroke="#16a34a"
                fill="url(#pnlGradientPos)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, className: 'fill-green-600' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          P&L attributed to position close date. Daily attribution is approximate.
        </p>
      </CardContent>
    </Card>
  )
}
