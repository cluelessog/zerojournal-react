import type { PortfolioSnapshot, RawTrade, TradeAnalytics, DrawdownMetric, StreakMetric, MonthlyMetric, PnLSummary, ChargesBreakdown, SymbolPnL } from '@/lib/types'

// ─── US-008: Sharpe Ratio ─────────────────────────────────────────────────────

/**
 * Calculate the annualised Sharpe Ratio from a list of raw trades.
 *
 * P&L per trade is approximated as: for sell trades, price * quantity (inflow);
 * for buy trades, -(price * quantity) (outflow). We group by tradeDate and sum
 * to get daily P&L, then compute mean and std dev of those daily returns.
 *
 * Formula: (mean_daily_return - daily_risk_free_rate) / std_dev_daily_return
 * Daily risk-free rate: annualRate / 252
 *
 * Edge cases:
 * - Fewer than 2 trades → return 0
 * - Std dev of daily returns is 0 → return 0
 */
/**
 * Calculates the annualized Sharpe Ratio.
 * Formula: ((mean_daily_return - daily_risk_free_rate) / std_dev) * sqrt(252)
 * @param trades Raw trades to calculate from
 * @param riskFreeRate Annual risk-free rate (default: 2%)
 * @returns Annualized Sharpe Ratio
 */
export function calculateSharpeRatio(
  trades: RawTrade[],
  riskFreeRate: number = 0.02,
): number {
  if (trades.length < 2) return 0

  // Build daily P&L map and daily invested capital map in one pass.
  // Invested capital per day = sum of (price * quantity) for BUY trades only.
  // Sell-only days are excluded from percentage returns because there is no
  // capital base to denominate the return against.
  //
  // Sharpe Ratio using daily invested capital (standard methodology per
  // Sharpe 1994, CFA curriculum):
  //   pct_return[day] = dailyPnL[day] / dailyCapital[day]
  //   Sharpe = ((mean(pct_returns) - rf_daily) / std(pct_returns)) * sqrt(252)
  //   rf_daily = annualRate / 252
  //   std uses N-1 denominator (sample variance)
  const dailyPnL = new Map<string, number>()
  const dailyCapital = new Map<string, number>()
  for (const t of trades) {
    const cashFlow = t.tradeType === 'sell'
      ? t.price * t.quantity
      : -(t.price * t.quantity)
    dailyPnL.set(t.tradeDate, (dailyPnL.get(t.tradeDate) ?? 0) + cashFlow)
    if (t.tradeType === 'buy') {
      dailyCapital.set(t.tradeDate, (dailyCapital.get(t.tradeDate) ?? 0) + t.price * t.quantity)
    }
  }

  // Compute percentage returns only for days that have invested capital (buy trades).
  // Skip days where dailyCapital === 0 (sell-only days).
  const returns: number[] = []
  for (const [date, pnl] of dailyPnL) {
    const capital = dailyCapital.get(date) ?? 0
    if (capital > 0) {
      returns.push(pnl / capital)
    }
  }

  if (returns.length < 2) return 0

  const n = returns.length
  const mean = returns.reduce((s, v) => s + v, 0) / n

  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  const dailyRfr = riskFreeRate / 252
  const annualizationFactor = Math.sqrt(252)
  return ((mean - dailyRfr) / stdDev) * annualizationFactor
}

// ─── US-009: Max Drawdown & Min Drawup ────────────────────────────────────────

/**
 * Calculate the Maximum Drawdown from a list of raw trades.
 *
 * Algorithm:
 * 1. Compute daily net P&L (sell inflows minus buy outflows) ordered by date.
 * 2. Build cumulative P&L series.
 * 3. Walk the series tracking the running peak and its date.
 * 4. At each point compute (current - peak) / |peak| * 100.
 * 5. Return the most negative value (worst decline) as a percentage.
 *
 * Returns value = 0 and empty dates when there are no drawdowns.
 */
export function calculateMaxDrawdown(trades: RawTrade[]): DrawdownMetric {
  const empty: DrawdownMetric = { value: 0, peakDate: '', troughDate: '' }
  if (trades.length === 0) return empty

  // Build sorted daily P&L
  const dailyMap = new Map<string, number>()
  for (const t of trades) {
    const value = t.tradeType === 'sell'
      ? t.price * t.quantity
      : -(t.price * t.quantity)
    dailyMap.set(t.tradeDate, (dailyMap.get(t.tradeDate) ?? 0) + value)
  }

  const sortedDates = Array.from(dailyMap.keys()).sort()
  if (sortedDates.length === 0) return empty

  // Build cumulative series
  const cumulative: Array<{ date: string; value: number }> = []
  let running = 0
  for (const date of sortedDates) {
    running += dailyMap.get(date)!
    cumulative.push({ date, value: running })
  }

  // Start high-water mark at 0 (implicit equity baseline before any trades).
  // This ensures a curve that never goes positive returns value = 0.
  let peak = 0
  let peakDate = ''
  let maxDrawdown = 0
  let drawdownPeakDate = ''
  let drawdownTroughDate = ''

  for (const point of cumulative) {
    if (point.value > peak) {
      peak = point.value
      peakDate = point.date
    }
    // Only compute drawdown when the high-water mark is positive.
    // When peak === 0 the curve has never been in profit, so there is
    // no meaningful peak-to-trough percentage to report.
    if (peak > 0) {
      const drawdown = (point.value - peak) / Math.abs(peak) * 100
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown
        drawdownPeakDate = peakDate
        drawdownTroughDate = point.date
      }
    }
  }

  return {
    value: maxDrawdown,
    peakDate: drawdownPeakDate,
    troughDate: drawdownTroughDate,
  }
}

/**
 * Calculate the Minimum Drawup from a list of raw trades.
 *
 * Min drawup = the smallest recovery from a trough (closest to zero after a loss).
 * This identifies the most difficult / weakest recovery in the equity curve.
 *
 * Algorithm:
 * 1. Same cumulative P&L series as drawdown.
 * 2. Track running trough and its date.
 * 3. At each point compute (current - trough) / |trough| * 100.
 * 4. Track the minimum positive drawup value (weakest recovery).
 */
export function calculateMinDrawup(trades: RawTrade[]): DrawdownMetric {
  const empty: DrawdownMetric = { value: 0, peakDate: '', troughDate: '' }
  if (trades.length === 0) return empty

  const dailyMap = new Map<string, number>()
  for (const t of trades) {
    const value = t.tradeType === 'sell'
      ? t.price * t.quantity
      : -(t.price * t.quantity)
    dailyMap.set(t.tradeDate, (dailyMap.get(t.tradeDate) ?? 0) + value)
  }

  const sortedDates = Array.from(dailyMap.keys()).sort()
  if (sortedDates.length === 0) return empty

  const cumulative: Array<{ date: string; value: number }> = []
  let running = 0
  for (const date of sortedDates) {
    running += dailyMap.get(date)!
    cumulative.push({ date, value: running })
  }

  let trough = cumulative[0].value
  let troughDate = cumulative[0].date
  let minDrawup: number | null = null
  let drawupTroughDate = cumulative[0].date
  let drawupPeakDate = cumulative[0].date

  for (const point of cumulative) {
    if (point.value < trough) {
      trough = point.value
      troughDate = point.date
    }
    // Only compute drawup when we are above the trough (actual recovery)
    if (trough < 0 && point.value > trough) {
      const drawup = (point.value - trough) / Math.abs(trough) * 100
      if (minDrawup === null || drawup < minDrawup) {
        minDrawup = drawup
        drawupTroughDate = troughDate
        drawupPeakDate = point.date
      }
    }
  }

  return {
    value: minDrawup ?? 0,
    peakDate: drawupPeakDate,
    troughDate: drawupTroughDate,
  }
}

// ─── US-010: Win/Loss Streaks ─────────────────────────────────────────────────

/**
 * Calculate win/loss streak metrics from a list of raw trades.
 *
 * Each trade's P&L is computed as:
 *   sell: price * quantity (inflow)
 *   buy:  -(price * quantity) (outflow)
 * Trades are sorted by orderExecutionTime then tradeDate.
 * Win = P&L > 0, Loss = P&L <= 0.
 *
 * Tracks:
 * - longestWinStreak: maximum consecutive wins
 * - longestLossStreak: maximum consecutive losses
 * - currentStreak: type and count from the most recent trade backward
 */
export function calculateStreaks(trades: RawTrade[]): StreakMetric {
  const empty: StreakMetric = {
    longestWinStreak: 0,
    longestLossStreak: 0,
    currentStreak: { type: 'win', count: 0 },
  }
  if (trades.length === 0) return empty

  // Group trades by date: net P&L per day (sells positive, buys negative)
  const dailyMap = new Map<string, number>()
  for (const t of trades) {
    const pnl = t.tradeType === 'sell'
      ? t.price * t.quantity
      : -(t.price * t.quantity)
    dailyMap.set(t.tradeDate, (dailyMap.get(t.tradeDate) ?? 0) + pnl)
  }

  // Sort dates and classify each day as win or loss
  const sortedDates = Array.from(dailyMap.keys()).sort()
  const results: Array<'win' | 'loss'> = sortedDates.map((date) =>
    (dailyMap.get(date)! > 0 ? 'win' : 'loss')
  )

  let longestWin = 0
  let longestLoss = 0
  let streak = 1
  let streakType = results[0]

  for (let i = 1; i < results.length; i++) {
    if (results[i] === streakType) {
      streak++
    } else {
      if (streakType === 'win') longestWin = Math.max(longestWin, streak)
      else longestLoss = Math.max(longestLoss, streak)
      streakType = results[i]
      streak = 1
    }
  }
  // Flush final streak
  if (streakType === 'win') longestWin = Math.max(longestWin, streak)
  else longestLoss = Math.max(longestLoss, streak)

  // Current streak: walk backward from most recent day
  const currentType = results[results.length - 1]
  let currentCount = 0
  for (let i = results.length - 1; i >= 0; i--) {
    if (results[i] === currentType) {
      currentCount++
    } else {
      break
    }
  }

  return {
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    currentStreak: { type: currentType, count: currentCount },
  }
}

// ─── US-011: Monthly Performance Breakdown ────────────────────────────────────

/**
 * Calculate monthly performance breakdown from raw trades.
 *
 * Algorithm:
 * 1. Group trades by YYYY-MM of tradeDate, ordered ascending.
 * 2. For each month:
 *    - Count total trades.
 *    - Sum gross P&L: sell inflows minus buy outflows per trade.
 *    - Allocate charges proportionally by trade count / total trades.
 *    - Compute net P&L (gross - charges).
 *    - Compute win rate from symbol-level closed P&L entries
 *      whose first trade date falls in that month.
 * 3. Return sorted array (ascending by month).
 *
 * Edge cases:
 * - No trades → empty array.
 * - Month with zero trades → excluded.
 * - No charges → charges allocated as 0.
 */
export function calculateMonthlyBreakdown(
  trades: RawTrade[],
  pnlSummary: PnLSummary,
  _charges: ChargesBreakdown,
  symbolPnL: SymbolPnL[] = [],
): MonthlyMetric[] {
  if (trades.length === 0) return []

  // Group trades by YYYY-MM
  const monthTradeMap = new Map<string, RawTrade[]>()
  for (const t of trades) {
    const month = t.tradeDate.slice(0, 7) // 'YYYY-MM'
    const bucket = monthTradeMap.get(month)
    if (bucket) {
      bucket.push(t)
    } else {
      monthTradeMap.set(month, [t])
    }
  }

  const totalTrades = trades.length
  const totalChargesAlloc = pnlSummary.charges.total - pnlSummary.charges.dpCharges

  // Two maps serve two different purposes:
  //
  // symbolFirstMonth (min/open-month): maps each symbol to the month its
  //   FIRST trade occurred. Used for win rate — answers "of positions I
  //   entered this month, what fraction ended up profitable?"
  //
  // symbolCloseMonth (max/close-month): maps each symbol to the month its
  //   LAST trade occurred (i.e., position close). Used for gross P&L
  //   attribution — realized P&L is credited to the month it was realized.

  // Build a map: symbol → first trade month (for win rate attribution)
  const symbolFirstMonth = new Map<string, string>()
  for (const t of trades) {
    const month = t.tradeDate.slice(0, 7)
    const existing = symbolFirstMonth.get(t.symbol)
    if (!existing || month < existing) {
      symbolFirstMonth.set(t.symbol, month)
    }
  }

  // Build a map: symbol → last trade month (for P&L attribution to close month)
  const symbolCloseMonth = new Map<string, string>()
  for (const t of trades) {
    const month = t.tradeDate.slice(0, 7)
    const existing = symbolCloseMonth.get(t.symbol)
    if (!existing || month > existing) {
      symbolCloseMonth.set(t.symbol, month)
    }
  }

  // Group closed symbol P&L by their first-trade month (for win rate)
  const monthSymbolPnL = new Map<string, SymbolPnL[]>()
  for (const s of symbolPnL) {
    if (s.openQuantity !== 0) continue // skip open positions
    const month = symbolFirstMonth.get(s.symbol)
    if (!month) continue
    const bucket = monthSymbolPnL.get(month)
    if (bucket) {
      bucket.push(s)
    } else {
      monthSymbolPnL.set(month, [s])
    }
  }

  // Group closed symbol P&L by their close-trade month (for gross P&L)
  const monthClosedPnL = new Map<string, SymbolPnL[]>()
  for (const s of symbolPnL) {
    if (s.openQuantity !== 0) continue // skip open positions
    const month = symbolCloseMonth.get(s.symbol)
    if (!month) continue
    const bucket = monthClosedPnL.get(month)
    if (bucket) {
      bucket.push(s)
    } else {
      monthClosedPnL.set(month, [s])
    }
  }

  const sortedMonths = Array.from(monthTradeMap.keys()).sort()

  return sortedMonths.map((month) => {
    const monthTrades = monthTradeMap.get(month)!
    const tradeCount = monthTrades.length

    // Gross P&L: sum of realizedPnL for positions whose close month is this month.
    // Months where trades occur but no positions close will show grossPnL = 0.
    const closedSymbols = monthClosedPnL.get(month) ?? []
    const grossPnL = closedSymbols.reduce((sum, s) => sum + s.realizedPnL, 0)

    // Proportional charge allocation
    const charges = totalTrades > 0
      ? (tradeCount / totalTrades) * totalChargesAlloc
      : 0

    const netPnL = grossPnL - charges

    // Win rate from closed symbol P&L attributed to open month
    const symbols = monthSymbolPnL.get(month) ?? []
    const winners = symbols.filter((s) => s.realizedPnL > 0).length
    const total = symbols.length
    const winRate = total > 0 ? (winners / total) * 100 : 0

    // Per-month max drawdown using the high-water-mark algorithm.
    // Data source: raw trade cash flow (sell inflows minus buy outflows),
    // consistent with the overall drawdown calculation in calculateMaxDrawdown.
    // Note: grossPnL uses SymbolPnL.realizedPnL (different source); drawdown
    // uses cash flow so it captures intra-month equity curve shape.
    const monthDailyMap = new Map<string, number>()
    for (const t of monthTrades) {
      const value = t.tradeType === 'sell'
        ? t.price * t.quantity
        : -(t.price * t.quantity)
      monthDailyMap.set(t.tradeDate, (monthDailyMap.get(t.tradeDate) ?? 0) + value)
    }
    const monthSortedDates = Array.from(monthDailyMap.keys()).sort()
    let monthRunning = 0
    let monthPeak = 0
    let monthMaxDrawdown = 0
    for (const date of monthSortedDates) {
      monthRunning += monthDailyMap.get(date)!
      if (monthRunning > monthPeak) {
        monthPeak = monthRunning
      }
      if (monthPeak > 0) {
        const dd = (monthRunning - monthPeak) / Math.abs(monthPeak) * 100
        if (dd < monthMaxDrawdown) {
          monthMaxDrawdown = dd
        }
      }
    }

    return {
      month,
      trades: tradeCount,
      grossPnL,
      charges,
      netPnL,
      winRate,
      maxDrawdown: monthMaxDrawdown,
    }
  })
}

// ─── Legacy analytics (portfolio snapshot based) ─────────────────────────────

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

  // --- Sprint 2 advanced analytics ---
  const sharpeRatio = calculateSharpeRatio(trades)
  const maxDrawdown = calculateMaxDrawdown(trades)
  const minDrawup = calculateMinDrawup(trades)
  const streaks = calculateStreaks(trades)
  const monthlyBreakdown = calculateMonthlyBreakdown(trades, pnlSummary, pnlSummary.charges, symbolPnL)

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
    sharpeRatio,
    maxDrawdown,
    minDrawup,
    streaks,
    monthlyBreakdown,
  }
}
