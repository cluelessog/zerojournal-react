import type { RawTrade, SymbolPnL, TimelinePoint } from '@/lib/types'
import { startOfWeek, startOfMonth, format } from 'date-fns'
import { buildTradeAttributions } from '@/lib/engine/analytics'

type Aggregation = 'daily' | 'weekly' | 'monthly'

/**
 * Build a P&L timeline by attributing each symbol's realized P&L
 * across its sell dates proportionally by sell quantity (per-sell-date attribution).
 *
 * Open positions (openQuantity !== 0) are excluded from the timeline.
 *
 * When totalCharges is provided, charges are distributed across dates
 * proportionally by turnover. Each symbol's total turnover is distributed
 * across sell dates using the same attribution weights as P&L.
 */
export function buildTimeline(
  trades: RawTrade[],
  symbolPnL: SymbolPnL[],
  aggregation: Aggregation = 'daily',
  totalCharges: number = 0,
): TimelinePoint[] {
  // Per-sell-date attribution: distributes P&L by sell quantity per date
  const attributions = buildTradeAttributions(trades)

  // Build map: symbol -> total turnover (sum of price × quantity for all trades)
  const symbolTurnover = new Map<string, number>()
  for (const t of trades) {
    symbolTurnover.set(t.symbol, (symbolTurnover.get(t.symbol) ?? 0) + t.price * t.quantity)
  }

  // Build map: (symbol, date) -> sell trade row count
  const sellTradeCount = new Map<string, Map<string, number>>()
  for (const t of trades) {
    if (t.tradeType !== 'sell') continue
    let dateCounts = sellTradeCount.get(t.symbol)
    if (!dateCounts) {
      dateCounts = new Map()
      sellTradeCount.set(t.symbol, dateCounts)
    }
    dateCounts.set(t.tradeDate, (dateCounts.get(t.tradeDate) ?? 0) + 1)
  }

  // Attribute each closed symbol's P&L, turnover, and trade count across sell dates
  const dateMap = new Map<string, { pnl: number; count: number; turnover: number }>()

  for (const s of symbolPnL) {
    // Skip open positions (both long and short) — only closed positions contribute to the timeline
    if (s.openQuantity !== 0) continue

    const attrs = attributions.get(s.symbol)
    if (!attrs) continue

    const totalTurnover = symbolTurnover.get(s.symbol) ?? 0

    for (const { date, weight } of attrs) {
      const dateKey = toAggregationKey(date, aggregation)
      const existing = dateMap.get(dateKey) ?? { pnl: 0, count: 0, turnover: 0 }
      existing.pnl += s.realizedPnL * weight
      existing.turnover += totalTurnover * weight
      existing.count += sellTradeCount.get(s.symbol)?.get(date) ?? 0
      dateMap.set(dateKey, existing)
    }
  }

  // Total turnover for closed symbols (for charge distribution)
  let totalClosedTurnover = 0
  for (const entry of dateMap.values()) {
    totalClosedTurnover += entry.turnover
  }

  // Sort dates and compute cumulative P&L (gross and net)
  const sortedDates = [...dateMap.keys()].sort()
  const timeline: TimelinePoint[] = []
  let cumulativeGross = 0
  let cumulativeNet = 0
  let allocatedCharges = 0

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i]
    const entry = dateMap.get(date)!

    // Distribute charges proportionally by turnover
    let dayCharges: number
    if (i === sortedDates.length - 1) {
      // Last date gets remainder to avoid rounding drift
      dayCharges = totalCharges - allocatedCharges
    } else {
      dayCharges = totalClosedTurnover > 0
        ? totalCharges * (entry.turnover / totalClosedTurnover)
        : 0
    }
    allocatedCharges += dayCharges

    const dailyGross = Math.round(entry.pnl * 100) / 100
    const dailyNet = Math.round((entry.pnl - dayCharges) * 100) / 100
    dayCharges = Math.round(dayCharges * 100) / 100

    cumulativeGross += dailyGross
    cumulativeNet += dailyNet

    timeline.push({
      date,
      dailyPnL: dailyGross,
      cumulativePnL: Math.round(cumulativeGross * 100) / 100,
      dailyNetPnL: dailyNet,
      cumulativeNetPnL: Math.round(cumulativeNet * 100) / 100,
      dailyCharges: dayCharges,
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
