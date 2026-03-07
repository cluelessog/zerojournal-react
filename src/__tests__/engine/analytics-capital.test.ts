import { describe, it, expect } from 'vitest'
import {
  computeHWMDrawdown,
  calculateMaxDrawdown,
  calculateMonthlyBreakdown,
  computeAnalytics,
} from '@/lib/engine/analytics'
import type { RawTrade, PnLSummary, ChargesBreakdown, SymbolPnL, PortfolioSnapshot } from '@/lib/types'

// ─── Helpers (matching existing test patterns) ───────────────────────────────

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
    totalRealizedPnL: overrides.totalRealizedPnL ?? 0,
    totalUnrealizedPnL: overrides.totalUnrealizedPnL ?? 0,
    netPnL: overrides.netPnL ?? 0,
    charges,
  }
}

// ─── computeHWMDrawdown with initialCapital ──────────────────────────────────

describe('computeHWMDrawdown with initialCapital', () => {
  it('returns no_data for empty cumulative array', () => {
    const result = computeHWMDrawdown([], 100000)
    expect(result.status).toBe('no_data')
    expect(result.value).toBe(0)
  })

  it('uses initialCapital as starting peak for percentage calculation', () => {
    // Capital 100000, cumulative P&L goes: +5000, -10000
    // Equity: 105000, 90000
    // Peak is 105000 (after first point), drawdown = (90000 - 105000) / 105000 * 100 = -14.28%
    const cumulative = [
      { date: '2025-01-01', value: 5000 },
      { date: '2025-01-02', value: -10000 },
    ]
    const result = computeHWMDrawdown(cumulative, 100000)
    expect(result.status).toBe('computed')
    expect(result.mode).toBe('percentage')
    expect(result.value).toBeCloseTo(-14.29, 1)
  })

  it('converts absolute drawdown to percentage when capital is set', () => {
    // Without capital: cumulative never goes positive (all losses), so absolute mode
    // With capital 50000: equity = 50000 + cumPnL, starts at 50000 (peak)
    const cumulative = [
      { date: '2025-01-01', value: -1000 },
      { date: '2025-01-02', value: -3000 },
      { date: '2025-01-03', value: -2000 },
    ]
    // Without capital: should be absolute mode
    const withoutCapital = computeHWMDrawdown(cumulative)
    expect(withoutCapital.mode).toBe('absolute')
    expect(withoutCapital.value).toBe(-3000)

    // With capital 50000: equity is 49000, 47000, 48000
    // Peak = 50000 (initial), drawdown = (47000 - 50000) / 50000 * 100 = -6%
    const withCapital = computeHWMDrawdown(cumulative, 50000)
    expect(withCapital.mode).toBe('percentage')
    expect(withCapital.value).toBeCloseTo(-6.0, 1)
  })

  it('handles capital with no drawdown (only profits)', () => {
    const cumulative = [
      { date: '2025-01-01', value: 1000 },
      { date: '2025-01-02', value: 3000 },
      { date: '2025-01-03', value: 5000 },
    ]
    const result = computeHWMDrawdown(cumulative, 100000)
    expect(result.status).toBe('computed')
    expect(result.value).toBe(0) // no drawdown
  })

  it('null capital behaves same as no capital', () => {
    const cumulative = [
      { date: '2025-01-01', value: -1000 },
      { date: '2025-01-02', value: -3000 },
    ]
    const withNull = computeHWMDrawdown(cumulative, null)
    const withUndefined = computeHWMDrawdown(cumulative, undefined)
    const withoutArg = computeHWMDrawdown(cumulative)
    expect(withNull.value).toBe(withoutArg.value)
    expect(withNull.mode).toBe(withoutArg.mode)
    expect(withUndefined.value).toBe(withoutArg.value)
  })

  it('zero capital behaves same as no capital', () => {
    const cumulative = [
      { date: '2025-01-01', value: -1000 },
      { date: '2025-01-02', value: -3000 },
    ]
    const withZero = computeHWMDrawdown(cumulative, 0)
    const withoutArg = computeHWMDrawdown(cumulative)
    expect(withZero.value).toBe(withoutArg.value)
    expect(withZero.mode).toBe(withoutArg.mode)
  })

  it('clamps percentage drawdown to -100% even with capital', () => {
    // Capital 10000, cumulative P&L = -15000 → equity = -5000
    // Drawdown = (-5000 - 10000) / 10000 * 100 = -150%, clamped to -100%
    const cumulative = [
      { date: '2025-01-01', value: -15000 },
    ]
    const result = computeHWMDrawdown(cumulative, 10000)
    expect(result.value).toBe(-100)
    expect(result.mode).toBe('percentage')
  })

  it('tracks correct peak and trough dates with capital', () => {
    // Capital 100000
    // Day 1: +10000 → equity 110000 (new peak)
    // Day 2: +5000  → equity 105000 (drawdown from 110000)
    // Day 3: -2000  → equity 98000  (deeper drawdown)
    // Day 4: +15000 → equity 115000 (new peak)
    const cumulative = [
      { date: '2025-01-01', value: 10000 },
      { date: '2025-01-02', value: 5000 },
      { date: '2025-01-03', value: -2000 },
      { date: '2025-01-04', value: 15000 },
    ]
    const result = computeHWMDrawdown(cumulative, 100000)
    // Deepest drawdown: equity 98000 vs peak 110000 = (98000-110000)/110000*100 = -10.91%
    expect(result.value).toBeCloseTo(-10.91, 1)
    expect(result.peakDate).toBe('2025-01-01')
    expect(result.troughDate).toBe('2025-01-03')
  })
})

// ─── calculateMaxDrawdown with initialCapital ────────────────────────────────

describe('calculateMaxDrawdown with initialCapital', () => {
  it('returns percentage drawdown when capital is set', () => {
    // Two closed symbols: A closed on day 1 with +500, B closed on day 2 with -2000
    // Cumulative: day 1 = 500, day 2 = -1500
    // Without capital: peak = 500, drawdown = (-1500-500)/500*100 = -400% → clamped -100%
    //   Actually: cum P&L goes 500, -1500. Peak=500, dd=(−1500−500)/500*100=−400 → clamped −100
    // With capital 100000: equity 100500, 98500. Peak=100500, dd=(98500−100500)/100500*100 = −1.99%
    const symbols = [
      makeSymbolPnL('A', 500),
      makeSymbolPnL('B', -2000),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 150, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'sell', price: 80, quantity: 10 }),
    ]

    const withCapital = calculateMaxDrawdown(symbols, trades, 100000)
    expect(withCapital.mode).toBe('percentage')
    expect(withCapital.value).toBeCloseTo(-1.99, 1)

    const withoutCapital = calculateMaxDrawdown(symbols, trades)
    // Without capital, curve goes positive first (peak=500), then -1500 → dd= -400% clamped to -100%
    expect(withoutCapital.value).toBe(-100)
  })

  it('preserves absolute mode when capital is not set', () => {
    // Only losses: cumulative never goes positive
    const symbols = [
      makeSymbolPnL('A', -500),
      makeSymbolPnL('B', -1000),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 50, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'sell', price: 0, quantity: 10 }),
    ]

    const withoutCapital = calculateMaxDrawdown(symbols, trades)
    expect(withoutCapital.mode).toBe('absolute')
    expect(withoutCapital.value).toBe(-1500) // deepest negative cumulative

    // With capital, switches to percentage
    const withCapital = calculateMaxDrawdown(symbols, trades, 50000)
    expect(withCapital.mode).toBe('percentage')
    expect(withCapital.value).toBeCloseTo(-3.0, 1) // (48500 - 50000)/50000*100 = -3%
  })

  it('returns no_data when no closed positions exist', () => {
    const symbols = [makeSymbolPnL('A', 500, 10)] // open position
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
    ]
    const result = calculateMaxDrawdown(symbols, trades, 100000)
    expect(result.status).toBe('no_data')
  })
})

// ─── calculateMonthlyBreakdown with initialCapital ───────────────────────────

describe('calculateMonthlyBreakdown with initialCapital', () => {
  it('monthly maxDrawdown is percentage when capital is set', () => {
    // One month: two closed symbols in Jan
    const symbols = [
      makeSymbolPnL('A', 1000),
      makeSymbolPnL('B', -500),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 200, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-15', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-15', tradeType: 'sell', price: 50, quantity: 10 }),
    ]
    const summary = makePnLSummary({ totalRealizedPnL: 500, netPnL: 400 })

    const withCapital = calculateMonthlyBreakdown(trades, summary, symbols, 100000)
    expect(withCapital.length).toBe(1)
    // With capital, maxDrawdown should be a small percentage (not absolute INR)
    expect(withCapital[0].maxDrawdown).toBeGreaterThanOrEqual(-100)
    expect(withCapital[0].maxDrawdown).toBeLessThanOrEqual(0)

    const withoutCapital = calculateMonthlyBreakdown(trades, summary, symbols)
    // Without capital, behavior depends on curve shape
    expect(withoutCapital.length).toBe(1)
  })

  it('monthly breakdown without capital preserves existing behavior', () => {
    const symbols = [
      makeSymbolPnL('A', -1000),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-05', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-05', tradeType: 'sell', price: 0, quantity: 10 }),
    ]
    const summary = makePnLSummary({ totalRealizedPnL: -1000, netPnL: -1100 })

    const result = calculateMonthlyBreakdown(trades, summary, symbols)
    expect(result.length).toBe(1)
    // With only losses and no capital, this should be absolute mode (value < -100 indicates INR)
    expect(result[0].maxDrawdown).toBeLessThan(0)
  })
})

// ─── computeAnalytics with initialCapital ────────────────────────────────────

describe('computeAnalytics with initialCapital', () => {
  it('threads capital through to maxDrawdown', () => {
    const symbols = [
      makeSymbolPnL('A', -500),
      makeSymbolPnL('B', -1000),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 50, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'sell', price: 0, quantity: 10 }),
    ]
    const summary = makePnLSummary({ totalRealizedPnL: -1500, netPnL: -1600 })
    const snapshot: PortfolioSnapshot = {
      version: 1,
      importedAt: '2025-01-01T00:00:00Z',
      trades,
      orderGroups: [],
      symbolPnL: symbols,
      pnlSummary: summary,
      analytics: null as unknown as import('@/lib/types').TradeAnalytics,
      timeline: [],
      dpCharges: [],
    }

    // Without capital: absolute mode (all losses, no positive peak)
    const withoutCapital = computeAnalytics(snapshot)
    expect(withoutCapital.maxDrawdown.mode).toBe('absolute')

    // With capital: percentage mode
    const withCapital = computeAnalytics(snapshot, 100000)
    expect(withCapital.maxDrawdown.mode).toBe('percentage')
    expect(withCapital.maxDrawdown.value).toBeCloseTo(-1.6, 1) // net: -(1500+100 charges)/100000*100
  })

  it('does not affect other analytics when capital is set', () => {
    const symbols = [
      makeSymbolPnL('A', 500),
      makeSymbolPnL('B', -200),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 150, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'sell', price: 80, quantity: 10 }),
    ]
    const summary = makePnLSummary({ totalRealizedPnL: 300, netPnL: 200 })
    const snapshot: PortfolioSnapshot = {
      version: 1,
      importedAt: '2025-01-01T00:00:00Z',
      trades,
      orderGroups: [],
      symbolPnL: symbols,
      pnlSummary: summary,
      analytics: null as unknown as import('@/lib/types').TradeAnalytics,
      timeline: [],
      dpCharges: [],
    }

    const withoutCapital = computeAnalytics(snapshot)
    const withCapital = computeAnalytics(snapshot, 100000)

    // Non-drawdown analytics should be identical
    expect(withCapital.totalTrades).toBe(withoutCapital.totalTrades)
    expect(withCapital.winRate).toBe(withoutCapital.winRate)
    expect(withCapital.sharpeRatio).toBe(withoutCapital.sharpeRatio)
    expect(withCapital.streaks).toEqual(withoutCapital.streaks)
    expect(withCapital.profitFactor).toBe(withoutCapital.profitFactor)
  })
})

// ─── Backward Compatibility ──────────────────────────────────────────────────

describe('Backward Compatibility', () => {
  it('calculateMaxDrawdown works without initialCapital parameter', () => {
    const symbols = [
      makeSymbolPnL('A', 1000),
      makeSymbolPnL('B', -500),
    ]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 200, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'B', tradeDate: '2025-01-02', tradeType: 'sell', price: 50, quantity: 10 }),
    ]
    // Should work fine without the third parameter
    const result = calculateMaxDrawdown(symbols, trades)
    expect(result.status).toBe('computed')
  })

  it('computeHWMDrawdown works without initialCapital parameter', () => {
    const cumulative = [
      { date: '2025-01-01', value: 1000 },
      { date: '2025-01-02', value: 500 },
    ]
    const result = computeHWMDrawdown(cumulative)
    expect(result.status).toBe('computed')
    expect(result.value).toBeCloseTo(-50, 0) // (500-1000)/1000*100 = -50%
  })

  it('computeAnalytics works without initialCapital parameter', () => {
    const symbols = [makeSymbolPnL('A', 500)]
    const trades = [
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'A', tradeDate: '2025-01-01', tradeType: 'sell', price: 150, quantity: 10 }),
    ]
    const summary = makePnLSummary({ totalRealizedPnL: 500, netPnL: 400 })
    const snapshot: PortfolioSnapshot = {
      version: 1,
      importedAt: '2025-01-01T00:00:00Z',
      trades,
      orderGroups: [],
      symbolPnL: symbols,
      pnlSummary: summary,
      analytics: null as unknown as import('@/lib/types').TradeAnalytics,
      timeline: [],
      dpCharges: [],
    }
    // Should not throw
    const result = computeAnalytics(snapshot)
    expect(result.totalTrades).toBe(2)
  })
})
