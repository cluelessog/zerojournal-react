import { describe, it, expect } from 'vitest'
import { matchTradesWithPnL } from '@/lib/engine/fifo-matcher'
import { calculateExpectancy, calculateRiskReward } from '@/lib/engine/analytics'
import type { RawTrade } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTrade(
  opts: Partial<RawTrade> & { tradeType: 'buy' | 'sell'; price: number; quantity: number; tradeDate: string }
): RawTrade {
  return {
    symbol: 'TEST',
    isin: 'INE000A01000',
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    auction: 'N',
    tradeId: `T${Math.random().toString(36).slice(2)}`,
    orderId: `O${Math.random().toString(36).slice(2)}`,
    orderExecutionTime: `${opts.tradeDate} 09:15:00`,
    ...opts,
  }
}

// ─── FIFO Matcher Tests ────────────────────────────────────────────────────────

describe('matchTradesWithPnL — FIFO matching', () => {
  it('basic single buy → single sell', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 120, quantity: 10 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(1)
    expect(matches[0].pnl).toBeCloseTo(200) // (120-100)*10
    expect(matches[0].holdingDays).toBe(3)
    expect(matches[0].quantity).toBe(10)
  })

  it('intraday trade produces holdingDays === 0', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', orderExecutionTime: '2025-01-02 09:15:00', tradeType: 'buy', price: 100, quantity: 5 }),
      makeTrade({ tradeDate: '2025-01-02', orderExecutionTime: '2025-01-02 10:30:00', tradeType: 'sell', price: 110, quantity: 5 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(1)
    expect(matches[0].holdingDays).toBe(0)
    expect(matches[0].pnl).toBeCloseTo(50)
  })

  it('partial fill: sell 60 from buy 100 leaves 40 in queue', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 100 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 130, quantity: 60 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(1)
    expect(matches[0].quantity).toBe(60)
    expect(matches[0].pnl).toBeCloseTo(1800) // (130-100)*60
  })

  it('partial fill: sell 100 against buy 60 + buy 40', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 60 }),
      makeTrade({ tradeDate: '2025-01-03', tradeType: 'buy', price: 110, quantity: 40 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 130, quantity: 100 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(2)
    // Match 1: 60 shares at buy=100
    expect(matches[0].quantity).toBe(60)
    expect(matches[0].pnl).toBeCloseTo(1800) // (130-100)*60
    // Match 2: 40 shares at buy=110
    expect(matches[1].quantity).toBe(40)
    expect(matches[1].pnl).toBeCloseTo(800) // (130-110)*40
  })

  it('multi-round-trip: buy 100, sell 100, buy 50, sell 50 → 2 separate matches', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 100 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 110, quantity: 100 }),
      makeTrade({ tradeDate: '2025-01-07', tradeType: 'buy', price: 105, quantity: 50 }),
      makeTrade({ tradeDate: '2025-01-10', tradeType: 'sell', price: 115, quantity: 50 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(2)
    expect(matches[0].pnl).toBeCloseTo(1000) // (110-100)*100
    expect(matches[1].pnl).toBeCloseTo(500)  // (115-105)*50
  })

  it('orphan sell (no matching buy) is skipped gracefully', () => {
    const trades = [
      // No buy before this sell (carry-forward position)
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'sell', price: 120, quantity: 10 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(0)
  })

  it('negative holding days are skipped', () => {
    // Sell date before buy date (data anomaly)
    const trades = [
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'sell', price: 110, quantity: 10 }),
    ]
    const matches = matchTradesWithPnL(trades)
    // Sell is sorted before buy because of tradeDate ordering, so sell has no queue → orphan
    expect(matches).toHaveLength(0)
  })

  it('multiple symbols are matched independently', () => {
    const trades = [
      makeTrade({ symbol: 'AAAA', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'BBBB', tradeDate: '2025-01-02', tradeType: 'buy', price: 200, quantity: 5 }),
      makeTrade({ symbol: 'AAAA', tradeDate: '2025-01-05', tradeType: 'sell', price: 110, quantity: 10 }),
      makeTrade({ symbol: 'BBBB', tradeDate: '2025-01-05', tradeType: 'sell', price: 190, quantity: 5 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches).toHaveLength(2)
    const aaaa = matches.find((m) => m.symbol === 'AAAA')!
    const bbbb = matches.find((m) => m.symbol === 'BBBB')!
    expect(aaaa.pnl).toBeCloseTo(100)  // (110-100)*10
    expect(bbbb.pnl).toBeCloseTo(-50)  // (190-200)*5
  })

  it('empty trades returns empty array', () => {
    expect(matchTradesWithPnL([])).toHaveLength(0)
  })

  it('loss trade has negative pnl', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 150, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 130, quantity: 10 }),
    ]
    const matches = matchTradesWithPnL(trades)
    expect(matches[0].pnl).toBeCloseTo(-200) // (130-150)*10
  })
})

// ─── Expectancy Tests ─────────────────────────────────────────────────────────

describe('calculateExpectancy', () => {
  it('returns zero expectancy for empty matches', () => {
    const result = calculateExpectancy([])
    expect(result.overall.expectancy).toBe(0)
    expect(result.overall.winCount).toBe(0)
    expect(result.overall.lossCount).toBe(0)
    expect(result.intraday.expectancy).toBe(0)
    expect(result.swing.expectancy).toBe(0)
  })

  it('calculates correct overall expectancy', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 120, quantity: 10 }), // +200
      makeTrade({ symbol: 'BBBB', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'BBBB', tradeDate: '2025-01-05', tradeType: 'sell', price: 80, quantity: 10 }), // -200
    ]
    const matches = matchTradesWithPnL(trades)
    const result = calculateExpectancy(matches)
    // 1 win (+200), 1 loss (-200): expectancy = 0.5*200 + 0.5*(-200) = 0
    expect(result.overall.winCount).toBe(1)
    expect(result.overall.lossCount).toBe(1)
    expect(result.overall.winRate).toBeCloseTo(0.5)
    expect(result.overall.expectancy).toBeCloseTo(0)
  })

  it('splits intraday and swing correctly', () => {
    const trades = [
      // Intraday trade (same day)
      makeTrade({ symbol: 'AAAA', tradeDate: '2025-01-02', orderExecutionTime: '2025-01-02 09:15:00', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'AAAA', tradeDate: '2025-01-02', orderExecutionTime: '2025-01-02 10:30:00', tradeType: 'sell', price: 110, quantity: 10 }), // +100 intraday
      // Swing trade
      makeTrade({ symbol: 'BBBB', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'BBBB', tradeDate: '2025-01-05', tradeType: 'sell', price: 90, quantity: 10 }),  // -100 swing
    ]
    const matches = matchTradesWithPnL(trades)
    const result = calculateExpectancy(matches)
    expect(result.intraday.winCount).toBe(1)
    expect(result.intraday.lossCount).toBe(0)
    expect(result.intraday.expectancy).toBeCloseTo(100)
    expect(result.swing.lossCount).toBe(1)
    expect(result.swing.winCount).toBe(0)
    expect(result.swing.expectancy).toBeCloseTo(-100)
  })

  it('positive expectancy with all wins', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 120, quantity: 10 }),
    ]
    const matches = matchTradesWithPnL(trades)
    const result = calculateExpectancy(matches)
    expect(result.overall.expectancy).toBeCloseTo(200)
    expect(result.overall.winRate).toBe(1)
  })
})

// ─── Risk-Reward Tests ────────────────────────────────────────────────────────

describe('calculateRiskReward', () => {
  it('returns zero ratio when no losses', () => {
    const trades = [
      makeTrade({ tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ tradeDate: '2025-01-05', tradeType: 'sell', price: 120, quantity: 10 }),
    ]
    const matches = matchTradesWithPnL(trades)
    const result = calculateRiskReward(matches)
    expect(result.overall.ratio).toBe(0)
    expect(result.overall.lossCount).toBe(0)
  })

  it('calculates correct R:R ratio', () => {
    // avgWin = 300, avgLoss = -100 → ratio = 3.0
    const trades = [
      makeTrade({ symbol: 'W1', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'W1', tradeDate: '2025-01-05', tradeType: 'sell', price: 130, quantity: 10 }), // +300
      makeTrade({ symbol: 'L1', tradeDate: '2025-01-02', tradeType: 'buy', price: 100, quantity: 10 }),
      makeTrade({ symbol: 'L1', tradeDate: '2025-01-05', tradeType: 'sell', price: 90, quantity: 10 }),  // -100
    ]
    const matches = matchTradesWithPnL(trades)
    const result = calculateRiskReward(matches)
    expect(result.overall.ratio).toBeCloseTo(3.0)
    expect(result.overall.avgWin).toBeCloseTo(300)
    expect(result.overall.avgLoss).toBeCloseTo(-100)
  })
})
