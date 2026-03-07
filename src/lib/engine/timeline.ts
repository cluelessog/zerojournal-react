import type { RawTrade, SymbolPnL, TimelinePoint } from '@/lib/types'
import { startOfWeek, startOfMonth, format } from 'date-fns'

type Aggregation = 'daily' | 'weekly' | 'monthly'

/**
 * Build a P&L timeline by attributing each symbol's realized P&L
 * to the last sell date for that symbol (v1 simplification per ADR-005).
 *
 * Open positions (openQuantity !== 0) are excluded from the timeline.
 *
 * When totalCharges is provided, charges are distributed across dates
 * proportionally by turnover (sum of price × quantity for all trades
 * of symbols closing on that date). This matches how charges actually
 * accrue: STT, brokerage, and exchange fees all scale with trade value.
 */
export function buildTimeline(
  trades: RawTrade[],
  symbolPnL: SymbolPnL[],
  aggregation: Aggregation = 'daily',
  totalCharges: number = 0,
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

  // Build map: symbol -> trade count
  const tradeCountBySymbol = new Map<string, number>()
  // Build map: symbol -> total turnover (sum of price × quantity for all trades)
  const symbolTurnover = new Map<string, number>()
  for (const t of trades) {
    tradeCountBySymbol.set(t.symbol, (tradeCountBySymbol.get(t.symbol) ?? 0) + 1)
    symbolTurnover.set(t.symbol, (symbolTurnover.get(t.symbol) ?? 0) + t.price * t.quantity)
  }

  // Attribute each closed symbol's P&L and turnover to its last sell date
  const dateMap = new Map<string, { pnl: number; count: number; turnover: number }>()

  for (const s of symbolPnL) {
    // Skip open positions (both long and short) — only closed positions contribute to the timeline
    if (s.openQuantity !== 0) continue

    const closeDate = lastSellDate.get(s.symbol)
    if (!closeDate) continue

    const dateKey = toAggregationKey(closeDate, aggregation)
    const existing = dateMap.get(dateKey) ?? { pnl: 0, count: 0, turnover: 0 }
    existing.pnl += s.realizedPnL
    existing.count += tradeCountBySymbol.get(s.symbol) ?? 0
    existing.turnover += symbolTurnover.get(s.symbol) ?? 0
    dateMap.set(dateKey, existing)
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
