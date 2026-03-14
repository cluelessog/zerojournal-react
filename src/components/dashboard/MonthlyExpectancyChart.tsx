import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { MonthlyMetric } from '@/lib/types'

interface MonthlyExpectancyChartProps {
  monthlyBreakdown: MonthlyMetric[]
}

interface ChartDataPoint {
  month: string
  overall: number
  intraday: number | null
  swing: number | null
  intradayCount: number
  swingCount: number
  totalCount: number
}

function formatMonth(month: string): string {
  const [year, m] = month.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} '${year.slice(2)}`
}

function fmtINR(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 2 })
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number | null; dataKey: string; color: string; name: string; payload: ChartDataPoint }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const d = payload[0]?.payload

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="mb-1.5 text-sm font-medium">{label}</p>
      {d && (
        <>
          <p className="text-xs">
            <span className="text-muted-foreground">Overall: </span>
            <span className={d.overall >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
              Rs. {fmtINR(d.overall)}
            </span>
            <span className="text-muted-foreground"> ({d.totalCount} trades)</span>
          </p>
          <p className="text-xs">
            <span style={{ color: '#16a34a' }}>Intraday: </span>
            {d.intraday != null ? (
              <>
                <span className={d.intraday >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  Rs. {fmtINR(d.intraday)}
                </span>
                <span className="text-muted-foreground"> ({d.intradayCount} trades)</span>
              </>
            ) : (
              <span className="text-muted-foreground">No trades</span>
            )}
          </p>
          <p className="text-xs">
            <span style={{ color: '#ea580c' }}>Swing: </span>
            {d.swing != null ? (
              <>
                <span className={d.swing >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                  Rs. {fmtINR(d.swing)}
                </span>
                <span className="text-muted-foreground"> ({d.swingCount} trades)</span>
              </>
            ) : (
              <span className="text-muted-foreground">No trades</span>
            )}
          </p>
        </>
      )}
    </div>
  )
}

export function MonthlyExpectancyChart({ monthlyBreakdown }: MonthlyExpectancyChartProps) {
  const chartData = useMemo(() => {
    return monthlyBreakdown
      .filter((m) => m.overallExpectancy != null)
      .map((m): ChartDataPoint => ({
        month: formatMonth(m.month),
        overall: m.overallExpectancy!,
        intraday: m.intradayExpectancy ?? null,
        swing: m.swingExpectancy ?? null,
        intradayCount: m.intradayCount ?? 0,
        swingCount: m.swingCount ?? 0,
        totalCount: m.trades,
      }))
  }, [monthlyBreakdown])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            Monthly Expectancy by Style
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            No monthly expectancy data available.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Monthly Expectancy by Style
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          INR per trade — intraday (holdingDays = 0) vs swing (holdingDays &gt; 0)
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
                width={60}
                tickFormatter={(v: number) => Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}K` : v.toFixed(0)}
              />
              <RechartsTooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="#888" strokeDasharray="3 3" />
              <Bar
                dataKey="intraday"
                name="Intraday"
                fill="#16a34a"
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="swing"
                name="Swing"
                fill="#ea580c"
                radius={[2, 2, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
