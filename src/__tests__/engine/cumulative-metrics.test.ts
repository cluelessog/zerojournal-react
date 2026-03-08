import { describe, it, expect } from 'vitest'
import { calculateCumulativeMetrics } from '@/lib/engine/cumulative-metrics'
import type { FIFOMatch } from '@/lib/types'

function makeMatch(pnl: number, holdingDays = 1, overrides?: Partial<FIFOMatch>): FIFOMatch {
  return {
    symbol: 'TEST',
    buyDate: '2024-01-01',
    sellDate: '2024-01-02',
    quantity: 1,
    buyPrice: 100,
    sellPrice: 100 + pnl,
    pnl,
    holdingDays,
    ...overrides,
  }
}

describe('calculateCumulativeMetrics', () => {
  it('returns empty array for empty input', () => {
    expect(calculateCumulativeMetrics([])).toEqual([])
  })

  it('single winning trade: winRate=100, profitFactor=5(capped), expectancy=pnl', () => {
    const result = calculateCumulativeMetrics([makeMatch(500)])
    expect(result).toHaveLength(1)
    expect(result[0].tradeIndex).toBe(1)
    expect(result[0].cumulativeWinRate).toBe(100)
    expect(result[0].cumulativeProfitFactor).toBe(5)
    expect(result[0].cumulativeExpectancy).toBe(500)
  })

  it('single losing trade: winRate=0, profitFactor=0, expectancy=pnl', () => {
    const result = calculateCumulativeMetrics([makeMatch(-200)])
    expect(result).toHaveLength(1)
    expect(result[0].cumulativeWinRate).toBe(0)
    expect(result[0].cumulativeProfitFactor).toBe(0)
    expect(result[0].cumulativeExpectancy).toBe(-200)
  })

  it('sorts by sellDate: loss first, then win', () => {
    const matches = [
      makeMatch(100, 1, { symbol: 'B', sellDate: '2024-01-10' }),
      makeMatch(-200, 1, { symbol: 'A', sellDate: '2024-01-05' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    expect(result).toHaveLength(2)
    expect(result[0].cumulativeWinRate).toBe(0)   // first trade is loss
    expect(result[1].cumulativeWinRate).toBe(50)   // 1 win, 1 loss
  })

  it('interleaves same-date matches by symbol to avoid cluster bias', () => {
    // Same sellDate: A (loss) should come before R (win) alphabetically
    const matches = [
      makeMatch(100, 1, { symbol: 'ROHLTD', sellDate: '2024-01-02' }),
      makeMatch(-50, 1, { symbol: 'ABCAP', sellDate: '2024-01-02' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    expect(result).toHaveLength(2)
    // ABCAP (loss) sorted before ROHLTD (win) on same date
    expect(result[0].cumulativeWinRate).toBe(0)
    expect(result[1].cumulativeWinRate).toBe(50)
  })

  it('3 trades: progressive win rate', () => {
    const matches = [
      makeMatch(300, 1, { sellDate: '2024-01-03' }),
      makeMatch(200, 1, { sellDate: '2024-01-04' }),
      makeMatch(-100, 1, { sellDate: '2024-01-05' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    expect(result).toHaveLength(3)
    expect(result[0].cumulativeWinRate).toBe(100)
    expect(result[1].cumulativeWinRate).toBe(100)
    expect(result[2].cumulativeWinRate).toBeCloseTo(66.67, 0)
  })

  it('all losses: profitFactor stays 0, winRate stays 0', () => {
    const matches = [
      makeMatch(-100, 1, { sellDate: '2024-01-02' }),
      makeMatch(-200, 1, { sellDate: '2024-01-03' }),
      makeMatch(-50, 1, { sellDate: '2024-01-04' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    for (const p of result) {
      expect(p.cumulativeWinRate).toBe(0)
      expect(p.cumulativeProfitFactor).toBe(0)
    }
  })

  it('mixed: expectancy = totalPnL / tradeCount at each step', () => {
    const matches = [
      makeMatch(300, 1, { sellDate: '2024-01-02' }),
      makeMatch(-100, 1, { sellDate: '2024-01-03' }),
      makeMatch(200, 1, { sellDate: '2024-01-04' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    expect(result[0].cumulativeExpectancy).toBeCloseTo(300, 2)
    expect(result[1].cumulativeExpectancy).toBeCloseTo(100, 2)   // (300-100)/2
    expect(result[2].cumulativeExpectancy).toBeCloseTo(133.33, 0) // (300-100+200)/3
  })

  it('risk-reward with zero wins returns 0', () => {
    const matches = [
      makeMatch(-100, 1, { sellDate: '2024-01-02' }),
      makeMatch(-200, 1, { sellDate: '2024-01-03' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    for (const p of result) {
      expect(p.cumulativeRiskReward).toBe(0)
    }
  })

  it('profit factor capped at 5 for mixed trades', () => {
    const matches = [
      makeMatch(400, 1, { sellDate: '2024-01-02' }),
      makeMatch(-200, 1, { sellDate: '2024-01-03' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    // After trade 1: PF = 5 (capped, no losses)
    expect(result[0].cumulativeProfitFactor).toBe(5)
    // After trade 2: PF = 400 / 200 = 2.0
    expect(result[1].cumulativeProfitFactor).toBeCloseTo(2.0, 2)
  })

  it('breakeven trade (pnl=0) excluded from win/loss tallies', () => {
    const matches = [
      makeMatch(100, 1, { sellDate: '2024-01-02' }),
      makeMatch(0, 1, { sellDate: '2024-01-03' }),
      makeMatch(-50, 1, { sellDate: '2024-01-04' }),
    ]
    const result = calculateCumulativeMetrics(matches)
    expect(result).toHaveLength(3)
    // After trade 1 (win): 100% WR, 1 win 0 losses
    expect(result[0].cumulativeWinRate).toBe(100)
    // After trade 2 (breakeven): still 100% WR (1 win, 0 losses — breakeven excluded)
    expect(result[1].cumulativeWinRate).toBe(100)
    // After trade 3 (loss): 50% WR (1 win, 1 loss)
    expect(result[2].cumulativeWinRate).toBe(50)
  })
})
