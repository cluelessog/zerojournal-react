import { describe, it, expect } from 'vitest'
import { computeAnalytics } from '@/lib/engine/analytics'
import type { SymbolPnL, RawTrade, PnLSummary } from '@/lib/types'
import type { AnalyticsInput } from '@/lib/engine/analytics'

/**
 * Ground truth values from the design doc (section 8.2):
 *   Win rate: 32.2% (spec says 32.5% in design doc = 49/151;
 *     implementation spec says 32.2% = 49/152 from all symbolPnL)
 *   Actually: 49 winners / (49 + 101 + 1) = 49/151 = 32.45%
 *   The spec table says "Win Rate 32.2% (49 winners / 152 symbols)"
 *   but design doc says 49/151 = 32.5%.
 *   Our function uses closedSymbols only (openQty === 0), so:
 *     151 closed symbols (152 total minus SHARDACROP which is open)
 *     49 / 151 = 32.45%
 *   We test approximate matching.
 *
 *   Best trade: NETWEB +25,050.20
 *   Worst trade: KIOCL -5,763.70
 *   Trading days: 122
 *   Profit factor: ~0.885
 */

function makeSymbolPnL(
  symbol: string,
  realizedPnL: number,
  opts?: Partial<SymbolPnL>
): SymbolPnL {
  return {
    symbol,
    isin: `INE${symbol}`,
    quantity: 0,
    buyValue: 100000,
    sellValue: 100000 + realizedPnL,
    realizedPnL,
    unrealizedPnL: 0,
    openQuantity: 0,
    previousClosingPrice: 0,
    ...opts,
  }
}

function makeTrade(symbol: string, date: string, type: 'buy' | 'sell'): RawTrade {
  return {
    symbol,
    isin: `INE${symbol}`,
    tradeDate: date,
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    tradeType: type,
    auction: '',
    quantity: 10,
    price: 100,
    tradeId: `T${Math.random()}`,
    orderId: `O${Math.random()}`,
    orderExecutionTime: `${date}T10:00:00`,
  }
}

function buildTestSnapshot(): AnalyticsInput {
  // Build 49 winners, 101 losers, 1 breakeven = 151 closed symbols
  // Plus 1 open position (SHARDACROP) = 152 total
  const symbolPnL: SymbolPnL[] = []
  const trades: RawTrade[] = []

  // 49 winners with varied P&L
  const winPnLs = [
    25050.2, // NETWEB (best trade)
    12000, 8000, 6000, 5500,
    4000, 3500, 3000, 2800, 2500,
    2200, 2000, 1800, 1500, 1300,
    1100, 1000, 900, 850, 800,
    750, 700, 650, 600, 550,
    500, 480, 450, 420, 400,
    380, 350, 320, 300, 280,
    250, 220, 200, 180, 150,
    120, 100, 80, 60, 50,
    40, 30, 20, 10,
  ]
  const winSymbols = winPnLs.map((_, i) => (i === 0 ? 'NETWEB' : `WIN${i}`))

  for (let i = 0; i < 49; i++) {
    symbolPnL.push(makeSymbolPnL(winSymbols[i], winPnLs[i]))
  }

  // 101 losers with varied P&L
  const lossPnLs: number[] = []
  lossPnLs.push(-5763.7) // KIOCL (worst trade)
  // Fill remaining 100 losers
  for (let i = 1; i <= 100; i++) {
    lossPnLs.push(-(i * 30 + 10))
  }
  const lossSymbols = lossPnLs.map((_, i) => (i === 0 ? 'KIOCL' : `LOSS${i}`))

  for (let i = 0; i < 101; i++) {
    symbolPnL.push(makeSymbolPnL(lossSymbols[i], lossPnLs[i]))
  }

  // 1 breakeven (AEGISVOPAK)
  symbolPnL.push(makeSymbolPnL('AEGISVOPAK', 0))

  // 1 open position (SHARDACROP) -- excluded from win/loss classification
  symbolPnL.push(
    makeSymbolPnL('SHARDACROP', 0, {
      openQuantity: 30,
      unrealizedPnL: 2130,
    })
  )

  // Generate trades across 122 unique trading days
  const dates: string[] = []
  const baseDate = new Date('2025-04-01')
  let dayCount = 0
  const current = new Date(baseDate)
  while (dayCount < 122) {
    const dow = current.getDay()
    if (dow !== 0 && dow !== 6) {
      dates.push(current.toISOString().split('T')[0])
      dayCount++
    }
    current.setDate(current.getDate() + 1)
  }

  // Distribute trades across dates (2218 total)
  let tradeCount = 0
  const allSymbols = [...winSymbols, ...lossSymbols, 'AEGISVOPAK']
  for (let i = 0; tradeCount < 2218; i++) {
    const date = dates[i % dates.length]
    const symbol = allSymbols[i % allSymbols.length]
    trades.push(makeTrade(symbol, date, 'buy'))
    tradeCount++
    if (tradeCount < 2218) {
      trades.push(makeTrade(symbol, date, 'sell'))
      tradeCount++
    }
  }

  // Calculate total wins and losses for profit factor
  const totalWins = winPnLs.reduce((s, v) => s + v, 0)
  const totalLosses = lossPnLs.reduce((s, v) => s + v, 0)
  const realizedPnL = totalWins + totalLosses

  const pnlSummary: PnLSummary = {
    totalRealizedPnL: realizedPnL,
    totalUnrealizedPnL: 2130,
    charges: {
      brokerage: 8445.87,
      exchangeTxnCharges: 1252.04,
      sebiTurnoverFee: 41.9,
      stampDuty: 840,
      stt: 8399,
      gst: 1760.53,
      dpCharges: 874.38,
      total: 20780.3,  // Normalized: excludes DP charges (parser ensures this)
    },
    netPnL: realizedPnL - 20780.3,
  }

  return {
    trades,
    orderGroups: [],
    symbolPnL,
    pnlSummary,
  }
}

describe('computeAnalytics', () => {
  const snapshot = buildTestSnapshot()
  const analytics = computeAnalytics(snapshot)

  it('computes correct total trade count', () => {
    expect(analytics.totalTrades).toBe(2218)
  })

  it('computes correct total symbols', () => {
    // 152 unique symbols in symbolPnL (including open SHARDACROP)
    expect(analytics.totalSymbols).toBe(152)
  })

  it('computes correct winning trade count', () => {
    expect(analytics.winningTrades).toBe(49)
  })

  it('computes correct losing trade count', () => {
    expect(analytics.losingTrades).toBe(101)
  })

  it('computes correct breakeven count', () => {
    expect(analytics.breakEvenTrades).toBe(1)
  })

  it('computes win rate around 32.5% (49/151 closed symbols)', () => {
    // 49 / 151 = 32.45%
    expect(analytics.winRate).toBeCloseTo(32.45, 0)
    // Broader check: between 32% and 33%
    expect(analytics.winRate).toBeGreaterThan(32)
    expect(analytics.winRate).toBeLessThan(33)
  })

  it('identifies NETWEB as best trade', () => {
    expect(analytics.bestTrade).not.toBeNull()
    expect(analytics.bestTrade!.symbol).toBe('NETWEB')
    expect(analytics.bestTrade!.pnl).toBeCloseTo(25050.2, 2)
  })

  it('identifies KIOCL as worst trade', () => {
    expect(analytics.worstTrade).not.toBeNull()
    expect(analytics.worstTrade!.symbol).toBe('KIOCL')
    expect(analytics.worstTrade!.pnl).toBeCloseTo(-5763.7, 2)
  })

  it('computes correct trading days', () => {
    expect(analytics.tradingDays).toBe(122)
  })

  it('computes profit factor as ratio of wins to losses', () => {
    // profit factor = sum(wins) / abs(sum(losses))
    expect(analytics.profitFactor).toBeGreaterThan(0)
    expect(analytics.profitFactor).toBeLessThan(2)
  })

  it('computes avgWin > 0 and avgLoss < 0', () => {
    expect(analytics.avgWin).toBeGreaterThan(0)
    expect(analytics.avgLoss).toBeLessThan(0)
  })

  it('computes avgTradesPerDay', () => {
    // 2218 / 122 = ~18.18
    expect(analytics.avgTradesPerDay).toBeCloseTo(18.18, 0)
  })

  it('computes totalCharges (normalized to exclude DP charges)', () => {
    // Parser normalizes charges.total to always exclude DP charges
    // analytics.totalCharges = charges.total (no subtraction needed since parser handles normalization)
    // Test fixture: charges.total = 20780.3 (already excludes DP), dpCharges = 874.38 (separate)
    expect(analytics.totalCharges).toBeCloseTo(20780.3, 1)
  })
})
