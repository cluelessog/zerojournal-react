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
import type { SymbolPnL } from '@/lib/types'

interface WinLossDistributionProps {
  symbolPnL: SymbolPnL[]
}

interface BucketData {
  label: string
  count: number
  isWin: boolean
}

const BUCKETS: { label: string; min: number; max: number; isWin: boolean }[] = [
  { label: '< -5K', min: -Infinity, max: -5000, isWin: false },
  { label: '-5K to -1K', min: -5000, max: -1000, isWin: false },
  { label: '-1K to 0', min: -1000, max: 0, isWin: false },
  { label: '0', min: 0, max: 0, isWin: false },
  { label: '0 to 1K', min: 0, max: 1000, isWin: true },
  { label: '1K to 5K', min: 1000, max: 5000, isWin: true },
  { label: '> 5K', min: 5000, max: Infinity, isWin: true },
]

function classifyIntoBucket(pnl: number): number {
  if (pnl < -5000) return 0
  if (pnl >= -5000 && pnl < -1000) return 1
  if (pnl >= -1000 && pnl < 0) return 2
  if (pnl === 0) return 3
  if (pnl > 0 && pnl <= 1000) return 4
  if (pnl > 1000 && pnl <= 5000) return 5
  return 6 // > 5000
}

export function WinLossDistribution({ symbolPnL }: WinLossDistributionProps) {
  const data = useMemo(() => {
    const counts = new Array(BUCKETS.length).fill(0)

    // Only count closed positions
    for (const s of symbolPnL) {
      if (s.openQuantity > 0) continue
      counts[classifyIntoBucket(s.realizedPnL)]++
    }

    return BUCKETS.map((bucket, i) => ({
      label: bucket.label,
      count: counts[i],
      isWin: bucket.isWin,
    }))
  }, [symbolPnL])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Win/Loss Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as BucketData
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.label}</p>
                      <p className="text-muted-foreground">{d.count} symbols</p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.label === '0'
                        ? '#9ca3af'
                        : entry.isWin
                          ? '#16a34a'
                          : '#dc2626'
                    }
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
