import type { RawTrade, FIFOMatch } from '@/lib/types'

interface BuyEntry {
  date: string
  price: number
  quantity: number
  execTime: string
  tradeId: string
}

/**
 * FIFO trade matcher: matches buy trades to sell trades per symbol
 * using First-In-First-Out ordering by (tradeDate, orderExecutionTime, tradeId).
 *
 * Rules:
 * - Orphan sells (no matching buys in queue) are skipped gracefully.
 * - Negative holding days are skipped (data anomaly).
 * - Partial fills are handled: a sell can consume multiple buys, a buy can be
 *   partially consumed by a sell.
 * - Intraday (holdingDays === 0) and swing (holdingDays > 0) are both included.
 */
export function matchTradesWithPnL(trades: RawTrade[]): FIFOMatch[] {
  const matches: FIFOMatch[] = []

  // Group trades by symbol
  const bySymbol = new Map<string, RawTrade[]>()
  for (const t of trades) {
    const group = bySymbol.get(t.symbol)
    if (group) {
      group.push(t)
    } else {
      bySymbol.set(t.symbol, [t])
    }
  }

  for (const [symbol, symbolTrades] of bySymbol) {
    // Sort by tradeDate, orderExecutionTime, tradeId for deterministic FIFO order
    const sorted = [...symbolTrades].sort((a, b) => {
      if (a.tradeDate !== b.tradeDate) return a.tradeDate < b.tradeDate ? -1 : 1
      if (a.orderExecutionTime !== b.orderExecutionTime) {
        return a.orderExecutionTime < b.orderExecutionTime ? -1 : 1
      }
      return String(a.tradeId) < String(b.tradeId) ? -1 : 1
    })

    const buyQueue: BuyEntry[] = []

    for (const trade of sorted) {
      if (trade.tradeType === 'buy') {
        buyQueue.push({
          date: trade.tradeDate,
          price: trade.price,
          quantity: trade.quantity,
          execTime: trade.orderExecutionTime,
          tradeId: trade.tradeId,
        })
      } else if (trade.tradeType === 'sell') {
        // Match sell against earliest buys (FIFO)
        let remainingSell = trade.quantity
        const sellDate = trade.tradeDate
        const sellPrice = trade.price

        while (remainingSell > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]

          const holdingDays = dateDiffDays(buy.date, sellDate)

          // Skip negative holding days (data anomaly)
          if (holdingDays < 0) {
            buyQueue.shift()
            continue
          }

          const matchQty = Math.min(buy.quantity, remainingSell)
          const pnl = (sellPrice - buy.price) * matchQty

          matches.push({
            symbol,
            buyDate: buy.date,
            sellDate,
            quantity: matchQty,
            buyPrice: buy.price,
            sellPrice,
            pnl,
            holdingDays,
          })

          buy.quantity -= matchQty
          remainingSell -= matchQty

          if (buy.quantity === 0) {
            buyQueue.shift()
          }
        }
        // If remainingSell > 0 after exhausting buyQueue, this is an orphan sell
        // (carry-forward position with no matching buys in this dataset) — skip gracefully
      }
    }
  }

  return matches
}

/**
 * Calculate the number of calendar days between two ISO date strings.
 */
function dateDiffDays(from: string, to: string): number {
  const d1 = new Date(from)
  const d2 = new Date(to)
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}
