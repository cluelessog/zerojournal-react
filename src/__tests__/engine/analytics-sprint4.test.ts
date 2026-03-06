import { describe, it, expect } from 'vitest'
import { classifyTradingStyles, calculateMonthlyExpectancy } from '@/lib/engine/analytics'
import type { FIFOMatch } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeMatch(
  opts: Partial<FIFOMatch> & { holdingDays: number; pnl: number },
): FIFOMatch {
  return {
    symbol: 'TEST',
    buyDate: '2025-01-02',
    sellDate: '2025-01-02',
    quantity: 10,
    buyPrice: 100,
    sellPrice: 100 + opts.pnl / 10,
    ...opts,
  }
}

function makeMatchWithDates(
  holdingDays: number,
  pnl: number,
  sellDate: string,
): FIFOMatch {
  // Compute buyDate from sellDate - holdingDays
  const sell = new Date(sellDate)
  const buy = new Date(sell.getTime() - holdingDays * 24 * 60 * 60 * 1000)
  const buyDate = buy.toISOString().slice(0, 10)
  return {
    symbol: 'TEST',
    buyDate,
    sellDate,
    quantity: 10,
    buyPrice: 100,
    sellPrice: 100 + pnl / 10,
    pnl,
    holdingDays,
  }
}

// ─── classifyTradingStyles Tests ──────────────────────────────────────────────

describe('classifyTradingStyles', () => {
  it('returns zero metrics for empty matches', () => {
    const result = classifyTradingStyles([])
    expect(result.intraday.count).toBe(0)
    expect(result.btst.count).toBe(0)
    expect(result.velocity.count).toBe(0)
    expect(result.swing.count).toBe(0)
    expect(result.bestStyle).toBeNull()
    expect(result.worstStyle).toBeNull()
  })

  it('classifies all-intraday trades (holdingDays === 0)', () => {
    const matches = [
      makeMatch({ holdingDays: 0, pnl: 100 }),
      makeMatch({ holdingDays: 0, pnl: -50 }),
      makeMatch({ holdingDays: 0, pnl: 200 }),
    ]
    const result = classifyTradingStyles(matches)
    expect(result.intraday.count).toBe(3)
    expect(result.btst.count).toBe(0)
    expect(result.velocity.count).toBe(0)
    expect(result.swing.count).toBe(0)
    expect(result.intraday.winRate).toBeCloseTo(66.67, 1)
    expect(result.intraday.avgPnL).toBeCloseTo(250 / 3, 2)
    expect(result.intraday.totalPnL).toBe(250)
  })

  it('classifies all-swing trades (holdingDays > 4)', () => {
    const matches = [
      makeMatch({ holdingDays: 5, pnl: 500 }),
      makeMatch({ holdingDays: 10, pnl: -200 }),
      makeMatch({ holdingDays: 7, pnl: 300 }),
    ]
    const result = classifyTradingStyles(matches)
    expect(result.swing.count).toBe(3)
    expect(result.intraday.count).toBe(0)
    expect(result.swing.winRate).toBeCloseTo(66.67, 1)
    expect(result.swing.totalPnL).toBe(600)
  })

  it('classifies BTST (holdingDays === 1) correctly', () => {
    const matches = [
      makeMatch({ holdingDays: 1, pnl: 100 }),
      makeMatch({ holdingDays: 1, pnl: 50 }),
    ]
    const result = classifyTradingStyles(matches)
    expect(result.btst.count).toBe(2)
    expect(result.btst.winRate).toBe(100)
    expect(result.btst.avgPnL).toBe(75)
  })

  it('classifies Velocity (holdingDays 2-4) correctly', () => {
    const matches = [
      makeMatch({ holdingDays: 2, pnl: -100 }),
      makeMatch({ holdingDays: 3, pnl: 200 }),
      makeMatch({ holdingDays: 4, pnl: 100 }),
    ]
    const result = classifyTradingStyles(matches)
    expect(result.velocity.count).toBe(3)
    expect(result.velocity.winRate).toBeCloseTo(66.67, 1)
    expect(result.velocity.totalPnL).toBe(200)
  })

  it('classifies mixed styles and picks best/worst', () => {
    const matches = [
      // 3 intraday: profitable
      makeMatch({ holdingDays: 0, pnl: 500 }),
      makeMatch({ holdingDays: 0, pnl: 200 }),
      makeMatch({ holdingDays: 0, pnl: 100 }),
      // 3 swing: losing
      makeMatch({ holdingDays: 5, pnl: -300 }),
      makeMatch({ holdingDays: 6, pnl: -200 }),
      makeMatch({ holdingDays: 7, pnl: -100 }),
    ]
    const result = classifyTradingStyles(matches)
    expect(result.intraday.count).toBe(3)
    expect(result.swing.count).toBe(3)
    expect(result.bestStyle).toBe('Intraday')
    expect(result.worstStyle).toBe('Swing')
  })

  it('returns null best/worst when fewer than 2 styles meet threshold', () => {
    // Only 3 intraday trades, others below threshold
    const matches = [
      makeMatch({ holdingDays: 0, pnl: 100 }),
      makeMatch({ holdingDays: 0, pnl: 200 }),
      makeMatch({ holdingDays: 0, pnl: 300 }),
      makeMatch({ holdingDays: 5, pnl: 50 }),  // only 1 swing
    ]
    const result = classifyTradingStyles(matches)
    expect(result.intraday.count).toBe(3)
    expect(result.swing.count).toBe(1)
    expect(result.bestStyle).toBeNull()
    expect(result.worstStyle).toBeNull()
  })

  it('handles all 4 categories simultaneously', () => {
    const matches = [
      // 3 intraday
      makeMatch({ holdingDays: 0, pnl: 100 }),
      makeMatch({ holdingDays: 0, pnl: 100 }),
      makeMatch({ holdingDays: 0, pnl: 100 }),
      // 3 btst
      makeMatch({ holdingDays: 1, pnl: -50 }),
      makeMatch({ holdingDays: 1, pnl: -50 }),
      makeMatch({ holdingDays: 1, pnl: -50 }),
      // 3 velocity
      makeMatch({ holdingDays: 3, pnl: 200 }),
      makeMatch({ holdingDays: 3, pnl: 200 }),
      makeMatch({ holdingDays: 3, pnl: 200 }),
      // 3 swing
      makeMatch({ holdingDays: 10, pnl: 50 }),
      makeMatch({ holdingDays: 10, pnl: 50 }),
      makeMatch({ holdingDays: 10, pnl: 50 }),
    ]
    const result = classifyTradingStyles(matches)
    expect(result.intraday.count).toBe(3)
    expect(result.btst.count).toBe(3)
    expect(result.velocity.count).toBe(3)
    expect(result.swing.count).toBe(3)
    expect(result.bestStyle).toBe('Velocity')  // highest avgPnL = 200
    expect(result.worstStyle).toBe('BTST')     // lowest avgPnL = -50
  })
})

// ─── calculateMonthlyExpectancy Tests ─────────────────────────────────────────

describe('calculateMonthlyExpectancy', () => {
  it('returns empty map for no matches', () => {
    const result = calculateMonthlyExpectancy([])
    expect(result.size).toBe(0)
  })

  it('groups by sell month and computes overall expectancy', () => {
    const matches = [
      makeMatchWithDates(0, 100, '2025-01-15'),   // Jan win
      makeMatchWithDates(0, -50, '2025-01-20'),    // Jan loss
      makeMatchWithDates(0, 200, '2025-02-10'),    // Feb win
    ]
    const result = calculateMonthlyExpectancy(matches)
    expect(result.size).toBe(2)

    const jan = result.get('2025-01')!
    // Jan: 1 win (100), 1 loss (-50) → winRate=0.5, avgWin=100, avgLoss=-50
    // expectancy = 0.5 * 100 + 0.5 * (-50) = 25
    expect(jan.overallExpectancy).toBe(25)

    const feb = result.get('2025-02')!
    // Feb: 1 win (200), 0 losses → winRate=1, avgWin=200, avgLoss=0
    // expectancy = 1 * 200 + 0 * 0 = 200
    expect(feb.overallExpectancy).toBe(200)
  })

  it('splits intraday vs swing expectancy per month', () => {
    const matches = [
      makeMatchWithDates(0, 100, '2025-03-10'),    // intraday win
      makeMatchWithDates(0, -50, '2025-03-15'),     // intraday loss
      makeMatchWithDates(5, 300, '2025-03-20'),     // swing win
      makeMatchWithDates(7, -100, '2025-03-25'),    // swing loss
    ]
    const result = calculateMonthlyExpectancy(matches)
    expect(result.size).toBe(1)

    const mar = result.get('2025-03')!
    // Intraday: winRate=0.5, avgWin=100, avgLoss=-50 → expectancy = 25
    expect(mar.intradayExpectancy).toBe(25)
    // Swing: winRate=0.5, avgWin=300, avgLoss=-100 → expectancy = 100
    expect(mar.swingExpectancy).toBe(100)
    expect(mar.overallExpectancy).not.toBeNull()
  })

  it('returns null for intraday/swing when no trades of that type in month', () => {
    const matches = [
      makeMatchWithDates(0, 100, '2025-04-10'),   // intraday only
      makeMatchWithDates(0, -30, '2025-04-15'),    // intraday only
    ]
    const result = calculateMonthlyExpectancy(matches)
    const apr = result.get('2025-04')!
    expect(apr.intradayExpectancy).not.toBeNull()
    expect(apr.swingExpectancy).toBeNull()
  })

  it('handles multiple months correctly', () => {
    const matches = [
      makeMatchWithDates(0, 100, '2025-01-10'),
      makeMatchWithDates(5, -200, '2025-02-10'),
      makeMatchWithDates(0, 50, '2025-03-10'),
      makeMatchWithDates(3, 150, '2025-03-20'),
    ]
    const result = calculateMonthlyExpectancy(matches)
    expect(result.size).toBe(3)
    expect(result.has('2025-01')).toBe(true)
    expect(result.has('2025-02')).toBe(true)
    expect(result.has('2025-03')).toBe(true)

    // March has both intraday and swing
    const mar = result.get('2025-03')!
    expect(mar.intradayExpectancy).not.toBeNull()
    expect(mar.swingExpectancy).not.toBeNull()
  })
})
