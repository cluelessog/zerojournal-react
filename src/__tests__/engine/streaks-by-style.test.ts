import { describe, it, expect } from 'vitest'
import { calculateStreaksByStyle } from '@/lib/engine/analytics'
import type { FIFOMatch } from '@/lib/types'

function makeMatch(pnl: number, holdingDays: number, sellDate = '2024-01-01'): FIFOMatch {
  return {
    symbol: 'TEST',
    buyDate: '2024-01-01',
    sellDate,
    quantity: 1,
    buyPrice: 100,
    sellPrice: 100 + pnl,
    pnl,
    holdingDays,
  }
}

function makeMatches(count: number, holdingDays: number, pnlPattern: number[]): FIFOMatch[] {
  return Array.from({ length: count }, (_, i) => {
    const pnl = pnlPattern[i % pnlPattern.length]
    return makeMatch(pnl, holdingDays, `2024-01-${String(i + 1).padStart(2, '0')}`)
  })
}

describe('calculateStreaksByStyle', () => {
  it('empty matches returns overall with zeros, intraday null, swing null', () => {
    const result = calculateStreaksByStyle([])
    expect(result.overall.longestWinStreak).toBe(0)
    expect(result.overall.longestLossStreak).toBe(0)
    expect(result.intraday).toBeNull()
    expect(result.swing).toBeNull()
  })

  it('25 intraday matches: intraday streaks computed, swing null', () => {
    // Pattern: 5 wins, then 3 losses, repeating
    const matches = makeMatches(25, 0, [100, 100, 100, 100, 100, -50, -50, -50])
    const result = calculateStreaksByStyle(matches)
    expect(result.intraday).not.toBeNull()
    expect(result.intraday!.longestWinStreak).toBe(5)
    expect(result.intraday!.longestLossStreak).toBe(3)
    expect(result.swing).toBeNull()
  })

  it('25 swing matches: swing streaks computed, intraday null', () => {
    const matches = makeMatches(25, 3, [200, -100])
    const result = calculateStreaksByStyle(matches)
    expect(result.swing).not.toBeNull()
    expect(result.swing!.longestWinStreak).toBe(1)
    expect(result.swing!.longestLossStreak).toBe(1)
    expect(result.intraday).toBeNull()
  })

  it('19 intraday + 25 swing: intraday null (below threshold), swing computed', () => {
    const intradayMatches = makeMatches(19, 0, [100])
    const swingMatches = makeMatches(25, 5, [100, -50])
    const result = calculateStreaksByStyle([...intradayMatches, ...swingMatches])
    expect(result.intraday).toBeNull()
    expect(result.swing).not.toBeNull()
  })

  it('mixed 30 intraday + 30 swing: both computed correctly', () => {
    const intradayMatches = makeMatches(30, 0, [100, 100, -50])
    const swingMatches = makeMatches(30, 7, [-100, -100, -100, 200])
    const allMatches = [...intradayMatches, ...swingMatches]
    const result = calculateStreaksByStyle(allMatches)
    expect(result.intraday).not.toBeNull()
    expect(result.swing).not.toBeNull()
    expect(result.intraday!.longestWinStreak).toBe(2)
    expect(result.swing!.longestLossStreak).toBe(3)
    expect(result.overall).toBeDefined()
  })

  it('empty overall returns currentStreak.type as null', () => {
    const result = calculateStreaksByStyle([])
    expect(result.overall.currentStreak.type).toBeNull()
    expect(result.overall.currentStreak.count).toBe(0)
  })

  it('breakeven matches are skipped and do not break streaks', () => {
    // W, W, breakeven, W, L — breakeven should not break the win streak
    const matches: FIFOMatch[] = [
      makeMatch(100, 0, '2024-01-01'),
      makeMatch(200, 0, '2024-01-02'),
      makeMatch(0, 0, '2024-01-03'),   // breakeven — skipped
      makeMatch(150, 0, '2024-01-04'),
      makeMatch(-50, 0, '2024-01-05'),
    ]
    // Need 20+ for style-specific, so test via overall
    const result = calculateStreaksByStyle(matches, 0) // minTrades=0 so style streaks compute
    expect(result.overall.longestWinStreak).toBe(3) // W W W (breakeven skipped)
    expect(result.overall.longestLossStreak).toBe(1)
    expect(result.overall.currentStreak.type).toBe('loss')
  })

  it('all breakeven matches returns null type', () => {
    const matches: FIFOMatch[] = [
      makeMatch(0, 0, '2024-01-01'),
      makeMatch(0, 0, '2024-01-02'),
    ]
    const result = calculateStreaksByStyle(matches, 0)
    expect(result.overall.longestWinStreak).toBe(0)
    expect(result.overall.longestLossStreak).toBe(0)
    expect(result.overall.currentStreak.type).toBeNull()
    expect(result.overall.currentStreak.count).toBe(0)
  })

  it('same-date matches are sorted deterministically by symbol', () => {
    // Two matches on the same date with different symbols — order should be deterministic
    const matchA: FIFOMatch = { symbol: 'AAA', buyDate: '2024-01-01', sellDate: '2024-01-01', quantity: 1, buyPrice: 100, sellPrice: 110, pnl: 10, holdingDays: 0 }
    const matchB: FIFOMatch = { symbol: 'BBB', buyDate: '2024-01-01', sellDate: '2024-01-01', quantity: 1, buyPrice: 100, sellPrice: 90, pnl: -10, holdingDays: 0 }
    // Regardless of input order, result should be the same
    const result1 = calculateStreaksByStyle([matchA, matchB], 0)
    const result2 = calculateStreaksByStyle([matchB, matchA], 0)
    expect(result1.overall.longestWinStreak).toBe(result2.overall.longestWinStreak)
    expect(result1.overall.longestLossStreak).toBe(result2.overall.longestLossStreak)
    expect(result1.overall.currentStreak.type).toBe(result2.overall.currentStreak.type)
    expect(result1.overall.currentStreak.count).toBe(result2.overall.currentStreak.count)
  })
})
