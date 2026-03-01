import { describe, it, expect } from 'vitest'
import { groupOrders } from '@/lib/engine/order-grouper'
import type { RawTrade } from '@/lib/types'

function makeTrade(
  symbol: string,
  orderId: string,
  tradeType: 'buy' | 'sell',
  quantity: number,
  price: number,
  tradeDate: string = '2025-04-01',
  tradeId?: string
): RawTrade {
  return {
    symbol,
    isin: `INE${symbol}`,
    tradeDate,
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    tradeType,
    auction: '',
    quantity,
    price,
    tradeId: tradeId ?? `T${Math.random()}`,
    orderId,
    orderExecutionTime: `${tradeDate}T10:00:00`,
  }
}

describe('groupOrders', () => {
  it('groups trades by orderId', () => {
    const trades: RawTrade[] = [
      makeTrade('INFY', 'ORD1', 'buy', 10, 1500),
      makeTrade('INFY', 'ORD1', 'buy', 5, 1505),
      makeTrade('TCS', 'ORD2', 'sell', 20, 3200),
    ]

    const groups = groupOrders(trades)
    expect(groups.length).toBe(2)
  })

  it('computes weighted average price for multi-fill orders', () => {
    // ROHLTD partial fill example from section 8.1:
    // 1 @ 399.15, 8 @ 399.15, 15 @ 399.45, 4 @ 399.45, 12 @ 399.45
    // Total qty: 40, weighted avg: 399.39 (approx)
    const orderId = '1300000005104398'
    const trades: RawTrade[] = [
      makeTrade('ROHLTD', orderId, 'buy', 1, 399.15, '2025-04-01', '600870330'),
      makeTrade('ROHLTD', orderId, 'buy', 8, 399.15, '2025-04-01', '600870331'),
      makeTrade('ROHLTD', orderId, 'buy', 15, 399.45, '2025-04-01', '600870332'),
      makeTrade('ROHLTD', orderId, 'buy', 4, 399.45, '2025-04-01', '600870333'),
      makeTrade('ROHLTD', orderId, 'buy', 12, 399.45, '2025-04-01', '600870334'),
    ]

    const groups = groupOrders(trades)
    expect(groups.length).toBe(1)

    const g = groups[0]
    expect(g.symbol).toBe('ROHLTD')
    expect(g.totalBuyQty).toBe(40)

    // Weighted avg: (1*399.15 + 8*399.15 + 15*399.45 + 4*399.45 + 12*399.45) / 40
    // = (399.15 + 3193.20 + 5991.75 + 1597.80 + 4793.40) / 40
    // = 15975.30 / 40 = 399.3825
    expect(g.avgBuyPrice).toBeCloseTo(399.39, 1)
  })

  it('handles single-fill orders', () => {
    const trades: RawTrade[] = [
      makeTrade('RELIANCE', 'ORD1', 'buy', 100, 2500),
    ]

    const groups = groupOrders(trades)
    expect(groups.length).toBe(1)
    expect(groups[0].totalBuyQty).toBe(100)
    expect(groups[0].avgBuyPrice).toBe(2500)
  })

  it('returns empty array for empty input', () => {
    expect(groupOrders([])).toEqual([])
  })

  it('correctly identifies buy vs sell sides', () => {
    const trades: RawTrade[] = [
      makeTrade('INFY', 'ORD1', 'buy', 10, 1500),
      makeTrade('INFY', 'ORD2', 'sell', 10, 1550),
    ]

    const groups = groupOrders(trades)
    expect(groups.length).toBe(2)

    const buyGroup = groups.find((g) => g.buyTrades.length > 0 && g.sellTrades.length === 0)
    const sellGroup = groups.find((g) => g.sellTrades.length > 0 && g.buyTrades.length === 0)

    expect(buyGroup).toBeDefined()
    expect(sellGroup).toBeDefined()
  })
})
