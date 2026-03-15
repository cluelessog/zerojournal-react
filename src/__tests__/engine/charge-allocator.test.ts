import { describe, it, expect } from 'vitest'
import { allocateCharges } from '@/lib/engine/charge-allocator'
import type { RawTrade } from '@/lib/types'

// Helper to create minimal trades
function makeTrade(price: number, quantity: number): RawTrade {
  return {
    tradeId: '1',
    orderId: '1',
    symbol: 'TEST',
    tradeType: 'buy',
    quantity,
    price,
    tradeDate: '2025-01-01',
    orderExecutionTime: '09:15:00',
    exchange: 'NSE',
    segment: 'EQ',
    isin: '',
    series: '',
    auction: '',
  } as RawTrade
}

describe('allocateCharges', () => {
  it('allocates charges proportionally by turnover', () => {
    const all = [makeTrade(100, 10), makeTrade(200, 5)] // turnovers: 1000, 1000 = total 2000
    const filtered = [makeTrade(100, 10)] // turnover: 1000
    const result = allocateCharges(500, all, filtered)
    expect(result.total).toBeCloseTo(250) // 500 * (1000/2000)
    expect(result.ratio).toBeCloseTo(0.5)
  })

  it('returns zero when totalTurnover is zero', () => {
    const result = allocateCharges(500, [], [])
    expect(result.total).toBe(0)
    expect(result.ratio).toBe(0)
  })

  it('returns full charges when all trades are filtered', () => {
    const all = [makeTrade(100, 10)]
    const result = allocateCharges(500, all, all)
    expect(result.total).toBeCloseTo(500)
    expect(result.ratio).toBeCloseTo(1)
  })

  it('handles single filtered trade from many', () => {
    const all = [makeTrade(100, 10), makeTrade(50, 20), makeTrade(200, 5)]
    // turnovers: 1000, 1000, 1000 = total 3000
    const filtered = [makeTrade(100, 10)] // turnover: 1000
    const result = allocateCharges(900, all, filtered)
    expect(result.total).toBeCloseTo(300) // 900 * (1000/3000)
    expect(result.ratio).toBeCloseTo(1 / 3)
  })
})
