import { describe, it, expect } from 'vitest'
import { buildTimeline } from '@/lib/engine/timeline'
import type { RawTrade, SymbolPnL } from '@/lib/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSymbolPnL(
  symbol: string,
  realizedPnL: number,
  opts?: Partial<SymbolPnL>,
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

function makeTrade(
  symbol: string,
  date: string,
  type: 'buy' | 'sell',
  quantity = 100,
  price = 100,
): RawTrade {
  return {
    symbol,
    isin: `INE${symbol}`,
    tradeDate: date,
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    tradeType: type,
    auction: '',
    quantity,
    price,
    tradeId: `T${Math.random()}`,
    orderId: `O${Math.random()}`,
    orderExecutionTime: `${date}T10:00:00`,
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('buildTimeline', () => {
  // Test 1: single-date symbol (baseline — should pass with current and new code)
  it('attributes P&L to single sell date for single-date symbol', () => {
    const trades = [
      makeTrade('INFY', '2024-05-15', 'buy', 100, 500),
      makeTrade('INFY', '2024-05-15', 'sell', 100, 550),
    ]
    const symbolPnL = [makeSymbolPnL('INFY', 5000)]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    expect(timeline).toHaveLength(1)
    expect(timeline[0].date).toBe('2024-05-15')
    expect(timeline[0].dailyPnL).toBe(5000)
    expect(timeline[0].cumulativePnL).toBe(5000)
  })

  // Test 2: multi-date symbol distributes P&L by sell quantity (CORE BUG FIX)
  it('distributes P&L across sell dates proportionally by sell quantity', () => {
    const trades = [
      makeTrade('NETWEB', '2024-05-10', 'buy', 150, 400),
      makeTrade('NETWEB', '2024-05-15', 'sell', 100, 500),
      makeTrade('NETWEB', '2024-06-10', 'sell', 50, 500),
    ]
    // Total realized P&L = 15000, sells: 100 on May 15, 50 on June 10
    // Weight: May 15 = 100/150 = 2/3, June 10 = 50/150 = 1/3
    const symbolPnL = [makeSymbolPnL('NETWEB', 15000)]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    expect(timeline).toHaveLength(2)

    const may15 = timeline.find((t) => t.date === '2024-05-15')!
    const jun10 = timeline.find((t) => t.date === '2024-06-10')!

    expect(may15).toBeDefined()
    expect(jun10).toBeDefined()
    expect(may15.dailyPnL).toBeCloseTo(10000, 0) // 15000 * (100/150)
    expect(jun10.dailyPnL).toBeCloseTo(5000, 0)  // 15000 * (50/150)
  })

  // Test 3: intraday + swing same symbol splits by sell quantity
  it('splits P&L between intraday and swing sells for same symbol', () => {
    const trades = [
      makeTrade('NETWEB', '2024-05-15', 'buy', 200, 400),
      makeTrade('NETWEB', '2024-05-15', 'sell', 100, 440), // intraday
      makeTrade('NETWEB', '2024-05-20', 'sell', 100, 440), // swing
    ]
    // realizedPnL = 8000, sells: 100 on May 15, 100 on May 20
    // Weight: 50/50
    const symbolPnL = [makeSymbolPnL('NETWEB', 8000)]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    expect(timeline).toHaveLength(2)

    const may15 = timeline.find((t) => t.date === '2024-05-15')!
    const may20 = timeline.find((t) => t.date === '2024-05-20')!

    expect(may15).toBeDefined()
    expect(may20).toBeDefined()
    expect(may15.dailyPnL).toBeCloseTo(4000, 0) // 8000 * 0.5
    expect(may20.dailyPnL).toBeCloseTo(4000, 0) // 8000 * 0.5
  })

  // Test 4: open position excluded (baseline — should pass)
  it('excludes open positions from timeline', () => {
    const trades = [
      makeTrade('RELIANCE', '2024-05-15', 'buy', 100, 2500),
      makeTrade('RELIANCE', '2024-05-15', 'sell', 50, 2600),
    ]
    // openQuantity = 50 → still open
    const symbolPnL = [makeSymbolPnL('RELIANCE', 5000, { openQuantity: 50 })]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    expect(timeline).toHaveLength(0)
  })

  // Test 5: trade count = sell trades per date
  it('counts sell trade rows per date for tradeCount', () => {
    const trades = [
      makeTrade('NETWEB', '2024-05-10', 'buy', 150, 400),
      // 2 sell rows on May 15
      makeTrade('NETWEB', '2024-05-15', 'sell', 50, 500),
      makeTrade('NETWEB', '2024-05-15', 'sell', 50, 510),
      // 1 sell row on June 10
      makeTrade('NETWEB', '2024-06-10', 'sell', 50, 520),
    ]
    const symbolPnL = [makeSymbolPnL('NETWEB', 12000)]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    const may15 = timeline.find((t) => t.date === '2024-05-15')!
    const jun10 = timeline.find((t) => t.date === '2024-06-10')!

    expect(may15).toBeDefined()
    expect(jun10).toBeDefined()
    expect(may15.tradeCount).toBe(2)
    expect(jun10.tradeCount).toBe(1)
  })

  // Test 6: charge distribution with multi-date attribution
  it('distributes charges proportionally by turnover across sell dates', () => {
    const trades = [
      makeTrade('NETWEB', '2024-05-10', 'buy', 200, 400),
      makeTrade('NETWEB', '2024-05-15', 'sell', 100, 500),
      makeTrade('NETWEB', '2024-06-10', 'sell', 100, 500),
    ]
    // Equal sell quantities → equal weights (0.5 each)
    // Symbol total turnover = buy(200*400) + sell(100*500) + sell(100*500) = 80000 + 50000 + 50000 = 180000
    // Each date gets 50% of turnover = 90000
    // totalCharges = 1000 → each date gets ~500
    const symbolPnL = [makeSymbolPnL('NETWEB', 10000)]

    const timeline = buildTimeline(trades, symbolPnL, 'daily', 1000)

    expect(timeline).toHaveLength(2)

    const may15 = timeline.find((t) => t.date === '2024-05-15')!
    const jun10 = timeline.find((t) => t.date === '2024-06-10')!

    // Charges should be split (approximately equal since equal weights)
    expect(may15.dailyCharges + jun10.dailyCharges).toBeCloseTo(1000, 0)
    // Both dates should have non-zero charges
    expect(may15.dailyCharges).toBeGreaterThan(0)
    expect(jun10.dailyCharges).toBeGreaterThan(0)
    // Net P&L = gross - charges
    expect(may15.dailyNetPnL).toBeCloseTo(may15.dailyPnL - may15.dailyCharges, 1)
    expect(jun10.dailyNetPnL).toBeCloseTo(jun10.dailyPnL - jun10.dailyCharges, 1)
  })

  // Test 7: weekly aggregation groups sell dates in same week
  it('aggregates sell dates within same ISO week for weekly mode', () => {
    const trades = [
      makeTrade('INFY', '2024-05-13', 'buy', 200, 500),
      // Monday and Wednesday of same week (ISO week 20, 2024)
      makeTrade('INFY', '2024-05-13', 'sell', 100, 550),
      makeTrade('INFY', '2024-05-15', 'sell', 100, 550),
    ]
    const symbolPnL = [makeSymbolPnL('INFY', 10000)]

    const timeline = buildTimeline(trades, symbolPnL, 'weekly')

    // Both sell dates are in the same ISO week → single aggregated point
    expect(timeline).toHaveLength(1)
    expect(timeline[0].dailyPnL).toBeCloseTo(10000, 0)
  })

  // Test 8: cumulative P&L correctness
  it('maintains cumulative P&L invariant across multiple dates', () => {
    const trades = [
      makeTrade('INFY', '2024-05-10', 'buy', 100, 500),
      makeTrade('INFY', '2024-05-15', 'sell', 100, 550),
      makeTrade('TCS', '2024-05-20', 'buy', 50, 3000),
      makeTrade('TCS', '2024-06-01', 'sell', 50, 3100),
    ]
    const symbolPnL = [
      makeSymbolPnL('INFY', 5000),
      makeSymbolPnL('TCS', 5000),
    ]
    const totalCharges = 500

    const timeline = buildTimeline(trades, symbolPnL, 'daily', totalCharges)

    // Last point's cumulative gross P&L = sum of all realized P&L
    const lastPoint = timeline[timeline.length - 1]
    const totalRealizedPnL = 5000 + 5000
    expect(lastPoint.cumulativePnL).toBeCloseTo(totalRealizedPnL, 0)
    // Last point's cumulative net P&L = total realized - total charges
    expect(lastPoint.cumulativeNetPnL).toBeCloseTo(totalRealizedPnL - totalCharges, 0)
  })

  // Test 9: multiple symbols with mixed overlapping sell dates
  it('correctly sums P&L from multiple symbols on overlapping dates', () => {
    const trades = [
      // Symbol A: single sell date
      makeTrade('INFY', '2024-05-10', 'buy', 100, 500),
      makeTrade('INFY', '2024-05-15', 'sell', 100, 530),
      // Symbol B: sells on two dates, one overlapping with A
      makeTrade('TCS', '2024-05-12', 'buy', 100, 3000),
      makeTrade('TCS', '2024-05-15', 'sell', 50, 3080),  // same date as INFY sell
      makeTrade('TCS', '2024-06-01', 'sell', 50, 3080),
    ]
    const symbolPnL = [
      makeSymbolPnL('INFY', 3000),
      makeSymbolPnL('TCS', 4000),  // split 50/50 across May 15 and June 1
    ]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    // Expected: May 15 = INFY(3000) + TCS(4000*0.5=2000) = 5000
    //           June 1 = TCS(4000*0.5=2000)
    const may15 = timeline.find((t) => t.date === '2024-05-15')!
    const jun01 = timeline.find((t) => t.date === '2024-06-01')!

    expect(may15).toBeDefined()
    expect(jun01).toBeDefined()
    expect(may15.dailyPnL).toBeCloseTo(5000, 0)
    expect(jun01.dailyPnL).toBeCloseTo(2000, 0)
  })

  // Test 10: partial-close symbol excluded (openQuantity != 0)
  it('excludes partial-close symbols despite having sell trades', () => {
    const trades = [
      makeTrade('RELIANCE', '2024-05-10', 'buy', 200, 2500),
      makeTrade('RELIANCE', '2024-05-15', 'sell', 100, 2600),
      // Still holding 100 shares
    ]
    // openQuantity = 100 → partial close, still open
    const symbolPnL = [makeSymbolPnL('RELIANCE', 10000, { openQuantity: 100 })]

    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    expect(timeline).toHaveLength(0)
  })
})
