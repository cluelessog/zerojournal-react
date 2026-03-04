import type { RawTrade, SymbolPnL, TimelinePoint } from '@/lib/types'
import { startOfWeek, startOfMonth, format } from 'date-fns'

type Aggregation = 'daily' | 'weekly' | 'monthly'

/**
 * Build a P&L timeline by attributing each symbol's realized P&L
 * to the last sell date for that symbol (v1 simplification per ADR-005).
 *
 * Open positions (openQuantity !== 0) are excluded from the timeline.
 */
export function buildTimeline(
  trades: RawTrade[],
  symbolPnL: SymbolPnL[],
  aggregation: Aggregation = 'daily'
): TimelinePoint[] {
  // Build map: symbol -> last sell date
  const lastSellDate = new Map<string, string>()
  for (const t of trades) {
    if (t.tradeType === 'sell') {
      const existing = lastSellDate.get(t.symbol)
      if (!existing || t.tradeDate > existing) {
        lastSellDate.set(t.symbol, t.tradeDate)
      }
    }
  }

  // Build map: symbol -> trade count on last sell date
  const tradeCountBySymbol = new Map<string, number>()
  for (const t of trades) {
    const key = t.symbol
    tradeCountBySymbol.set(key, (tradeCountBySymbol.get(key) ?? 0) + 1)
  }

  // Attribute each closed symbol's P&L to its last sell date
  const dateMap = new Map<string, { pnl: number; count: number }>()

  for (const s of symbolPnL) {
    // Skip open positions (both long and short) — only closed positions contribute to the timeline
    if (s.openQuantity !== 0) continue

    const closeDate = lastSellDate.get(s.symbol)
    if (!closeDate) continue

    const dateKey = toAggregationKey(closeDate, aggregation)
    const existing = dateMap.get(dateKey) ?? { pnl: 0, count: 0 }
    existing.pnl += s.realizedPnL
    existing.count += tradeCountBySymbol.get(s.symbol) ?? 0
    dateMap.set(dateKey, existing)
  }

  // Sort dates and compute cumulative P&L
  const sortedDates = [...dateMap.keys()].sort()
  const timeline: TimelinePoint[] = []
  let cumulative = 0

  for (const date of sortedDates) {
    const entry = dateMap.get(date)!
    cumulative += entry.pnl
    timeline.push({
      date,
      dailyPnL: Math.round(entry.pnl * 100) / 100,
      cumulativePnL: Math.round(cumulative * 100) / 100,
      tradeCount: entry.count,
    })
  }

  return timeline
}

function toAggregationKey(isoDate: string, aggregation: Aggregation): string {
  const date = new Date(isoDate)
  switch (aggregation) {
    case 'daily':
      return isoDate
    case 'weekly':
      return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
    case 'monthly':
      return format(startOfMonth(date), 'yyyy-MM-dd')
  }
}
