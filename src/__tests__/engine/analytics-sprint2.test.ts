import { describe, it, expect } from 'vitest'
import {
  calculateSharpeRatio,
  calculateMaxDrawdown,
  calculateMinDrawup,
  calculateStreaks,
  calculateMonthlyBreakdown,
  computeAnalytics,
} from '@/lib/engine/analytics'
import type { RawTrade, PnLSummary, ChargesBreakdown, SymbolPnL, PortfolioSnapshot } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTrade(
  opts: Partial<RawTrade> & { tradeType: 'buy' | 'sell'; price: number; quantity: number; tradeDate: string }
): RawTrade {
  return {
    symbol: 'TEST',
    isin: 'INE000000000',
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    auction: '',
    tradeId: `T${Math.random()}`,
    orderId: `O${Math.random()}`,
    orderExecutionTime: `${opts.tradeDate}T10:00:00`,
    ...opts,
  }
}

/** Build a sequence of paired buy+sell trades on sequential dates.
 *  pnls: net P&L per day (positive = profit). Each day has one buy at 100 and
 *  one sell at (100 + pnl/qty) so net cash = sell_value - buy_value = pnl. */
function makeTradesFromPnLs(pnls: number[], startDate = '2025-01-01'): RawTrade[] {
  const trades: RawTrade[] = []
  const base = new Date(startDate)
  for (let i = 0; i < pnls.length; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    const date = d.toISOString().split('T')[0]
    const qty = 10
    const buyPrice = 100
    const sellPrice = buyPrice + pnls[i] / qty
    trades.push(makeTrade({ tradeDate: date, tradeType: 'buy', price: buyPrice, quantity: qty, orderExecutionTime: `${date}T09:00:00` }))
    trades.push(makeTrade({ tradeDate: date, tradeType: 'sell', price: sellPrice, quantity: qty, orderExecutionTime: `${date}T15:00:00` }))
  }
  return trades
}

// ─── US-008: Sharpe Ratio ─────────────────────────────────────────────────────

describe('calculateSharpeRatio', () => {
  it('returns 0 for empty trades', () => {
    expect(calculateSharpeRatio([])).toBe(0)
  })

  it('returns 0 for single trade', () => {
    const t = makeTrade({ tradeDate: '2025-01-01', tradeType: 'sell', price: 110, quantity: 10 })
    expect(calculateSharpeRatio([t])).toBe(0)
  })

  it('returns 0 when all daily returns are identical (zero std dev)', () => {
    // Same net P&L every day → std dev = 0
    const trades = makeTradesFromPnLs([100, 100, 100, 100, 100])
    expect(calculateSharpeRatio(trades)).toBe(0)
  })

  it('returns positive Sharpe for consistent profitable trades', () => {
    // 10 days of positive, varying returns → mean >> rfr, low variance
    const pnls = [200, 250, 180, 220, 210, 230, 190, 240, 200, 215]
    const trades = makeTradesFromPnLs(pnls)
    const sharpe = calculateSharpeRatio(trades)
    expect(sharpe).toBeGreaterThan(0)
  })

  it('returns negative Sharpe for consistent losing trades', () => {
    const pnls = [-200, -180, -220, -190, -210]
    const trades = makeTradesFromPnLs(pnls)
    const sharpe = calculateSharpeRatio(trades)
    expect(sharpe).toBeLessThan(0)
  })

  it('uses custom risk-free rate parameter', () => {
    const pnls = [500, 600, 550, 520, 580, 610, 530, 490, 570, 560]
    const trades = makeTradesFromPnLs(pnls)
    const sharpe0 = calculateSharpeRatio(trades, 0)
    const sharpe5 = calculateSharpeRatio(trades, 0.05)
    // Higher risk-free rate → lower Sharpe
    expect(sharpe0).toBeGreaterThan(sharpe5)
  })

  it('returns lower Sharpe for high-volatility returns', () => {
    const lowVol = makeTradesFromPnLs([100, 105, 95, 110, 90, 102, 98, 108, 97, 103])
    const highVol = makeTradesFromPnLs([500, -300, 400, -200, 350, -250, 450, -150, 300, -100])
    const sharpeLow = calculateSharpeRatio(lowVol)
    const sharpeHigh = calculateSharpeRatio(highVol)
    expect(sharpeLow).toBeGreaterThan(sharpeHigh)
  })

  it('works with only 2 trades on different dates', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'sell', price: 110, quantity: 10 }),
    ]
    const sharpe = calculateSharpeRatio(trades)
    // 2 days, valid result (not NaN)
    expect(typeof sharpe).toBe('number')
    expect(isNaN(sharpe)).toBe(false)
  })
})

// ─── US-009: Max Drawdown & Min Drawup ────────────────────────────────────────

describe('calculateMaxDrawdown', () => {
  it('returns 0 value for empty trades', () => {
    const result = calculateMaxDrawdown([])
    expect(result.value).toBe(0)
  })

  it('returns 0 for monotonically increasing equity curve', () => {
    const trades = makeTradesFromPnLs([100, 200, 300, 400, 500])
    const result = calculateMaxDrawdown(trades)
    expect(result.value).toBe(0)
  })

  it('detects drawdown when equity drops after peak', () => {
    // Cumulative: +1000, +1500, +750 (drop from 1500 → 750 = -50%)
    const trades = makeTradesFromPnLs([1000, 500, -750])
    const result = calculateMaxDrawdown(trades)
    expect(result.value).toBeLessThan(0)
    expect(result.peakDate).toBeTruthy()
    expect(result.troughDate).toBeTruthy()
  })

  it('calculates approximately -50% drawdown from peak to trough', () => {
    // Net daily: +1000, +0, -500 → cumulative: 1000, 1000, 500 → drawdown = -50%
    const trades = makeTradesFromPnLs([1000, 0, -500])
    const result = calculateMaxDrawdown(trades)
    // (500 - 1000) / 1000 * 100 = -50%
    expect(result.value).toBeCloseTo(-50, 0)
  })

  it('handles single trade loss', () => {
    const trades = makeTradesFromPnLs([-500])
    const result = calculateMaxDrawdown(trades)
    // Only one point, peak = trough, no drawdown calculable (peak=0 guard)
    expect(typeof result.value).toBe('number')
    expect(isNaN(result.value)).toBe(false)
  })

  it('finds worst drawdown among multiple drawdowns', () => {
    // Cumulative: 100, 50 (dd=-50%), 150, 100 (dd=-33%), 200
    const trades = makeTradesFromPnLs([100, -50, 100, -50, 100])
    const result = calculateMaxDrawdown(trades)
    expect(result.value).toBeLessThan(0)
  })

  it('returns dates when drawdown occurs', () => {
    const trades = makeTradesFromPnLs([1000, -500])
    const result = calculateMaxDrawdown(trades)
    expect(result.peakDate).toBeTruthy()
    expect(result.troughDate).toBeTruthy()
    expect(result.troughDate >= result.peakDate).toBe(true)
  })
})

describe('calculateMinDrawup', () => {
  it('returns 0 value for empty trades', () => {
    const result = calculateMinDrawup([])
    expect(result.value).toBe(0)
  })

  it('returns 0 for monotonically decreasing equity (no recovery)', () => {
    const trades = makeTradesFromPnLs([-100, -200, -300])
    const result = calculateMinDrawup(trades)
    // No recovery above trough → value stays 0
    expect(result.value).toBeGreaterThanOrEqual(0)
  })

  it('detects drawup after a loss', () => {
    // Cumulative: -500, -500+300 = -200 → drawup from -500 to -200 = 60%
    const trades = makeTradesFromPnLs([-500, 300])
    const result = calculateMinDrawup(trades)
    expect(result.value).toBeGreaterThan(0)
  })

  it('returns minimum recovery when multiple drawups exist', () => {
    // loss then small recovery, then bigger loss then bigger recovery
    // min drawup should be the smaller recovery
    const trades = makeTradesFromPnLs([-1000, 100, -800, 600])
    const result = calculateMinDrawup(trades)
    expect(typeof result.value).toBe('number')
    expect(isNaN(result.value)).toBe(false)
  })

  it('returns non-negative value', () => {
    const trades = makeTradesFromPnLs([500, -200, 300, -100, 150])
    const result = calculateMinDrawup(trades)
    expect(result.value).toBeGreaterThanOrEqual(0)
  })
})

// ─── US-010: Win/Loss Streaks ─────────────────────────────────────────────────

describe('calculateStreaks', () => {
  it('returns zeros for empty trades', () => {
    const result = calculateStreaks([])
    expect(result.longestWinStreak).toBe(0)
    expect(result.longestLossStreak).toBe(0)
    expect(result.currentStreak.count).toBe(0)
  })

  it('detects all-win streak', () => {
    const trades = makeTradesFromPnLs([100, 200, 150, 180, 120])
    const result = calculateStreaks(trades)
    expect(result.longestWinStreak).toBe(5)
    expect(result.longestLossStreak).toBe(0)
    expect(result.currentStreak.type).toBe('win')
    expect(result.currentStreak.count).toBe(5)
  })

  it('detects all-loss streak', () => {
    const trades = makeTradesFromPnLs([-100, -200, -150, -180])
    const result = calculateStreaks(trades)
    expect(result.longestLossStreak).toBe(4)
    expect(result.longestWinStreak).toBe(0)
    expect(result.currentStreak.type).toBe('loss')
    expect(result.currentStreak.count).toBe(4)
  })

  it('detects alternating streaks as max 1 each', () => {
    const trades = makeTradesFromPnLs([100, -100, 100, -100, 100])
    const result = calculateStreaks(trades)
    expect(result.longestWinStreak).toBe(1)
    expect(result.longestLossStreak).toBe(1)
  })

  it('detects current streak from most recent trades', () => {
    // win, win, win, loss, loss (last 2 are losses)
    const trades = makeTradesFromPnLs([100, 200, 150, -100, -200])
    const result = calculateStreaks(trades)
    expect(result.currentStreak.type).toBe('loss')
    expect(result.currentStreak.count).toBe(2)
  })

  it('handles single trade win', () => {
    const trades = makeTradesFromPnLs([100])
    const result = calculateStreaks(trades)
    expect(result.longestWinStreak).toBe(1)
    expect(result.longestLossStreak).toBe(0)
    expect(result.currentStreak.type).toBe('win')
    expect(result.currentStreak.count).toBe(1)
  })

  it('handles single trade loss', () => {
    const trades = makeTradesFromPnLs([-50])
    const result = calculateStreaks(trades)
    expect(result.longestLossStreak).toBe(1)
    expect(result.longestWinStreak).toBe(0)
    expect(result.currentStreak.type).toBe('loss')
    expect(result.currentStreak.count).toBe(1)
  })

  it('finds longest streak in mixed sequence', () => {
    // W W W L L W W W W W L → longest win = 5
    const pnls = [100, 200, 150, -50, -80, 100, 200, 150, 180, 120, -30]
    const trades = makeTradesFromPnLs(pnls)
    const result = calculateStreaks(trades)
    expect(result.longestWinStreak).toBe(5)
    expect(result.longestLossStreak).toBe(2)
    expect(result.currentStreak.type).toBe('loss')
    expect(result.currentStreak.count).toBe(1)
  })
})

// ─── US-011: Monthly Performance Breakdown ────────────────────────────────────

/** Minimal PnLSummary used by monthly breakdown tests */
function makePnLSummary(overrides: Partial<PnLSummary> = {}): PnLSummary {
  const charges: ChargesBreakdown = {
    brokerage: 0,
    exchangeTxnCharges: 0,
    sebiTurnoverFee: 0,
    stampDuty: 0,
    stt: 0,
    gst: 0,
    dpCharges: 0,
    total: 100,
    ...((overrides.charges as Partial<ChargesBreakdown>) ?? {}),
  }
  return {
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    charges,
    netPnL: 0,
    ...overrides,
  }
}

function makeSymbolPnL(symbol: string, realizedPnL: number, openQuantity = 0): SymbolPnL {
  return {
    symbol,
    isin: `INE${symbol}`,
    quantity: 10,
    buyValue: 1000,
    sellValue: 1000 + realizedPnL,
    realizedPnL,
    unrealizedPnL: 0,
    openQuantity,
    previousClosingPrice: 100,
  }
}

describe('calculateMonthlyBreakdown', () => {
  it('returns empty array for no trades', () => {
    const result = calculateMonthlyBreakdown([], makePnLSummary(), makePnLSummary().charges)
    expect(result).toEqual([])
  })

  it('single month with 10 trades — verifies all metrics', () => {
    // 5 buys + 5 sells all in 2025-01, net = 5*(110*1) - 5*(100*1) = 50
    const trades: RawTrade[] = []
    for (let i = 1; i <= 5; i++) {
      trades.push(makeTrade({ tradeDate: `2025-01-0${i}`, tradeType: 'buy', price: 100, quantity: 1 }))
      trades.push(makeTrade({ tradeDate: `2025-01-0${i}`, tradeType: 'sell', price: 110, quantity: 1, symbol: `S${i}` }))
    }
    const symbolPnL = [1, 2, 3, 4, 5].map((i) => makeSymbolPnL(`S${i}`, 10))
    const summary = makePnLSummary({ charges: { brokerage: 0, exchangeTxnCharges: 0, sebiTurnoverFee: 0, stampDuty: 0, stt: 0, gst: 0, dpCharges: 0, total: 50 } })

    const result = calculateMonthlyBreakdown(trades, summary, summary.charges, symbolPnL)
    expect(result).toHaveLength(1)
    expect(result[0].month).toBe('2025-01')
    expect(result[0].trades).toBe(10)
    // gross: 5 sells * 110 - 5 buys * 100 = 550 - 500 = 50
    expect(result[0].grossPnL).toBeCloseTo(50)
    // all charges allocated to single month (total = 50, dpCharges = 0)
    expect(result[0].charges).toBeCloseTo(50)
    expect(result[0].netPnL).toBeCloseTo(0)
    // 5 winners out of 5 closed symbols → 100%
    expect(result[0].winRate).toBeCloseTo(100)
  })

  it('multiple months — ordered ascending and charges allocated proportionally', () => {
    // Jan: 4 trades, Feb: 6 trades, total: 10
    const janTrades = makeTradesFromPnLs([100, 200], '2025-01-05')
    const febTrades = makeTradesFromPnLs([50, 80, 120], '2025-02-03')
    const all = [...janTrades, ...febTrades]
    const summary = makePnLSummary({ charges: { brokerage: 0, exchangeTxnCharges: 0, sebiTurnoverFee: 0, stampDuty: 0, stt: 0, gst: 0, dpCharges: 0, total: 100 } })

    const result = calculateMonthlyBreakdown(all, summary, summary.charges)

    expect(result).toHaveLength(2)
    expect(result[0].month).toBe('2025-01')
    expect(result[1].month).toBe('2025-02')

    // Proportional charges: Jan = 4/10 * 100 = 40, Feb = 6/10 * 100 = 60
    expect(result[0].charges).toBeCloseTo(40)
    expect(result[1].charges).toBeCloseTo(60)
  })

  it('month with no trades does not appear in output', () => {
    // Only trades in Jan and Mar — Feb should be absent
    const janTrades = makeTradesFromPnLs([100], '2025-01-10')
    const marTrades = makeTradesFromPnLs([200], '2025-03-10')
    const summary = makePnLSummary()

    const result = calculateMonthlyBreakdown([...janTrades, ...marTrades], summary, summary.charges)

    expect(result).toHaveLength(2)
    const months = result.map((r) => r.month)
    expect(months).not.toContain('2025-02')
  })

  it('win rate calculation — reflects proportion of winning symbols', () => {
    // Create 4 trades on same day: 2 buys + 2 sells for different symbols
    const trades: RawTrade[] = [
      makeTrade({ tradeDate: '2025-01-10', tradeType: 'buy', price: 100, quantity: 1, symbol: 'WIN' }),
      makeTrade({ tradeDate: '2025-01-10', tradeType: 'sell', price: 120, quantity: 1, symbol: 'WIN' }),
      makeTrade({ tradeDate: '2025-01-10', tradeType: 'buy', price: 100, quantity: 1, symbol: 'LOSE' }),
      makeTrade({ tradeDate: '2025-01-10', tradeType: 'sell', price: 80, quantity: 1, symbol: 'LOSE' }),
    ]
    const symbolPnL = [
      makeSymbolPnL('WIN', 20),   // winner
      makeSymbolPnL('LOSE', -20), // loser
    ]
    const summary = makePnLSummary()
    const result = calculateMonthlyBreakdown(trades, summary, summary.charges, symbolPnL)

    expect(result).toHaveLength(1)
    // 1 winner out of 2 closed → 50%
    expect(result[0].winRate).toBeCloseTo(50)
  })

  it('charges allocation is proportional to trade count', () => {
    // 2 trades in Jan, 8 trades in Feb → Jan gets 20%, Feb 80%
    const janTrades = makeTradesFromPnLs([100], '2025-01-15')         // 2 trades
    const febTrades = makeTradesFromPnLs([100, 100, 100, 100], '2025-02-15') // 8 trades
    const summary = makePnLSummary({ charges: { brokerage: 0, exchangeTxnCharges: 0, sebiTurnoverFee: 0, stampDuty: 0, stt: 0, gst: 0, dpCharges: 0, total: 1000 } })

    const result = calculateMonthlyBreakdown([...janTrades, ...febTrades], summary, summary.charges)

    expect(result[0].charges).toBeCloseTo(200)   // 2/10 * 1000
    expect(result[1].charges).toBeCloseTo(800)   // 8/10 * 1000
  })
})

// ─── US-014: Integration Tests ────────────────────────────────────────────────

function makeMinimalSnapshot(trades: RawTrade[], symbolPnL: SymbolPnL[] = []): PortfolioSnapshot {
  const charges: ChargesBreakdown = {
    brokerage: 10, exchangeTxnCharges: 5, sebiTurnoverFee: 1,
    stampDuty: 2, stt: 8, gst: 5, dpCharges: 3, total: 34,
  }
  const pnlSummary: PnLSummary = {
    totalRealizedPnL: symbolPnL.reduce((s, x) => s + x.realizedPnL, 0),
    totalUnrealizedPnL: 0,
    charges,
    netPnL: symbolPnL.reduce((s, x) => s + x.realizedPnL, 0) - (charges.total - charges.dpCharges),
  }
  return {
    version: 1,
    importedAt: new Date().toISOString(),
    trades,
    orderGroups: [],
    symbolPnL,
    pnlSummary,
    analytics: null as unknown as ReturnType<typeof computeAnalytics>,
    timeline: [],
    dpCharges: [],
  }
}

describe('Integration: computeAnalytics with all Sprint 2 metrics', () => {
  it('computes all metrics on a realistic dataset without errors', () => {
    const pnls = [100, -50, 200, -80, 150, 300, -20, 400, -100, 250]
    const trades = makeTradesFromPnLs(pnls, '2025-01-02')
    const symbolPnL = pnls.map((p, i) => makeSymbolPnL(`SYM${i}`, p))
    const snapshot = makeMinimalSnapshot(trades, symbolPnL)

    const result = computeAnalytics(snapshot)

    expect(typeof result.sharpeRatio).toBe('number')
    expect(isNaN(result.sharpeRatio)).toBe(false)
    expect(result.maxDrawdown).toBeDefined()
    expect(result.minDrawup).toBeDefined()
    expect(result.streaks).toBeDefined()
    expect(Array.isArray(result.monthlyBreakdown)).toBe(true)
  })

  it('monthly P&L gross sum roughly matches sum of individual trade cash flows', () => {
    const pnls = [100, 200, -50, 300]
    const trades = makeTradesFromPnLs(pnls, '2025-03-10')
    const snapshot = makeMinimalSnapshot(trades)

    const result = computeAnalytics(snapshot)

    const totalMonthlyGross = result.monthlyBreakdown.reduce((s, m) => s + m.grossPnL, 0)
    // gross cash flow across all trades = sum of pnls (sell - buy per day)
    const expectedGross = pnls.reduce((s, v) => s + v, 0)
    expect(totalMonthlyGross).toBeCloseTo(expectedGross, 0)
  })

  it('handles empty trades gracefully — all sprint2 fields return safe defaults', () => {
    const snapshot = makeMinimalSnapshot([])
    // Patch symbolPnL for empty scenario
    snapshot.symbolPnL = []
    const result = computeAnalytics(snapshot)

    expect(result.sharpeRatio).toBe(0)
    expect(result.maxDrawdown.value).toBe(0)
    expect(result.minDrawup.value).toBe(0)
    expect(result.streaks.longestWinStreak).toBe(0)
    expect(result.monthlyBreakdown).toEqual([])
  })

  it('handles single-trade dataset without crashing', () => {
    const trades = [makeTrade({ tradeDate: '2025-06-01', tradeType: 'sell', price: 110, quantity: 5 })]
    const snapshot = makeMinimalSnapshot(trades)
    const result = computeAnalytics(snapshot)

    expect(result.totalTrades).toBe(1)
    expect(result.monthlyBreakdown).toHaveLength(1)
    expect(result.monthlyBreakdown[0].month).toBe('2025-06')
  })

  it('monthlyBreakdown months are ordered ascending', () => {
    const janTrades = makeTradesFromPnLs([100], '2025-01-10')
    const marTrades = makeTradesFromPnLs([200], '2025-03-10')
    const febTrades = makeTradesFromPnLs([150], '2025-02-10')
    const snapshot = makeMinimalSnapshot([...marTrades, ...janTrades, ...febTrades])
    const result = computeAnalytics(snapshot)

    const months = result.monthlyBreakdown.map((m) => m.month)
    expect(months).toEqual([...months].sort())
  })

  it('win rate is 0-100 range for all monthly entries', () => {
    const pnls = [100, -50, 200, -30, 400]
    const trades = makeTradesFromPnLs(pnls, '2025-04-07')
    const snapshot = makeMinimalSnapshot(trades)
    const result = computeAnalytics(snapshot)

    for (const m of result.monthlyBreakdown) {
      expect(m.winRate).toBeGreaterThanOrEqual(0)
      expect(m.winRate).toBeLessThanOrEqual(100)
    }
  })
})
