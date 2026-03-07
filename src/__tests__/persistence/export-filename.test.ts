import { describe, it, expect } from 'vitest'
import { buildDateRangeFilename } from '@/lib/persistence/import-export'
import type { RawTrade } from '@/lib/types'

function makeTrade(tradeDate: string): RawTrade {
  return {
    symbol: 'TEST',
    isin: 'INE000000000',
    tradeDate,
    exchange: 'NSE',
    segment: 'EQ',
    series: 'EQ',
    tradeType: 'buy',
    auction: '',
    quantity: 1,
    price: 100,
    tradeId: '1',
    orderId: '1',
    orderExecutionTime: '10:00:00',
  }
}

describe('buildDateRangeFilename', () => {
  it('returns timestamp-based filename for empty trades array', () => {
    const result = buildDateRangeFilename('trades', [])
    expect(result).toMatch(/^zerojournal-trades-\d{4}-\d{2}-\d{2}-\d{6}\.csv$/)
  })

  it('returns date range filename for trades with dates', () => {
    const trades = [
      makeTrade('2024-01-15'),
      makeTrade('2024-03-20'),
      makeTrade('2024-02-10'),
    ]
    const result = buildDateRangeFilename('trades', trades)
    expect(result).toBe('zerojournal-trades_2024-01-15_to_2024-03-20.csv')
  })

  it('handles single trade', () => {
    const trades = [makeTrade('2024-06-01')]
    const result = buildDateRangeFilename('symbol-pnl', trades)
    expect(result).toBe('zerojournal-symbol-pnl_2024-06-01_to_2024-06-01.csv')
  })

  it('uses correct prefix in filename', () => {
    const trades = [makeTrade('2024-01-01'), makeTrade('2024-12-31')]
    const result = buildDateRangeFilename('symbol-pnl', trades)
    expect(result).toBe('zerojournal-symbol-pnl_2024-01-01_to_2024-12-31.csv')
  })

  it('falls back to timestamp for trades with empty/malformed dates', () => {
    const trades = [makeTrade(''), makeTrade('bad')]
    const result = buildDateRangeFilename('trades', trades)
    expect(result).toMatch(/^zerojournal-trades-\d{4}-\d{2}-\d{2}-\d{6}\.csv$/)
  })
})
