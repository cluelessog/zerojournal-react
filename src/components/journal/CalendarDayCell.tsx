interface CalendarDayCellProps {
  date: string
  dayNumber: number
  tradeCount: number
  dayPnL: number
  hasJournalEntry: boolean
  isToday: boolean
  isCurrentMonth: boolean
  onClick: (date: string) => void
}

export function CalendarDayCell({
  date,
  dayNumber,
  tradeCount,
  dayPnL,
  hasJournalEntry,
  isToday,
  isCurrentMonth,
  onClick,
}: CalendarDayCellProps) {
  const hasTrades = tradeCount > 0
  const isProfit = hasTrades && dayPnL > 0
  const isLoss = hasTrades && dayPnL < 0

  const bgClass = !isCurrentMonth
    ? ''
    : isProfit
      ? 'bg-green-50 dark:bg-green-950/40'
      : isLoss
        ? 'bg-red-50 dark:bg-red-950/40'
        : 'bg-transparent'

  const todayRing = isToday
    ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-inset'
    : ''

  const dimmed = !isCurrentMonth
    ? 'opacity-35'
    : ''

  const pnlColor = isProfit
    ? 'text-green-700 dark:text-green-400'
    : isLoss
      ? 'text-red-700 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400'

  function formatPnL(val: number): string {
    const abs = Math.abs(val)
    const sign = val >= 0 ? '+' : '-'
    if (abs >= 100000) {
      return `${sign}${(abs / 100000).toFixed(1)}L`
    }
    if (abs >= 1000) {
      return `${sign}${(abs / 1000).toFixed(1)}k`
    }
    return `${sign}${abs.toFixed(0)}`
  }

  return (
    <button
      type="button"
      onClick={() => onClick(date)}
      className={[
        'relative flex flex-col min-h-[64px] sm:min-h-[72px] w-full rounded-md border p-1.5',
        'border-gray-100 dark:border-gray-800',
        'text-left transition-all duration-100',
        'hover:brightness-95 dark:hover:brightness-110 hover:scale-[1.02]',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        bgClass,
        todayRing,
        dimmed,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`${date}${hasTrades ? `, ${tradeCount} trade${tradeCount !== 1 ? 's' : ''}` : ''}${hasJournalEntry ? ', has journal entry' : ''}`}
    >
      {/* Day number + trade count badge row */}
      <div className="flex items-start justify-between w-full">
        <span
          className={[
            'text-xs font-semibold leading-none',
            isToday
              ? 'text-blue-600 dark:text-blue-400'
              : isCurrentMonth
                ? 'text-gray-700 dark:text-gray-200'
                : 'text-gray-400 dark:text-gray-600',
          ].join(' ')}
        >
          {dayNumber}
        </span>

        {hasTrades && (
          <span
            className={[
              'text-[10px] font-medium leading-none px-1 py-0.5 rounded-full',
              isProfit
                ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                : isLoss
                  ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
            ].join(' ')}
          >
            {tradeCount}
          </span>
        )}
      </div>

      {/* P&L amount */}
      {hasTrades && (
        <span className={`mt-auto pt-1 text-[10px] sm:text-xs font-medium leading-none ${pnlColor}`}>
          {formatPnL(dayPnL)}
        </span>
      )}

      {/* Journal entry dot */}
      {hasJournalEntry && (
        <span
          className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-indigo-500 dark:bg-indigo-400"
          aria-hidden="true"
        />
      )}
    </button>
  )
}
