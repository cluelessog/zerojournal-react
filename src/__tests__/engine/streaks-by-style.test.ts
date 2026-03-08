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
})
