import type { PortfolioSnapshot, TradeAnalytics } from '@/lib/types'

/**
 * Compute portfolio-level analytics from a full snapshot.
 *
 * Uses symbolPnL (from PnL file) as the authoritative source for
 * win/loss classification, best/worst trades, and realized P&L.
 * Uses trades[] for trading-day count and trade totals.
 */
export function computeAnalytics(snapshot: PortfolioSnapshot): TradeAnalytics {
  const { trades, symbolPnL, pnlSummary, orderGroups } = snapshot

  // --- Trade counts ---
  const totalTrades = trades.length
  const totalSymbols = new Set(symbolPnL.map((s) => s.symbol)).size
  const tradingDays = new Set(trades.map((t) => t.tradeDate)).size
  const avgTradesPerDay = tradingDays > 0 ? totalTrades / tradingDays : 0

  // --- Win/loss from symbolPnL (PnL file is authoritative) ---
  // Exclude open positions (openQuantity > 0) from win/loss classification
  const closedSymbols = symbolPnL.filter((s) => s.openQuantity === 0)

  const winners = closedSymbols.filter((s) => s.realizedPnL > 0)
  const losers = closedSymbols.filter((s) => s.realizedPnL < 0)
  const breakEven = closedSymbols.filter((s) => s.realizedPnL === 0)

  const winningTrades = winners.length
  const losingTrades = losers.length
  const breakEvenTrades = breakEven.length

  const totalClosed = winningTrades + losingTrades + breakEvenTrades
  const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0

  // --- Avg win / avg loss ---
  const totalWinPnL = winners.reduce((sum, s) => sum + s.realizedPnL, 0)
  const totalLossPnL = losers.reduce((sum, s) => sum + s.realizedPnL, 0)

  const avgWin = winningTrades > 0 ? totalWinPnL / winningTrades : 0
  const avgLoss = losingTrades > 0 ? totalLossPnL / losingTrades : 0

  // --- Profit factor: sum(wins) / abs(sum(losses)) ---
  const profitFactor =
    totalLossPnL !== 0 ? totalWinPnL / Math.abs(totalLossPnL) : totalWinPnL > 0 ? Infinity : 0

  // --- Best / worst trade (by symbol realized P&L) ---
  let bestTrade: { symbol: string; pnl: number } | null = null
  let worstTrade: { symbol: string; pnl: number } | null = null

  for (const s of closedSymbols) {
    if (bestTrade === null || s.realizedPnL > bestTrade.pnl) {
      bestTrade = { symbol: s.symbol, pnl: s.realizedPnL }
    }
    if (worstTrade === null || s.realizedPnL < worstTrade.pnl) {
      worstTrade = { symbol: s.symbol, pnl: s.realizedPnL }
    }
  }

  // --- Longest holding (from order groups) ---
  let longestHolding = orderGroups.length > 0 ? orderGroups[0] : null
  for (const g of orderGroups) {
    if (longestHolding && g.holdingDays > longestHolding.holdingDays) {
      longestHolding = g
    }
  }

  // --- Most traded symbol (by trade count) ---
  const symbolCounts = new Map<string, number>()
  for (const t of trades) {
    symbolCounts.set(t.symbol, (symbolCounts.get(t.symbol) ?? 0) + 1)
  }
  let mostTradedSymbol: string | null = null
  let maxCount = 0
  for (const [symbol, count] of symbolCounts) {
    if (count > maxCount) {
      maxCount = count
      mostTradedSymbol = symbol
    }
  }

  // --- Realized P&L and charges from PnL summary ---
  const totalRealizedPnL = pnlSummary.totalRealizedPnL
  // Total charges excludes DP charges (per spec: "excludes DP")
  const totalCharges = pnlSummary.charges.total - pnlSummary.charges.dpCharges
  const netPnL = pnlSummary.netPnL

  return {
    totalTrades,
    totalSymbols,
    totalOrderGroups: orderGroups.length,
    winningTrades,
    losingTrades,
    breakEvenTrades,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    totalRealizedPnL,
    totalCharges,
    netPnL,
    tradingDays,
    avgTradesPerDay,
    bestTrade,
    worstTrade,
    longestHolding,
    mostTradedSymbol,
  }
}
