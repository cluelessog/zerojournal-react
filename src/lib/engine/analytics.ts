import type { RawTrade, TradeAnalytics, DrawdownMetric, StreakMetric, MonthlyMetric, PnLSummary, SymbolPnL, OrderGroup, FIFOMatch, ExpectancyMetric, ExpectancyBreakdown, RiskRewardMetric, RiskRewardBreakdown, RollingExpectancyPoint, TradingStyleResult, TradingStyleMetrics } from '@/lib/types'
import { matchTradesWithPnL } from '@/lib/engine/fifo-matcher'

/** Number of trading days per year used for Sharpe Ratio annualization. */
const TRADING_DAYS_PER_YEAR = 252

// ─── Sharpe Ratio ─────────────────────────────────────────────────────────────

/**
 * Calculates the annualized Sharpe Ratio from FIFO-matched realized returns.
 *
 * Uses realized P&L from FIFO matches attributed to sell dates, not raw
 * buy/sell cashflows. This prevents impossible daily returns for swing trades
 * (e.g., buy day 1 showing -100%, sell day 2 showing +110%).
 *
 * Formula: ((mean_daily_return - daily_risk_free_rate) / std_dev) * sqrt(252)
 *
 * Daily return = netDailyPnL / dailyCapitalDeployed
 *   where dailyCapitalDeployed = sum(buyPrice * quantity) for matches closing that day
 *   and netDailyPnL = grossDailyPnL - turnover-proportional charges
 *
 * Edge cases:
 * - Fewer than 2 sell dates with realized P&L → return 0
 * - Std dev of daily returns is 0 → return 0
 */
export function calculateSharpeRatio(
  fifoMatches: FIFOMatch[],
  riskFreeRate: number = 0.02,
  totalCharges: number = 0,
): number {
  if (fifoMatches.length < 2) return 0

  // Group FIFO matches by sell date to get daily realized P&L and capital deployed.
  // Capital deployed per day = sum of (buyPrice * quantity) for all matches closing that day.
  // Turnover per day = sum of ((buyPrice + sellPrice) * quantity) for charge distribution.
  const dailyPnL = new Map<string, number>()
  const dailyCapital = new Map<string, number>()
  const dailyTurnover = new Map<string, number>()

  for (const m of fifoMatches) {
    dailyPnL.set(m.sellDate, (dailyPnL.get(m.sellDate) ?? 0) + m.pnl)
    dailyCapital.set(m.sellDate, (dailyCapital.get(m.sellDate) ?? 0) + m.buyPrice * m.quantity)
    const matchTurnover = (m.buyPrice + m.sellPrice) * m.quantity
    dailyTurnover.set(m.sellDate, (dailyTurnover.get(m.sellDate) ?? 0) + matchTurnover)
  }

  // Total turnover for charge distribution
  let totalTurnover = 0
  for (const v of dailyTurnover.values()) totalTurnover += v

  // Compute percentage returns for each sell date with realized P&L.
  const sortedDates = Array.from(dailyPnL.keys()).sort()
  const returns: number[] = []

  for (const date of sortedDates) {
    const grossPnL = dailyPnL.get(date)!
    const dayTurnover = dailyTurnover.get(date) ?? 0
    const dayCharges = totalTurnover > 0 ? totalCharges * (dayTurnover / totalTurnover) : 0
    const netPnL = grossPnL - dayCharges

    const capital = dailyCapital.get(date) ?? 0
    if (capital > 0) {
      returns.push(netPnL / capital)
    }
  }

  if (returns.length < 2) return 0

  const n = returns.length
  const mean = returns.reduce((s, v) => s + v, 0) / n

  const variance = returns.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1)
  const stdDev = Math.sqrt(variance)

  if (stdDev === 0) return 0

  const dailyRfr = riskFreeRate / TRADING_DAYS_PER_YEAR
  const annualizationFactor = Math.sqrt(TRADING_DAYS_PER_YEAR)
  return ((mean - dailyRfr) / stdDev) * annualizationFactor
}

// ─── US-009: Max Drawdown & Min Drawup ────────────────────────────────────────

/**
 * Build per-trade P&L attributions: distributes each symbol's realizedPnL across
 * its sell dates proportionally by sell quantity. This prevents multiple round-trips
 * for the same symbol from collapsing to a single date, preserving equity curve chronology.
 *
 * Returns a map: symbol -> Array<{ date, weight }> where weights sum to 1.0.
 * Consumers multiply symbol.realizedPnL * weight to get date-attributed P&L.
 */
export function buildTradeAttributions(trades: RawTrade[]): Map<string, Array<{ date: string; weight: number }>> {
  // Group sell trades by symbol, then by date with total quantity per date
  const symbolSells = new Map<string, Map<string, number>>()
  for (const t of trades) {
    if (t.tradeType !== 'sell') continue
    let dateSells = symbolSells.get(t.symbol)
    if (!dateSells) {
      dateSells = new Map()
      symbolSells.set(t.symbol, dateSells)
    }
    dateSells.set(t.tradeDate, (dateSells.get(t.tradeDate) ?? 0) + t.quantity)
  }

  const result = new Map<string, Array<{ date: string; weight: number }>>()
  for (const [symbol, dateSells] of symbolSells) {
    const totalQty = Array.from(dateSells.values()).reduce((s, q) => s + q, 0)
    if (totalQty === 0) continue
    const attributions: Array<{ date: string; weight: number }> = []
    for (const [date, qty] of dateSells) {
      attributions.push({ date, weight: qty / totalQty })
    }
    result.set(symbol, attributions)
  }
  return result
}

/**
 * Build a date -> P&L map from closed symbol P&L entries using trade attributions.
 * Each symbol's realizedPnL is distributed across its sell dates proportionally.
 */
function buildDatePnLMap(
  closedSymbols: SymbolPnL[],
  attributions: Map<string, Array<{ date: string; weight: number }>>,
): Map<string, number> {
  const dateMap = new Map<string, number>()
  for (const s of closedSymbols) {
    const attrs = attributions.get(s.symbol)
    if (!attrs) continue
    for (const { date, weight } of attrs) {
      dateMap.set(date, (dateMap.get(date) ?? 0) + s.realizedPnL * weight)
    }
  }
  return dateMap
}

/**
 * Build a date -> turnover map for charge distribution in drawdown/drawup.
 * Turnover per symbol (sum of price*quantity for all trades) is distributed
 * across close dates using the same attributions as P&L.
 */
function buildDateTurnoverMap(
  closedSymbols: SymbolPnL[],
  trades: RawTrade[],
  attributions: Map<string, Array<{ date: string; weight: number }>>,
): Map<string, number> {
  // symbol -> total turnover
  const symbolTurnover = new Map<string, number>()
  for (const t of trades) {
    symbolTurnover.set(t.symbol, (symbolTurnover.get(t.symbol) ?? 0) + t.price * t.quantity)
  }
  const dateMap = new Map<string, number>()
  for (const s of closedSymbols) {
    const attrs = attributions.get(s.symbol)
    if (!attrs) continue
    const turnover = symbolTurnover.get(s.symbol) ?? 0
    for (const { date, weight } of attrs) {
      dateMap.set(date, (dateMap.get(date) ?? 0) + turnover * weight)
    }
  }
  return dateMap
}

/**
 * Build a net cumulative P&L series by deducting turnover-proportional charges.
 */
function buildNetCumulativeSeries(
  datePnLMap: Map<string, number>,
  dateTurnoverMap: Map<string, number>,
  totalCharges: number,
): Array<{ date: string; value: number }> {
  let totalTurnover = 0
  for (const v of dateTurnoverMap.values()) totalTurnover += v

  const sortedDates = Array.from(datePnLMap.keys()).sort()
  const cumulative: Array<{ date: string; value: number }> = []
  let running = 0
  let allocatedCharges = 0

  for (let i = 0; i < sortedDates.length; i++) {
    const date = sortedDates[i]
    const grossPnL = datePnLMap.get(date)!
    let dayCharges: number
    if (i === sortedDates.length - 1) {
      dayCharges = totalCharges - allocatedCharges
    } else {
      const turnover = dateTurnoverMap.get(date) ?? 0
      dayCharges = totalTurnover > 0 ? totalCharges * (turnover / totalTurnover) : 0
    }
    allocatedCharges += dayCharges
    running += grossPnL - dayCharges
    cumulative.push({ date, value: running })
  }
  return cumulative
}

/**
 * Compute drawdown from a cumulative P&L series using high-water-mark algorithm.
 *
 * Returns:
 * - With initialCapital: percentage drawdown relative to capital (clamped to -100%)
 * - Without initialCapital: absolute drawdown in INR (drop from peak, always negative or 0)
 *
 * Percentage mode only activates when initialCapital is explicitly provided and > 0.
 * Without capital, the function never returns percentage mode — this prevents the
 * misleading -100% drawdown that occurred when PnL went positive then dropped.
 */
export function computeHWMDrawdown(
  cumulative: Array<{ date: string; value: number }>,
  initialCapital?: number | null,
): DrawdownMetric {
  if (cumulative.length === 0) {
    return { value: 0, peakDate: '', troughDate: '', status: 'no_data' }
  }

  const hasCapital = initialCapital != null && initialCapital > 0

  // When initialCapital is set, equity = capital + cumPnL, and peak starts at capital.
  // Without capital, equity = cumPnL, and peak starts at 0 (pre-trade baseline).
  let peak = hasCapital ? initialCapital : 0
  let peakDate = cumulative[0].date
  let maxDrawdown = 0
  let drawdownPeakDate = ''
  let drawdownTroughDate = ''

  for (const point of cumulative) {
    const equity = hasCapital ? initialCapital + point.value : point.value
    if (equity > peak) {
      peak = equity
      peakDate = point.date
    }

    if (hasCapital) {
      // Percentage drawdown relative to capital base
      if (peak > 0) {
        // Clamp to [-100%, 0%]: drawdown can't exceed -100% (total loss of capital)
        const drawdown = Math.max(-100, (equity - peak) / Math.abs(peak) * 100)
        if (drawdown < maxDrawdown) {
          maxDrawdown = drawdown
          drawdownPeakDate = peakDate
          drawdownTroughDate = point.date
        }
      }
    } else {
      // Absolute drawdown in INR (no capital → no meaningful percentage)
      const drawdown = equity - peak
      if (drawdown < maxDrawdown) {
        maxDrawdown = drawdown
        drawdownPeakDate = peakDate
        drawdownTroughDate = point.date
      }
    }
  }

  // Return result based on mode
  if (maxDrawdown < 0) {
    return {
      value: maxDrawdown,
      peakDate: drawdownPeakDate,
      troughDate: drawdownTroughDate,
      status: 'computed',
      mode: hasCapital ? 'percentage' : 'absolute',
    }
  }

  // No drawdown at all
  return {
    value: 0,
    peakDate: '',
    troughDate: '',
    status: 'computed',
    mode: hasCapital ? 'percentage' : 'absolute',
  }
}

/**
 * Calculate the Maximum Drawdown from SymbolPnL entries.
 *
 * Algorithm:
 * 1. Use SymbolPnL.realizedPnL as the authoritative P&L source (from imported PnL file).
 * 2. Filter to closed positions only (openQuantity === 0).
 * 3. Map each closed symbol to its close date (last sell trade date).
 * 4. Aggregate realizedPnL by close date to build cumulative series.
 * 5. Walk the series tracking the running peak and its date.
 * 6. At each point compute drawdown using computeHWMDrawdown helper.
 * 7. Return the result with status and mode fields.
 *
 * Returns value = 0 with status 'no_data' when there are no data points.
 */
export function calculateMaxDrawdown(
  symbolPnL: SymbolPnL[],
  trades: RawTrade[],
  initialCapital?: number | null,
  _attributions?: Map<string, Array<{ date: string; weight: number }>>,
  totalCharges: number = 0,
): DrawdownMetric {
  const empty: DrawdownMetric = { value: 0, peakDate: '', troughDate: '', status: 'no_data' }
  if (symbolPnL.length === 0 || trades.length === 0) return empty

  const attributions = _attributions ?? buildTradeAttributions(trades)
  const closedSymbols = symbolPnL.filter((s) => s.openQuantity === 0)
  const dateMap = buildDatePnLMap(closedSymbols, attributions)

  const sortedDates = Array.from(dateMap.keys()).sort()
  if (sortedDates.length === 0) return empty

  // Build cumulative series — net of charges when totalCharges > 0
  const dateTurnover = buildDateTurnoverMap(closedSymbols, trades, attributions)
  const cumulative = buildNetCumulativeSeries(dateMap, dateTurnover, totalCharges)

  return computeHWMDrawdown(cumulative, initialCapital)
}

/**
 * Calculate the Minimum Drawup from SymbolPnL entries.
 *
 * Min drawup = the smallest recovery from a trough (closest to zero after a loss).
 * This identifies the most difficult / weakest recovery in the equity curve.
 *
 * Algorithm:
 * 1. Same cumulative P&L series as drawdown (using SymbolPnL.realizedPnL).
 * 2. Track running trough and its date.
 * 3. At each point compute (current - trough) / |trough| * 100.
 * 4. Track the minimum positive drawup value (weakest recovery).
 */
export function calculateMinDrawup(
  symbolPnL: SymbolPnL[],
  trades: RawTrade[],
  initialCapital?: number | null,
  _attributions?: Map<string, Array<{ date: string; weight: number }>>,
  totalCharges: number = 0,
): DrawdownMetric {
  const empty: DrawdownMetric = { value: 0, peakDate: '', troughDate: '', status: 'no_data' }
  if (symbolPnL.length === 0 || trades.length === 0) return empty

  const attributions = _attributions ?? buildTradeAttributions(trades)
  const closedSymbols = symbolPnL.filter((s) => s.openQuantity === 0)
  const dateMap = buildDatePnLMap(closedSymbols, attributions)

  const sortedDates = Array.from(dateMap.keys()).sort()
  if (sortedDates.length === 0) return empty

  // Build cumulative series — net of charges when totalCharges > 0
  const dateTurnover = buildDateTurnoverMap(closedSymbols, trades, attributions)
  const cumulative = buildNetCumulativeSeries(dateMap, dateTurnover, totalCharges)

  const hasCapital = initialCapital != null && initialCapital > 0

  // When capital is set, use equity (capital + cumPnL) for trough/recovery.
  // This keeps drawup consistent with drawdown's capital-adjusted equity curve.
  const equityOf = (pnl: number) => hasCapital ? initialCapital + pnl : pnl

  let trough = equityOf(cumulative[0].value)
  let troughDate = cumulative[0].date
  let minDrawup: number | null = null
  let drawupTroughDate = cumulative[0].date
  let drawupPeakDate = cumulative[0].date

  for (const point of cumulative) {
    const equity = equityOf(point.value)
    if (equity < trough) {
      trough = equity
      troughDate = point.date
    }
    // Compute drawup from any local trough recovery (not just below-capital troughs)
    if (equity > trough && trough < equity) {
      const drawup = (equity - trough) / Math.abs(trough) * 100
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
 * Calculate win/loss streak metrics using SymbolPnL as the authoritative P&L source.
 *
 * Each closed position's realizedPnL is attributed to its close date (last sell date).
 * Multiple positions closing on the same date are summed.
 * Day with summed realizedPnL > 0 = win, <= 0 = loss.
 *
 * Tracks:
 * - longestWinStreak: maximum consecutive win days
 * - longestLossStreak: maximum consecutive loss days
 * - currentStreak: type and count from the most recent close date backward
 */
export function calculateStreaks(
  symbolPnL: SymbolPnL[],
  trades: RawTrade[],
  _attributions?: Map<string, Array<{ date: string; weight: number }>>,
): StreakMetric {
  const empty: StreakMetric = {
    longestWinStreak: 0,
    longestLossStreak: 0,
    currentStreak: { type: 'win', count: 0 },
  }
  if (symbolPnL.length === 0 || trades.length === 0) return empty

  const attributions = _attributions ?? buildTradeAttributions(trades)
  const closedSymbols = symbolPnL.filter((s) => s.openQuantity === 0)
  const dailyMap = buildDatePnLMap(closedSymbols, attributions)

  if (dailyMap.size === 0) return empty

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
  symbolPnL: SymbolPnL[] = [],
  initialCapital?: number | null,
  _precomputedAttributions?: Map<string, Array<{ date: string; weight: number }>>,
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

  // Allocate ALL charges across months proportionally by turnover (not trade count).
  // This matches how charges actually accrue: STT, brokerage, exchange fees scale with trade value.
  const totalChargesAlloc = pnlSummary.charges.total

  // Build monthly turnover map for charge allocation
  const monthTurnoverMap = new Map<string, number>()
  let totalTurnover = 0
  for (const t of trades) {
    const month = t.tradeDate.slice(0, 7)
    const turnover = t.price * t.quantity
    monthTurnoverMap.set(month, (monthTurnoverMap.get(month) ?? 0) + turnover)
    totalTurnover += turnover
  }

  // All monthly metrics use close-month (last trade date) cohort for consistency.
  // This ensures win rate, P&L, drawdown, and expectancy in a row all describe
  // the same set of positions — those that closed in that month.

  // Build a map: symbol → last trade month (close month)
  const symbolCloseMonth = new Map<string, string>()
  for (const t of trades) {
    const month = t.tradeDate.slice(0, 7)
    const existing = symbolCloseMonth.get(t.symbol)
    if (!existing || month > existing) {
      symbolCloseMonth.set(t.symbol, month)
    }
  }

  // Group closed symbol P&L by their close month (used for both win rate and gross P&L)
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

  const attributions = _precomputedAttributions ?? buildTradeAttributions(trades)

  // Track cumulative P&L across months so each month's drawdown uses
  // month-start equity (capital + prior months' P&L) as baseline, not global capital.
  let priorCumulativePnL = 0
  let allocatedCharges = 0
  const results: MonthlyMetric[] = []

  for (let mi = 0; mi < sortedMonths.length; mi++) {
    const month = sortedMonths[mi]
    const monthTrades = monthTradeMap.get(month)!
    const tradeCount = monthTrades.length

    // Gross P&L: sum of realizedPnL for positions whose close month is this month.
    // Months where trades occur but no positions close will show grossPnL = 0.
    const closedSymbols = monthClosedPnL.get(month) ?? []
    const grossPnL = closedSymbols.reduce((sum, s) => sum + s.realizedPnL, 0)

    // Turnover-based charge allocation with remainder on last month
    let charges: number
    if (mi === sortedMonths.length - 1) {
      charges = totalChargesAlloc - allocatedCharges
    } else {
      const monthTurnover = monthTurnoverMap.get(month) ?? 0
      charges = totalTurnover > 0 ? totalChargesAlloc * (monthTurnover / totalTurnover) : 0
    }
    allocatedCharges += charges

    const netPnL = grossPnL - charges

    // Win rate from closed symbol P&L attributed to close month (same cohort as P&L)
    const winners = closedSymbols.filter((s) => s.realizedPnL > 0).length
    const total = closedSymbols.length
    const winRate = total > 0 ? (winners / total) * 100 : 0

    // Per-month max drawdown using the high-water-mark algorithm on NET cumulative series.
    // Data source: SymbolPnL.realizedPnL for positions closing within this month,
    // distributed across sell dates via trade attributions for chronological accuracy.
    // Charges deducted proportionally by turnover, consistent with overall drawdown.
    const rawMonthDateMap = buildDatePnLMap(closedSymbols, attributions)
    // Filter to only dates within this month (attributions may distribute across months)
    const monthDateMap = new Map<string, number>()
    for (const [date, pnl] of rawMonthDateMap) {
      if (date.startsWith(month)) {
        monthDateMap.set(date, pnl)
      }
    }
    // Build net cumulative series using turnover-based charge distribution
    const monthDateTurnover = buildDateTurnoverMap(closedSymbols, trades, attributions)
    // Filter turnover map to this month's dates
    const monthFilteredTurnover = new Map<string, number>()
    for (const [date, turnover] of monthDateTurnover) {
      if (date.startsWith(month)) {
        monthFilteredTurnover.set(date, turnover)
      }
    }
    const monthCumulative = buildNetCumulativeSeries(monthDateMap, monthFilteredTurnover, charges)
    // Month-start equity = capital + prior months' cumulative P&L.
    // This ensures month 2's drawdown is relative to month-1-end equity,
    // not the original global capital.
    const monthStartEquity = initialCapital != null && initialCapital > 0
      ? initialCapital + priorCumulativePnL
      : null
    const monthDDResult = computeHWMDrawdown(monthCumulative, monthStartEquity)
    const monthMaxDrawdown = monthDDResult.value
    const monthMaxDrawdownMode = monthDDResult.mode

    // Accumulate this month's net P&L for next month's baseline.
    // Uses net (after charges) so month-start equity reflects actual earnings.
    priorCumulativePnL += netPnL

    results.push({
      month,
      trades: tradeCount,
      grossPnL,
      charges,
      netPnL,
      winRate,
      maxDrawdown: monthMaxDrawdown,
      maxDrawdownMode: monthMaxDrawdownMode,
    })
  }

  return results
}

// ─── Expectancy ───────────────────────────────────────────────────────────────

function buildExpectancyBreakdown(matches: FIFOMatch[]): ExpectancyBreakdown {
  const wins = matches.filter((m) => m.pnl > 0)
  const losses = matches.filter((m) => m.pnl < 0)
  const winCount = wins.length
  const lossCount = losses.length
  const total = winCount + lossCount
  const winRate = total > 0 ? winCount / total : 0
  const avgWin = winCount > 0 ? wins.reduce((s, m) => s + m.pnl, 0) / winCount : 0
  const avgLoss = lossCount > 0 ? losses.reduce((s, m) => s + m.pnl, 0) / lossCount : 0
  const expectancy = winRate * avgWin + (1 - winRate) * avgLoss
  return { expectancy, avgWin, avgLoss, winCount, lossCount, winRate }
}

/**
 * Calculate expectancy (INR per trade) split by overall, intraday, and swing.
 * Intraday = holdingDays === 0; Swing = holdingDays > 0.
 * Expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)
 */
export function calculateExpectancy(matches: FIFOMatch[]): ExpectancyMetric {
  const intraday = matches.filter((m) => m.holdingDays === 0)
  const swing = matches.filter((m) => m.holdingDays > 0)
  return {
    overall: buildExpectancyBreakdown(matches),
    intraday: buildExpectancyBreakdown(intraday),
    swing: buildExpectancyBreakdown(swing),
  }
}

// ─── Risk-Reward ──────────────────────────────────────────────────────────────

function buildRiskRewardBreakdown(matches: FIFOMatch[]): RiskRewardBreakdown {
  const wins = matches.filter((m) => m.pnl > 0)
  const losses = matches.filter((m) => m.pnl < 0)
  const winCount = wins.length
  const lossCount = losses.length
  const avgWin = winCount > 0 ? wins.reduce((s, m) => s + m.pnl, 0) / winCount : 0
  const avgLoss = lossCount > 0 ? losses.reduce((s, m) => s + m.pnl, 0) / lossCount : 0
  // ratio = avgWin / |avgLoss|; 0 if no losses
  const ratio = lossCount > 0 && avgLoss !== 0 ? avgWin / Math.abs(avgLoss) : 0
  return { ratio, avgWin, avgLoss, winCount, lossCount }
}

/**
 * Calculate risk-reward ratio (avgWin / |avgLoss|) split by overall, intraday, swing.
 * Returns 0 for any segment with no losses.
 */
export function calculateRiskReward(matches: FIFOMatch[]): RiskRewardMetric {
  const intraday = matches.filter((m) => m.holdingDays === 0)
  const swing = matches.filter((m) => m.holdingDays > 0)
  return {
    overall: buildRiskRewardBreakdown(matches),
    intraday: buildRiskRewardBreakdown(intraday),
    swing: buildRiskRewardBreakdown(swing),
  }
}

// ─── Rolling Expectancy ───────────────────────────────────────────────────────

/**
 * Calculate rolling N-trade expectancy from FIFO matches.
 *
 * For each position i >= window-1, compute expectancy over matches[i-window+1..i].
 * Returns empty array if fewer than `window` matches.
 *
 * Each point: { tradeNumber, overall, intraday, swing }
 * - overall: expectancy across all matches in window
 * - intraday: expectancy across intraday-only matches in window (NaN-safe: 0 if none)
 * - swing: expectancy across swing-only matches in window (NaN-safe: 0 if none)
 */
export function calculateRollingExpectancy(
  matches: FIFOMatch[],
  window = 20,
): RollingExpectancyPoint[] {
  if (matches.length < window) return []

  const points: RollingExpectancyPoint[] = []

  for (let i = window - 1; i < matches.length; i++) {
    const slice = matches.slice(i - window + 1, i + 1)
    const overall = buildExpectancyBreakdown(slice).expectancy
    const intradaySlice = slice.filter((m) => m.holdingDays === 0)
    const swingSlice = slice.filter((m) => m.holdingDays > 0)
    const intraday = intradaySlice.length > 0 ? buildExpectancyBreakdown(intradaySlice).expectancy : 0
    const swing = swingSlice.length > 0 ? buildExpectancyBreakdown(swingSlice).expectancy : 0
    points.push({ tradeNumber: i + 1, overall, intraday, swing })
  }

  return points
}

// ─── Trading Style Classification ─────────────────────────────────────────────

const MIN_TRADES_FOR_RECOMMENDATION = 3

function buildStyleMetrics(matches: FIFOMatch[]): TradingStyleMetrics {
  if (matches.length === 0) {
    return { count: 0, winRate: 0, avgPnL: 0, totalPnL: 0 }
  }
  const wins = matches.filter((m) => m.pnl > 0).length
  const totalPnL = matches.reduce((s, m) => s + m.pnl, 0)
  return {
    count: matches.length,
    winRate: (wins / matches.length) * 100,
    avgPnL: totalPnL / matches.length,
    totalPnL,
  }
}

/**
 * Classify FIFO matches into trading styles based on holding days.
 * Categories: Intraday (0 days), BTST (1 day), Velocity (2-4 days), Swing (>4 days)
 *
 * Best/worst style determined by avgPnL, requiring MIN_TRADES_FOR_RECOMMENDATION (3)
 * trades per category. Need at least 2 qualifying styles to pick best/worst.
 *
 * Reference: Python calculate_holding_sentiment() at metrics_calculator.py:853-980
 */
export function classifyTradingStyles(matches: FIFOMatch[]): TradingStyleResult {
  const intraday = matches.filter((m) => m.holdingDays === 0)
  const btst = matches.filter((m) => m.holdingDays === 1)
  const velocity = matches.filter((m) => m.holdingDays >= 2 && m.holdingDays <= 4)
  const swing = matches.filter((m) => m.holdingDays > 4)

  const result: TradingStyleResult = {
    intraday: buildStyleMetrics(intraday),
    btst: buildStyleMetrics(btst),
    velocity: buildStyleMetrics(velocity),
    swing: buildStyleMetrics(swing),
    bestStyle: null,
    worstStyle: null,
  }

  // Determine best/worst by avgPnL among styles with enough trades
  const candidates: Array<[string, TradingStyleMetrics]> = []
  if (result.intraday.count >= MIN_TRADES_FOR_RECOMMENDATION) candidates.push(['Intraday', result.intraday])
  if (result.btst.count >= MIN_TRADES_FOR_RECOMMENDATION) candidates.push(['BTST', result.btst])
  if (result.velocity.count >= MIN_TRADES_FOR_RECOMMENDATION) candidates.push(['Velocity', result.velocity])
  if (result.swing.count >= MIN_TRADES_FOR_RECOMMENDATION) candidates.push(['Swing', result.swing])

  if (candidates.length >= 2) {
    candidates.sort((a, b) => b[1].avgPnL - a[1].avgPnL)
    result.bestStyle = candidates[0][0]
    result.worstStyle = candidates[candidates.length - 1][0]
  }

  return result
}

// ─── Monthly Expectancy ───────────────────────────────────────────────────────

/**
 * Calculate per-month expectancy from FIFO matches, grouped by sell month.
 * Returns a Map<YYYY-MM, { overallExpectancy, intradayExpectancy, swingExpectancy }>.
 *
 * Expectancy = (winRate * avgWin) + ((1 - winRate) * avgLoss)
 * Same formula as buildExpectancyBreakdown but per-month.
 *
 * Reference: Python calculate_monthly_expectancy() at metrics_calculator.py:1365-1510
 */
export function calculateMonthlyExpectancy(
  matches: FIFOMatch[],
): Map<string, { overallExpectancy: number; intradayExpectancy: number | null; swingExpectancy: number | null }> {
  const result = new Map<string, { overallExpectancy: number; intradayExpectancy: number | null; swingExpectancy: number | null }>()

  if (matches.length === 0) return result

  // Group by sell month (YYYY-MM)
  const byMonth = new Map<string, FIFOMatch[]>()
  for (const m of matches) {
    const month = m.sellDate.slice(0, 7)
    const bucket = byMonth.get(month)
    if (bucket) {
      bucket.push(m)
    } else {
      byMonth.set(month, [m])
    }
  }

  for (const [month, monthMatches] of byMonth) {
    const overallExpectancy = buildExpectancyBreakdown(monthMatches).expectancy

    const intradayMatches = monthMatches.filter((m) => m.holdingDays === 0)
    const swingMatches = monthMatches.filter((m) => m.holdingDays > 0)

    const intradayExpectancy = intradayMatches.length > 0
      ? buildExpectancyBreakdown(intradayMatches).expectancy
      : null
    const swingExpectancy = swingMatches.length > 0
      ? buildExpectancyBreakdown(swingMatches).expectancy
      : null

    result.set(month, { overallExpectancy, intradayExpectancy, swingExpectancy })
  }

  return result
}

// ─── Analytics computation ────────────────────────────────────────────────────

export interface AnalyticsInput {
  trades: RawTrade[]
  symbolPnL: SymbolPnL[]
  pnlSummary: PnLSummary
  orderGroups: OrderGroup[]
}

// ─── Streaks by Trading Style ────────────────────────────────────────────────

export interface StyleStreakResult {
  overall: StreakMetric
  intraday: StreakMetric | null
  swing: StreakMetric | null
}

function computeStreaksFromMatches(matches: FIFOMatch[]): StreakMetric {
  const empty: StreakMetric = {
    longestWinStreak: 0,
    longestLossStreak: 0,
    currentStreak: { type: 'win', count: 0 },
  }
  if (matches.length === 0) return empty

  let longestWin = 0
  let longestLoss = 0
  let currentType: 'win' | 'loss' = matches[0].pnl > 0 ? 'win' : 'loss'
  let currentCount = 0

  for (const m of matches) {
    const type: 'win' | 'loss' = m.pnl > 0 ? 'win' : 'loss'
    if (type === currentType) {
      currentCount++
    } else {
      currentType = type
      currentCount = 1
    }
    if (currentType === 'win' && currentCount > longestWin) longestWin = currentCount
    if (currentType === 'loss' && currentCount > longestLoss) longestLoss = currentCount
  }

  return {
    longestWinStreak: longestWin,
    longestLossStreak: longestLoss,
    currentStreak: { type: currentType, count: currentCount },
  }
}

export function calculateStreaksByStyle(
  fifoMatches: FIFOMatch[],
  minTradesForStyleStreak: number = 20,
): StyleStreakResult {
  const sorted = [...fifoMatches].sort((a, b) => a.sellDate.localeCompare(b.sellDate))
  const intraday = sorted.filter((m) => m.holdingDays === 0)
  const swing = sorted.filter((m) => m.holdingDays > 0)

  return {
    overall: computeStreaksFromMatches(sorted),
    intraday: intraday.length >= minTradesForStyleStreak ? computeStreaksFromMatches(intraday) : null,
    swing: swing.length >= minTradesForStyleStreak ? computeStreaksFromMatches(swing) : null,
  }
}

/**
 * Compute portfolio-level analytics from raw inputs.
 *
 * Uses symbolPnL (from PnL file) as the authoritative source for
 * win/loss classification, best/worst trades, and realized P&L.
 * Uses trades[] for trading-day count and trade totals.
 */
export function computeAnalytics({ trades, symbolPnL, pnlSummary, orderGroups }: AnalyticsInput, initialCapital?: number | null): TradeAnalytics {

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
  // Total charges (already excludes DP charges from parser normalization)
  const totalCharges = pnlSummary.charges.total
  const netPnL = pnlSummary.netPnL

  // --- FIFO matching (needed by Sharpe, expectancy, streaks, risk-reward) ---
  const fifoMatches = matchTradesWithPnL(trades)

  // --- Sprint 2 advanced analytics ---
  // Build trade attributions: distributes P&L across sell dates (not just last sell date)
  const tradeAttributions = buildTradeAttributions(trades)
  const sharpeRatio = calculateSharpeRatio(fifoMatches, 0.02, totalCharges)
  const maxDrawdown = calculateMaxDrawdown(symbolPnL, trades, initialCapital, tradeAttributions, totalCharges)
  const minDrawup = calculateMinDrawup(symbolPnL, trades, initialCapital, tradeAttributions, totalCharges)
  const streaks = calculateStreaks(symbolPnL, trades, tradeAttributions)
  const monthlyBreakdown = calculateMonthlyBreakdown(trades, pnlSummary, symbolPnL, initialCapital, tradeAttributions)
  const expectancy = calculateExpectancy(fifoMatches)
  const riskReward = calculateRiskReward(fifoMatches)
  const rollingExpectancy = calculateRollingExpectancy(fifoMatches)

  // --- Sprint 4 analytics ---
  const tradingStyles = classifyTradingStyles(fifoMatches)

  // Merge monthly expectancy into monthlyBreakdown
  const monthlyExpectancyMap = calculateMonthlyExpectancy(fifoMatches)
  for (const m of monthlyBreakdown) {
    const exp = monthlyExpectancyMap.get(m.month)
    if (exp) {
      m.overallExpectancy = exp.overallExpectancy
      m.intradayExpectancy = exp.intradayExpectancy ?? undefined
      m.swingExpectancy = exp.swingExpectancy ?? undefined
    }
  }

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
    fifoMatches,
    expectancy,
    riskReward,
    rollingExpectancy,
    tradingStyles,
  }
}
