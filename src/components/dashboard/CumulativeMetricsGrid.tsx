import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateCumulativeMetrics } from '@/lib/engine/cumulative-metrics'
import type { FIFOMatch } from '@/lib/types'

interface CumulativeMetricsGridProps {
  fifoMatches: FIFOMatch[]
}

interface ChartConfig {
  title: string
  dataKey: string
  color: string
  refLine?: number
  refLabel?: string
  yFormat?: (v: number) => string
  tooltipFormat?: (v: number) => string
}

const CHARTS: ChartConfig[] = [
  {
    title: 'Cumulative Win Rate',
    dataKey: 'cumulativeWinRate',
    color: '#16a34a',
    refLine: 50,
    refLabel: '50%',
    yFormat: (v) => `${v.toFixed(0)}%`,
    tooltipFormat: (v) => `${v.toFixed(1)}%`,
  },
  {
    title: 'Cumulative Profit Factor',
    dataKey: 'cumulativeProfitFactor',
    color: '#3b82f6',
    refLine: 1,
    refLabel: '1.0',
    yFormat: (v) => v >= 100 ? '∞' : v.toFixed(1),
    tooltipFormat: (v) => v >= 999 ? '∞' : v.toFixed(2),
  },
  {
    title: 'Cumulative Risk-Reward',
    dataKey: 'cumulativeRiskReward',
    color: '#8b5cf6',
    refLine: 1,
    refLabel: '1.0',
    yFormat: (v) => v >= 100 ? '∞' : v.toFixed(1),
    tooltipFormat: (v) => v >= 999 ? '∞' : v.toFixed(2),
  },
  {
    title: 'Cumulative Expectancy',
    dataKey: 'cumulativeExpectancy',
    color: '#f59e0b',
    refLine: 0,
    refLabel: '0',
    yFormat: (v) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0),
    tooltipFormat: (v) => `Rs. ${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  },
]

function MiniChart({ data, config }: { data: ReturnType<typeof calculateCumulativeMetrics>; config: ChartConfig }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-medium text-muted-foreground">{config.title}</CardTitle>
      </CardHeader>
      <CardContent className="px-2 pb-3">
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 15, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="tradeIndex"
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                label={{ value: 'Trade #', position: 'insideBottom', offset: -2, fontSize: 10 }}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                className="text-muted-foreground"
                width={45}
                tickFormatter={config.yFormat}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const val = payload[0].value as number
                  const tradeIdx = (payload[0].payload as { tradeIndex: number }).tradeIndex
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="text-muted-foreground">Trade #{tradeIdx}</p>
                      <p className="font-medium" style={{ color: config.color }}>
                        {config.tooltipFormat ? config.tooltipFormat(val) : val.toFixed(2)}
                      </p>
                    </div>
                  )
                }}
              />
              {config.refLine !== undefined && (
                <ReferenceLine y={config.refLine} stroke="#888" strokeDasharray="3 3" />
              )}
              <Line
                type="monotone"
                dataKey={config.dataKey}
                stroke={config.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function CumulativeMetricsGrid({ fifoMatches }: CumulativeMetricsGridProps) {
  const data = useMemo(() => calculateCumulativeMetrics(fifoMatches), [fifoMatches])

  if (data.length === 0) return null

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">Cumulative Metrics Evolution</h3>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {CHARTS.map((config) => (
          <MiniChart key={config.dataKey} data={data} config={config} />
        ))}
      </div>
    </div>
  )
}
