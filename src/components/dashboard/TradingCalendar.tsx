import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { RawTrade } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TradingCalendarProps {
  trades: RawTrade[]
}

function getIntensityClass(count: number, maxCount: number): string {
  if (count === 0) return 'bg-muted'
  const ratio = count / maxCount
  if (ratio <= 0.25) return 'bg-green-200 dark:bg-green-900'
  if (ratio <= 0.5) return 'bg-green-400 dark:bg-green-700'
  if (ratio <= 0.75) return 'bg-green-500 dark:bg-green-600'
  return 'bg-green-600 dark:bg-green-500'
}

export function TradingCalendar({ trades }: TradingCalendarProps) {
  const { weeks, maxCount, tradingDayCount } = useMemo(() => {
    // Count trades per date
    const dateMap = new Map<string, number>()
    for (const t of trades) {
      dateMap.set(t.tradeDate, (dateMap.get(t.tradeDate) ?? 0) + 1)
    }

    const tradingDayCount = dateMap.size
    let maxCount = 0
    for (const c of dateMap.values()) {
      if (c > maxCount) maxCount = c
    }

    // Find date range
    const dates = [...dateMap.keys()].sort()
    if (dates.length === 0) return { weeks: [], maxCount: 0, tradingDayCount: 0 }

    const startDate = new Date(dates[0])
    const endDate = new Date(dates[dates.length - 1])

    // Adjust start to Monday
    const dayOfWeek = startDate.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const calStart = new Date(startDate)
    calStart.setDate(calStart.getDate() + mondayOffset)

    // Build weeks grid
    const weeks: { date: string; count: number; dayLabel: string }[][] = []
    const current = new Date(calStart)

    while (current <= endDate) {
      const week: { date: string; count: number; dayLabel: string }[] = []
      for (let d = 0; d < 7; d++) {
        const dateStr = current.toISOString().split('T')[0]
        week.push({
          date: dateStr,
          count: dateMap.get(dateStr) ?? 0,
          dayLabel: current.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        })
        current.setDate(current.getDate() + 1)
      }
      weeks.push(week)
    }

    return { weeks, maxCount, tradingDayCount }
  }, [trades])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          Trading Calendar{' '}
          <span className="text-sm font-normal text-muted-foreground">
            ({tradingDayCount} active days)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex gap-[2px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => (
                  <TooltipProvider key={di}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={cn(
                            'h-3 w-3 rounded-[2px]',
                            getIntensityClass(day.count, maxCount)
                          )}
                        />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>
                          {day.dayLabel}: {day.count} trade{day.count !== 1 ? 's' : ''}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-[2px]">
            <div className="h-3 w-3 rounded-[2px] bg-muted" />
            <div className="h-3 w-3 rounded-[2px] bg-green-200 dark:bg-green-900" />
            <div className="h-3 w-3 rounded-[2px] bg-green-400 dark:bg-green-700" />
            <div className="h-3 w-3 rounded-[2px] bg-green-500 dark:bg-green-600" />
            <div className="h-3 w-3 rounded-[2px] bg-green-600 dark:bg-green-500" />
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
