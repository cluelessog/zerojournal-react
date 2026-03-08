import { describe, it, expect } from 'vitest'
import { calculateCumulativeMetrics } from '@/lib/engine/cumulative-metrics'
import type { FIFOMatch } from '@/lib/types'

function makeMatch(pnl: number, holdingDays = 1): FIFOMatch {
  return {
    symbol: 'TEST',
    buyDate: '2024-01-01',
    sellDate: '2024-01-02',
    quantity: 1,
    buyPrice: 100,
    sellPrice: 100 + pnl,
    pnl,
    holdingDays,
  }
}

const BASELINE = {
  tradeIndex: 0,
  cumulativeWinRate: 0,
  cumulativeProfitFactor: 0,
  cumulativeRiskReward: 0,
  cumulativeExpectancy: 0,
}

describe('calculateCumulativeMetrics', () => {
  it('returns empty array for empty input', () => {
    expect(calculateCumulativeMetrics([])).toEqual([])
  })

  it('prepends baseline point at tradeIndex 0 with all metrics at zero', () => {
    const result = calculateCumulativeMetrics([makeMatch(500)])
    expect(result[0]).toEqual(BASELINE)
  })

  it('single winning trade: baseline + winRate=100, profitFactor=5(capped), expectancy=pnl', () => {
    const result = calculateCumulativeMetrics([makeMatch(500)])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(BASELINE)
    expect(result[1].tradeIndex).toBe(1)
    expect(result[1].cumulativeWinRate).toBe(100)
    expect(result[1].cumulativeProfitFactor).toBe(5)
    expect(result[1].cumulativeExpectancy).toBe(500)
  })

  it('single losing trade: baseline + winRate=0, profitFactor=0, expectancy=pnl', () => {
    const result = calculateCumulativeMetrics([makeMatch(-200)])
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual(BASELINE)
    expect(result[1].cumulativeWinRate).toBe(0)
    expect(result[1].cumulativeProfitFactor).toBe(0)
    expect(result[1].cumulativeExpectancy).toBe(-200)
  })

  it('3 trades (2W, 1L): baseline then progressive win rate 100, 100, 66.7', () => {
    const matches = [makeMatch(300), makeMatch(200), makeMatch(-100)]
    const result = calculateCumulativeMetrics(matches)
    expect(result).toHaveLength(4)
    expect(result[0]).toEqual(BASELINE)
    expect(result[1].cumulativeWinRate).toBe(100)
    expect(result[2].cumulativeWinRate).toBe(100)
    expect(result[3].cumulativeWinRate).toBeCloseTo(66.67, 0)
  })

  it('all losses: profitFactor stays 0, winRate stays 0', () => {
    const matches = [makeMatch(-100), makeMatch(-200), makeMatch(-50)]
    const result = calculateCumulativeMetrics(matches)
    expect(result[0]).toEqual(BASELINE)
    for (const p of result.slice(1)) {
      expect(p.cumulativeWinRate).toBe(0)
      expect(p.cumulativeProfitFactor).toBe(0)
    }
  })

  it('mixed: expectancy = totalPnL / tradeCount at each step', () => {
    const matches = [makeMatch(300), makeMatch(-100), makeMatch(200)]
    const result = calculateCumulativeMetrics(matches)
    expect(result[0]).toEqual(BASELINE)
    expect(result[1].cumulativeExpectancy).toBeCloseTo(300, 2)
    expect(result[2].cumulativeExpectancy).toBeCloseTo(100, 2)   // (300-100)/2
    expect(result[3].cumulativeExpectancy).toBeCloseTo(133.33, 0) // (300-100+200)/3
  })

  it('risk-reward with zero wins returns 0', () => {
    const matches = [makeMatch(-100), makeMatch(-200)]
    const result = calculateCumulativeMetrics(matches)
    expect(result[0]).toEqual(BASELINE)
    for (const p of result.slice(1)) {
      expect(p.cumulativeRiskReward).toBe(0)
    }
  })

  it('profit factor calculated correctly for mixed trades', () => {
    const matches = [makeMatch(400), makeMatch(-200)]
    const result = calculateCumulativeMetrics(matches)
    expect(result[0]).toEqual(BASELINE)
    // After trade 1: PF = 5 (capped, no losses)
    expect(result[1].cumulativeProfitFactor).toBe(5)
    // After trade 2: PF = 400 / 200 = 2.0
    expect(result[2].cumulativeProfitFactor).toBeCloseTo(2.0, 2)
  })
})
