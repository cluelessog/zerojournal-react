import type { RawTrade, SymbolPnL, TimelinePoint } from '@/lib/types'
import { startOfWeek, startOfMonth, format } from 'date-fns'
import { buildTradeAttributions } from '@/lib/engine/analytics'
import { matchTradesWithPnL } from '@/lib/engine/fifo-matcher'

type Aggregation = 'daily' | 'weekly' | 'monthly'

/**
 * Build a P&L timeline by attributing each symbol's realized P&L
 * across its sell dates using FIFO-matched per-trade P&L proportions.
 *
 * This ensures that a symbol with +15k profit on one date and -5k loss
 * on another shows the actual per-date P&L, not a quantity-weighted average.
 *
 * Falls back to quantity-weighted attribution (buildTradeAttributions) when
 * FIFO total P&L for a symbol is zero (wins and losses cancel out).
 *
 * Open positions (openQuantity !== 0) are excluded from the timeline.
 *
 * When totalCharges is provided, charges are distributed across dates
 * proportionally by turnover. Turnover is distributed using quantity-weighted
 * attribution (since charges scale with trade value, not P&L).
 */
export function buildTimeline(
  trades: RawTrade[],
  symbolPnL: SymbolPnL[],
  aggregation: Aggregation = 'daily',
  totalCharges: number = 0,
): TimelinePoint[] {
  // FIFO matches for actual per-trade P&L
  const fifoMatches = matchTradesWithPnL(trades)

  // Group FIFO P&L by (symbol, sellDate) and compute per-symbol totals
  const fifoPnLBySymbolDate = new Map<string, Map<string, number>>()
  const fifoPnLBySymbol = new Map<string, number>()
  for (const m of fifoMatches) {
    let datePnL = fifoPnLBySymbolDate.get(m.symbol)
    if (!datePnL) {
      datePnL = new Map()
      fifoPnLBySymbolDate.set(m.symbol, datePnL)
    }
    datePnL.set(m.sellDate, (datePnL.get(m.sellDate) ?? 0) + m.pnl)
    fifoPnLBySymbol.set(m.symbol, (fifoPnLBySymbol.get(m.symbol) ?? 0) + m.pnl)
  }

  // Quantity-weighted attributions: used for turnover distribution and P&L fallback
  const quantityAttributions = buildTradeAttributions(trades)

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

    const totalTurnover = symbolTurnover.get(s.symbol) ?? 0
    const fifoDateMap = fifoPnLBySymbolDate.get(s.symbol)
    const fifoTotal = fifoPnLBySymbol.get(s.symbol)

    // Use FIFO P&L proportions when available and non-zero total
    if (fifoDateMap && fifoTotal != null && fifoTotal !== 0) {
      for (const [date, datePnL] of fifoDateMap) {
        const pnlWeight = datePnL / fifoTotal
        const dateKey = toAggregationKey(date, aggregation)
        const existing = dateMap.get(dateKey) ?? { pnl: 0, count: 0, turnover: 0 }
        existing.pnl += s.realizedPnL * pnlWeight
        // Turnover uses quantity-weighted attribution (charges scale with trade value, not P&L)
        const qtyAttrs = quantityAttributions.get(s.symbol)
        const qtyWeight = qtyAttrs?.find((a) => a.date === date)?.weight ?? 0
        existing.turnover += totalTurnover * qtyWeight
        existing.count += sellTradeCount.get(s.symbol)?.get(date) ?? 0
        dateMap.set(dateKey, existing)
      }
    } else {
      // Fallback: quantity-weighted attribution (when FIFO total is 0 or no matches)
      const attrs = quantityAttributions.get(s.symbol)
      if (!attrs) continue

      for (const { date, weight } of attrs) {
        const dateKey = toAggregationKey(date, aggregation)
        const existing = dateMap.get(dateKey) ?? { pnl: 0, count: 0, turnover: 0 }
        existing.pnl += s.realizedPnL * weight
        existing.turnover += totalTurnover * weight
        existing.count += sellTradeCount.get(s.symbol)?.get(date) ?? 0
        dateMap.set(dateKey, existing)
      }
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
