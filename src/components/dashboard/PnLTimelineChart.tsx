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
import { Input } from '@/components/ui/input'
import type { RawTrade, SymbolPnL } from '@/lib/types'
import { buildTimeline } from '@/lib/engine/timeline'
import { usePortfolioStore } from '@/lib/store/portfolio-store'

type Aggregation = 'daily' | 'weekly' | 'monthly'
type ViewMode = 'pnl' | 'portfolio'

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
  viewMode,
  initialCapital,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
  viewMode: ViewMode
  initialCapital: number | null
}) {
  if (!active || !payload || payload.length === 0 || !label) return null

  const dataPoint = payload[0] as unknown as { payload: { dailyPnL: number; cumulativePnL: number } }
  const dateStr = new Date(label).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const cumPnL = dataPoint.payload.cumulativePnL
  const portfolioValue = initialCapital != null ? initialCapital + cumPnL : null

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-medium">{dateStr}</p>
      <p className="text-sm text-muted-foreground">
        Daily P&L:{' '}
        <span className={dataPoint.payload.dailyPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
          Rs. {dataPoint.payload.dailyPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      </p>
      {viewMode === 'portfolio' && portfolioValue != null ? (
        <p className="text-sm text-muted-foreground">
          Portfolio:{' '}
          <span className={portfolioValue >= (initialCapital ?? 0) ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            Rs. {portfolioValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Cumulative:{' '}
          <span className={cumPnL >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
            Rs. {cumPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        </p>
      )}
    </div>
  )
}

export function PnLTimelineChart({ trades, symbolPnL }: PnLTimelineChartProps) {
  const [aggregation, setAggregation] = useState<Aggregation>('daily')
  const [viewMode, setViewMode] = useState<ViewMode>('pnl')
  const [capitalInput, setCapitalInput] = useState('')

  const initialCapital = usePortfolioStore((s) => s.initialCapital)
  const setCapital = usePortfolioStore((s) => s.setInitialCapital)
  const clearCapital = usePortfolioStore((s) => s.clearInitialCapital)

  const timeline = useMemo(
    () => buildTimeline(trades, symbolPnL, aggregation),
    [trades, symbolPnL, aggregation]
  )

  // Transform timeline for portfolio value view
  const chartData = useMemo(() => {
    if (viewMode === 'portfolio' && initialCapital != null) {
      return timeline.map((point) => ({
        ...point,
        portfolioValue: initialCapital + point.cumulativePnL,
      }))
    }
    return timeline
  }, [timeline, viewMode, initialCapital])

  const aggregationOptions: { key: Aggregation; label: string }[] = [
    { key: 'daily', label: 'D' },
    { key: 'weekly', label: 'W' },
    { key: 'monthly', label: 'M' },
  ]

  function handleCapitalSubmit() {
    const val = parseFloat(capitalInput.replace(/,/g, ''))
    if (!isNaN(val) && val > 0) {
      setCapital(val)
      setViewMode('portfolio')
    }
  }

  function handleCapitalClear() {
    clearCapital()
    setCapitalInput('')
    setViewMode('pnl')
  }

  const isPortfolioMode = viewMode === 'portfolio' && initialCapital != null
  const referenceLineY = isPortfolioMode ? initialCapital : 0
  const dataKey = isPortfolioMode ? 'portfolioValue' : 'cumulativePnL'

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">P&L Timeline</CardTitle>
        <div className="flex items-center gap-2">
          {/* View toggle (only visible when initial capital is set) */}
          {initialCapital != null && (
            <div className="flex gap-1">
              <Button
                variant={viewMode === 'pnl' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setViewMode('pnl')}
              >
                P&L
              </Button>
              <Button
                variant={viewMode === 'portfolio' ? 'default' : 'outline'}
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setViewMode('portfolio')}
              >
                Portfolio
              </Button>
            </div>
          )}
          {/* Aggregation buttons */}
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
        </div>
      </CardHeader>
      <CardContent>
        {/* Initial capital input row */}
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Initial Capital (Rs.):</span>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="e.g. 100000"
            value={initialCapital != null && capitalInput === '' ? initialCapital.toLocaleString('en-IN') : capitalInput}
            onChange={(e) => setCapitalInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCapitalSubmit()}
            className="h-7 w-32 text-xs"
          />
          <Button size="sm" className="h-7 px-2 text-xs" onClick={handleCapitalSubmit}>
            Set
          </Button>
          {initialCapital != null && (
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleCapitalClear}>
              Clear
            </Button>
          )}
        </div>

        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
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
                width={65}
              />
              <RechartsTooltip
                content={
                  <CustomTooltip
                    viewMode={viewMode}
                    initialCapital={initialCapital}
                  />
                }
              />
              <ReferenceLine y={referenceLineY} stroke="#888" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey={dataKey}
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
          {isPortfolioMode
            ? `Portfolio Value = Rs. ${initialCapital.toLocaleString('en-IN')} + Cumulative P&L. P&L attributed to position close date.`
            : 'P&L attributed to position close date. Daily attribution is approximate.'}
        </p>
      </CardContent>
    </Card>
  )
}
