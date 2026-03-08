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
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { FIFOMatch } from '@/lib/types'

interface DurationDistributionChartProps {
  fifoMatches: FIFOMatch[]
}

interface BucketEntry {
  label: string
  count: number
  percentage: number
  color: string
}

const BUCKETS = [
  { label: 'Intraday', min: 0, max: 0, color: '#16a34a' },
  { label: 'BTST', min: 1, max: 1, color: '#22c55e' },
  { label: '2-4d', min: 2, max: 4, color: '#3b82f6' },
  { label: '5-10d', min: 5, max: 10, color: '#6366f1' },
  { label: '11-20d', min: 11, max: 20, color: '#8b5cf6' },
  { label: '21-50d', min: 21, max: 50, color: '#a855f7' },
  { label: '51+d', min: 51, max: Infinity, color: '#d946ef' },
] as const

export function DurationDistributionChart({ fifoMatches }: DurationDistributionChartProps) {
  const data = useMemo(() => {
    if (fifoMatches.length === 0) return []

    const counts = new Array(BUCKETS.length).fill(0) as number[]
    for (const m of fifoMatches) {
      for (let i = 0; i < BUCKETS.length; i++) {
        if (m.holdingDays >= BUCKETS[i].min && m.holdingDays <= BUCKETS[i].max) {
          counts[i]++
          break
        }
      }
    }

    const total = fifoMatches.length
    return BUCKETS.map((b, i) => ({
      label: b.label,
      count: counts[i],
      percentage: Math.round((counts[i] / total) * 1000) / 10,
      color: b.color,
    }))
  }, [fifoMatches])

  if (data.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Trade Duration Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <YAxis
                tick={{ fontSize: 11 }}
                className="text-muted-foreground"
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as BucketEntry
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.label}</p>
                      <p>{d.count} trades ({d.percentage}%)</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
