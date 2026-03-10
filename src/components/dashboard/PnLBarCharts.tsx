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
import { Button } from '@/components/ui/button'
import { buildTimeline } from '@/lib/engine/timeline'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import type { RawTrade, SymbolPnL, TimelinePoint } from '@/lib/types'
import { format, getISOWeek } from 'date-fns'

interface PnLBarChartsProps {
  trades: RawTrade[]
  symbolPnL: SymbolPnL[]
}

type Aggregation = 'daily' | 'weekly' | 'monthly'
type CostMode = 'net' | 'gross'

/** Named constants for dynamic chart sizing */
const BAR_HEIGHT_PX = 30
const MIN_CHART_HEIGHT = 300
const MAX_CONTAINER_HEIGHT = 600

function formatBarDate(isoDate: string, aggregation: Aggregation): string {
  const d = new Date(isoDate)
  switch (aggregation) {
    case 'daily':
      return format(d, 'd MMM')
    case 'weekly':
      return `W${getISOWeek(d)} ${format(d, "MMM ''yy")}`
    case 'monthly':
      return format(d, 'MMM yyyy')
  }
}

function fmtINR(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

export function PnLBarCharts({ trades, symbolPnL }: PnLBarChartsProps) {
  const [aggregation, setAggregation] = useState<Aggregation>('monthly')
  const [costMode, setCostMode] = useState<CostMode>('net')

  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const totalCharges = pnlSummary?.charges.total ?? 0

  const data = useMemo(() => {
    if (trades.length === 0) return []
    return buildTimeline(trades, symbolPnL, aggregation, totalCharges)
  }, [trades, symbolPnL, aggregation, totalCharges])

  const chartHeight = useMemo(
    () => Math.max(MIN_CHART_HEIGHT, data.length * BAR_HEIGHT_PX),
    [data.length]
  )

  if (trades.length === 0) return null

  const pnlKey = costMode === 'net' ? 'dailyNetPnL' : 'dailyPnL'

  const aggregationButtons: { label: string; value: Aggregation }[] = [
    { label: 'D', value: 'daily' },
    { label: 'W', value: 'weekly' },
    { label: 'M', value: 'monthly' },
  ]

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">P&L by Period</CardTitle>
          <div className="flex items-center gap-2">
            {/* Net/Gross toggle */}
            <div className="flex gap-1">
              <Button
                variant={costMode === 'net' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCostMode('net')}
              >
                Net
              </Button>
              <Button
                variant={costMode === 'gross' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setCostMode('gross')}
              >
                Gross
              </Button>
            </div>
            {/* Aggregation buttons */}
            <div className="flex gap-1">
              {aggregationButtons.map((b) => (
                <Button
                  key={b.value}
                  variant={aggregation === b.value ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 w-8 px-0 text-xs"
                  onClick={() => setAggregation(b.value)}
                >
                  {b.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          style={{ maxHeight: MAX_CONTAINER_HEIGHT }}
          className="overflow-y-auto w-full"
        >
          <ResponsiveContainer width="100%" height={chartHeight}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 85, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                tickFormatter={(v: number) =>
                  Math.abs(v) >= 100000
                    ? `${(v / 100000).toFixed(1)}L`
                    : Math.abs(v) >= 1000
                      ? `${(v / 1000).toFixed(1)}K`
                      : v.toFixed(0)
                }
              />
              <YAxis
                type="category"
                dataKey="date"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={85}
                tickFormatter={(v: string) => formatBarDate(v, aggregation)}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as TimelinePoint
                  const pnlVal = costMode === 'net' ? d.dailyNetPnL : d.dailyPnL
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-md text-xs">
                      <p className="font-medium">{formatBarDate(d.date, aggregation)}</p>
                      <p className={pnlVal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                        Rs. {fmtINR(pnlVal)}
                      </p>
                      {costMode === 'net' && d.dailyCharges > 0 && (
                        <p className="text-muted-foreground/60">Charges: Rs. {fmtINR(d.dailyCharges)}</p>
                      )}
                      {costMode === 'net' && d.dailyPnL !== d.dailyNetPnL && (
                        <p className="text-muted-foreground/60 mt-1">
                          Gross: Rs. {fmtINR(d.dailyPnL)} | Net: Rs. {fmtINR(d.dailyNetPnL)}
                        </p>
                      )}
                      {d.tradeCount > 0 && (
                        <p className="text-muted-foreground mt-1">Trades: {d.tradeCount}</p>
                      )}
                    </div>
                  )
                }}
              />
              <ReferenceLine x={0} stroke="#888" strokeDasharray="3 3" />
              <Bar dataKey={pnlKey} radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => {
                  const val = costMode === 'net' ? entry.dailyNetPnL : entry.dailyPnL
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={val >= 0 ? '#16a34a' : '#dc2626'}
                    />
                  )
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {costMode === 'net'
            ? 'Net P&L attributed to position close date. Charges distributed by turnover.'
            : 'Gross P&L attributed to position close date.'}
        </p>
      </CardContent>
    </Card>
  )
}
