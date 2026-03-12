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
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { RollingExpectancyPoint } from '@/lib/types'

interface RollingExpectancyChartProps {
  data: RollingExpectancyPoint[]
  window?: number
}

const TREND_THRESHOLD = 1 // Rs. — below this, trend is "Flat"
const COLLAPSE_THRESHOLD = 10 // Rs. — below this, merge initial/current into one line
const ZERO_COLLISION_THRESHOLD = 5 // Rs. — skip reference line if too close to zero

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>
  label?: number
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1 text-sm font-medium">Trade #{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="text-xs text-muted-foreground">
          <span style={{ color: p.color }}>{p.name}: </span>
          <span className={p.value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            Rs. {p.value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </p>
      ))}
    </div>
  )
}

export function RollingExpectancyChart({ data, window = 20 }: RollingExpectancyChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Rolling {window}-Trade Expectancy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            Need at least {window} FIFO-matched trades to compute rolling expectancy.
          </div>
        </CardContent>
      </Card>
    )
  }

  const { initialExpectancy, currentExpectancy, trend, collapsed } = useMemo(() => {
    const initial = data[0].overall
    const current = data[data.length - 1].overall
    const diff = current - initial
    let trendDir: 'improving' | 'declining' | 'flat'
    if (diff > TREND_THRESHOLD) trendDir = 'improving'
    else if (diff < -TREND_THRESHOLD) trendDir = 'declining'
    else trendDir = 'flat'
    return {
      initialExpectancy: initial,
      currentExpectancy: current,
      trend: trendDir,
      collapsed: Math.abs(diff) < COLLAPSE_THRESHOLD,
    }
  }, [data])

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus
  const trendColorClass =
    trend === 'improving'
      ? 'text-green-600 dark:text-green-400'
      : trend === 'declining'
        ? 'text-red-600 dark:text-red-400'
        : 'text-muted-foreground'
  const trendLabel = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Flat'

  const showInitialLine = Math.abs(initialExpectancy) > ZERO_COLLISION_THRESHOLD
  const showCurrentLine = Math.abs(currentExpectancy) > ZERO_COLLISION_THRESHOLD

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          Rolling {window}-Trade Expectancy
          <span data-testid="trend-badge" className={`inline-flex items-center gap-1 text-xs font-medium ${trendColorClass}`}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trendLabel}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="tradeNumber"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                label={{ value: 'Trade #', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                width={60}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) =>
                  value === 'overall' ? 'Overall' : value === 'intraday' ? 'Intraday' : 'Swing'
                }
              />
              <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
              {/* Initial expectancy reference line */}
              {showInitialLine && (
                <ReferenceLine
                  y={initialExpectancy}
                  stroke="#9333ea"
                  strokeDasharray="6 4"
                  label={{ value: collapsed ? 'Initial ≈ Current' : 'Initial', position: 'right', fontSize: 10, fill: '#9333ea' }}
                />
              )}
              {/* Current expectancy reference line (hidden when collapsed with initial) */}
              {showCurrentLine && !collapsed && (
                <ReferenceLine
                  y={currentExpectancy}
                  stroke="#0891b2"
                  strokeDasharray="6 4"
                  label={{ value: 'Current', position: 'right', fontSize: 10, fill: '#0891b2' }}
                />
              )}
              {/* Overall: solid blue */}
              <Line
                type="monotone"
                dataKey="overall"
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
                name="overall"
              />
              {/* Intraday: dashed green */}
              <Line
                type="monotone"
                dataKey="intraday"
                stroke="#16a34a"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 3 }}
                name="intraday"
              />
              {/* Swing: dotted orange */}
              <Line
                type="monotone"
                dataKey="swing"
                stroke="#ea580c"
                strokeWidth={1.5}
                strokeDasharray="2 4"
                dot={false}
                activeDot={{ r: 3 }}
                name="swing"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Rolling {window}-trade window. Dashed lines show initial and current overall expectancy.
        </p>
      </CardContent>
    </Card>
  )
}
