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
import type { RawTrade } from '@/lib/types'

interface MonthlyVolumeChartProps {
  trades: RawTrade[]
}

interface MonthlyData {
  month: string
  trades: number
}

export function MonthlyVolumeChart({ trades }: MonthlyVolumeChartProps) {
  const data = useMemo(() => {
    const monthMap = new Map<string, number>()

    for (const t of trades) {
      const date = new Date(t.tradeDate)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
    }

    // Sort by date key
    const sorted = [...monthMap.entries()].sort(([a], [b]) => a.localeCompare(b))

    return sorted.map(([key, count]): MonthlyData => {
      const [year, month] = key.split('-')
      const date = new Date(parseInt(year), parseInt(month) - 1)
      const label = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      return { month: label, trades: count }
    })
  }, [trades])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Monthly Trade Volume</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as MonthlyData
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.month}</p>
                      <p className="text-muted-foreground">{d.trades} trades</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="trades" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
