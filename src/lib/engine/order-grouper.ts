import type { RawTrade, OrderGroup } from '@/lib/types'

/**
 * Group trades by orderId into OrderGroups.
 *
 * Each unique orderId becomes one OrderGroup. Within a group:
 * - All trades share the same symbol and tradeType (buy or sell)
 * - totalQuantity = sum(trade.quantity)
 * - weightedAvgPrice = sum(trade.quantity * trade.price) / totalQuantity
 *
 * Expected from sample data: 741 unique order groups, 427 with multiple fills.
 */
export function groupOrders(trades: RawTrade[]): OrderGroup[] {
  if (trades.length === 0) return []

  // Group trades by orderId
  const orderMap = new Map<string, RawTrade[]>()
  for (const trade of trades) {
    const existing = orderMap.get(trade.orderId)
    if (existing) {
      existing.push(trade)
    } else {
      orderMap.set(trade.orderId, [trade])
    }
  }

  const groups: OrderGroup[] = []

  for (const [orderId, orderTrades] of orderMap) {
    const first = orderTrades[0]
    const symbol = first.symbol
    const isin = first.isin
    const isBuy = first.tradeType === 'buy'

    const buyTrades = orderTrades.filter((t) => t.tradeType === 'buy')
    const sellTrades = orderTrades.filter((t) => t.tradeType === 'sell')

    // Compute buy-side aggregates
    const totalBuyQty = buyTrades.reduce((sum, t) => sum + t.quantity, 0)
    const totalBuyValue = buyTrades.reduce((sum, t) => sum + t.quantity * t.price, 0)
    const avgBuyPrice = totalBuyQty > 0 ? totalBuyValue / totalBuyQty : 0

    // Compute sell-side aggregates
    const totalSellQty = sellTrades.reduce((sum, t) => sum + t.quantity, 0)
    const totalSellValue = sellTrades.reduce((sum, t) => sum + t.quantity * t.price, 0)
    const avgSellPrice = totalSellQty > 0 ? totalSellValue / totalSellQty : 0

    // Determine dates
    const allDates = orderTrades.map((t) => t.tradeDate).sort()
    const openDate = allDates[0]
    const closeDate = totalSellQty > 0 ? allDates[allDates.length - 1] : null

    // Status: closed if sell qty matches buy qty
    const status = totalSellQty >= totalBuyQty && totalSellQty > 0 ? 'closed' : 'open'

    // Side: determined by the order's trade type
    const side = isBuy ? 'long' : 'short'

    // Realized P&L for matched quantities
    const matchedQty = Math.min(totalBuyQty, totalSellQty)
    const realizedPnL =
      matchedQty > 0 ? matchedQty * (avgSellPrice - avgBuyPrice) : 0

    // Holding days
    let holdingDays = 0
    if (closeDate && openDate) {
      const diff = new Date(closeDate).getTime() - new Date(openDate).getTime()
      holdingDays = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
    }

    groups.push({
      id: orderId,
      symbol,
      isin,
      openDate,
      closeDate,
      status,
      side,
      buyTrades,
      sellTrades,
      totalBuyQty,
      totalSellQty,
      avgBuyPrice: Math.round(avgBuyPrice * 100) / 100,
      avgSellPrice: Math.round(avgSellPrice * 100) / 100,
      realizedPnL: Math.round(realizedPnL * 100) / 100,
      unrealizedPnL: 0,
      charges: 0,
      netPnL: Math.round(realizedPnL * 100) / 100,
      holdingDays,
      mae: 0,
      mfe: 0,
    })
  }

  // Sort by openDate
  groups.sort((a, b) => a.openDate.localeCompare(b.openDate))

  return groups
}
