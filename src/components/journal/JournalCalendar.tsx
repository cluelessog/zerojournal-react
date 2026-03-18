import { useState, useMemo } from 'react'
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  startOfWeek,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { RawTrade, OrderGroup, JournalEntry, TimelinePoint } from '@/lib/types'
import { CalendarDayCell } from './CalendarDayCell'

interface JournalCalendarProps {
  trades: RawTrade[]
  orderGroups: OrderGroup[]
  timeline: TimelinePoint[]
  journalEntries: JournalEntry[]
  onDayClick: (date: string) => void
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function JournalCalendar({
  trades,
  orderGroups,
  timeline,
  journalEntries,
  onDayClick,
}: JournalCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date())

  // Build a per-day data map using timeline (authoritative P&L with charges)
  const dayDataMap = useMemo(() => {
    const map = new Map<string, { tradeCount: number; pnl: number; hasJournal: boolean }>()

    function getOrCreate(dayStr: string) {
      let entry = map.get(dayStr)
      if (!entry) {
        entry = { tradeCount: 0, pnl: 0, hasJournal: false }
        map.set(dayStr, entry)
      }
      return entry
    }

    // Count all raw trades by date (both buys and sells)
    for (const trade of trades) {
      const dayStr = trade.tradeDate.slice(0, 10)
      getOrCreate(dayStr).tradeCount += 1
    }

    // P&L from timeline (uses SymbolPnL.realizedPnL distributed by FIFO proportions, charges deducted)
    for (const point of timeline) {
      getOrCreate(point.date).pnl = point.dailyNetPnL
    }

    // Journal indicators
    for (const entry of journalEntries) {
      const dayStr = entry.tradeDate.slice(0, 10)
      getOrCreate(dayStr).hasJournal = true
    }

    return map
  }, [trades, timeline, journalEntries])

  // Monthly P&L: sum timeline points for current month (guarantees sum = header)
  const monthPnL = useMemo(() => {
    const monthStr = format(currentMonth, 'yyyy-MM')
    let total = 0
    let trades = 0
    for (const point of timeline) {
      if (point.date.startsWith(monthStr)) {
        total += point.dailyNetPnL
        trades += point.tradeCount
      }
    }
    return { total, trades }
  }, [timeline, currentMonth])

  // Build the array of day cells for the current month grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [currentMonth])

  function handlePrev() {
    setCurrentMonth((d) => subMonths(d, 1))
  }

  function handleNext() {
    setCurrentMonth((d) => addMonths(d, 1))
  }

  return (
    <div className="w-full">
      {/* Month header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={handlePrev}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 tracking-wide">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          {monthPnL.trades > 0 && (
            <p className={`text-xs font-medium mt-0.5 ${
              monthPnL.total > 0
                ? 'text-green-600 dark:text-green-400'
                : monthPnL.total < 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}>
              {monthPnL.total >= 0 ? '+' : ''}
              {Math.abs(monthPnL.total) >= 100000
                ? `Rs. ${(monthPnL.total / 100000).toFixed(2)}L`
                : `Rs. ${monthPnL.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              }
              <span className="text-gray-400 dark:text-gray-500 ml-1.5">
                ({monthPnL.trades} {monthPnL.trades === 1 ? 'trade' : 'trades'})
              </span>
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleNext}
          className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday header row */}
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-center text-[10px] sm:text-xs font-medium text-gray-400 dark:text-gray-500 py-1"
          >
            {label}
          </div>
        ))}

        {/* Day cells */}
        {calendarDays.map((day) => {
          const dayStr = format(day, 'yyyy-MM-dd')
          const data = dayDataMap.get(dayStr)

          return (
            <CalendarDayCell
              key={dayStr}
              date={dayStr}
              dayNumber={day.getDate()}
              tradeCount={data?.tradeCount ?? 0}
              dayPnL={data?.pnl ?? 0}
              hasJournalEntry={data?.hasJournal ?? false}
              isToday={isToday(day)}
              isCurrentMonth={isSameMonth(day, currentMonth)}
              onClick={onDayClick}
            />
          )
        })}
      </div>
    </div>
  )
}
