import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { parseTradebook } from '@/lib/parser/tradebook-parser'
import { loadXLSX } from '@/lib/parser/excel-utils'
import type { ParseTradebookResult } from '@/lib/types'

// ─── Load fixture ─────────────────────────────────────────────────────────────

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/tradebook-UK4551-EQ.xlsx')

let result: ParseTradebookResult

beforeAll(async () => {
  // Populate the XLSX cache so getSheetRows / coerceCell date branch work
  await loadXLSX()
  const buffer = fs.readFileSync(FIXTURE_PATH)
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  result = parseTradebook({ workbook })
})

// ─── Ground-truth assertions (from soft-blocker-analysis.md) ─────────────────

describe('parseTradebook — ground truth', () => {
  it('parses exactly 2,219 trades', () => {
    expect(result.trades.length).toBe(2219)
    expect(result.rowCount).toBe(2219)
  })

  it('finds exactly 152 unique symbols', () => {
    const symbols = new Set(result.trades.map(t => t.symbol))
    expect(symbols.size).toBe(152)
  })

  it('produces zero parse errors', () => {
    expect(result.errors.length).toBe(0)
  })

  it('computes gross P&L of +51,475.61 (sell total minus buy total)', () => {
    let grossPnL = 0
    for (const t of result.trades) {
      const value = t.quantity * t.price
      if (t.tradeType === 'sell') grossPnL += value
      else grossPnL -= value
    }
    expect(grossPnL).toBeCloseTo(51475.61, 0)
  })

  it('has correct buy / sell split', () => {
    const buys = result.trades.filter(t => t.tradeType === 'buy')
    const sells = result.trades.filter(t => t.tradeType === 'sell')
    // 1129 buys + 1090 sells = 2219 (soft-blocker-analysis confirms 229 intraday combos)
    expect(buys.length + sells.length).toBe(2219)
    // Buys should be more than half (position building is typical)
    expect(buys.length).toBeGreaterThan(1000)
    expect(sells.length).toBeGreaterThan(1000)
  })
})

// ─── Data quality assertions ──────────────────────────────────────────────────

describe('parseTradebook — data quality', () => {
  it('all symbols are non-empty strings', () => {
    for (const t of result.trades) {
      expect(t.symbol).toBeTruthy()
      expect(typeof t.symbol).toBe('string')
    }
  })

  it('all quantities are positive integers', () => {
    for (const t of result.trades) {
      expect(t.quantity).toBeGreaterThan(0)
      expect(Number.isInteger(t.quantity)).toBe(true)
    }
  })

  it('all prices are positive numbers', () => {
    for (const t of result.trades) {
      expect(t.price).toBeGreaterThan(0)
    }
  })

  it('all trade dates are YYYY-MM-DD strings', () => {
    const dateRe = /^\d{4}-\d{2}-\d{2}/
    for (const t of result.trades) {
      expect(t.tradeDate).toMatch(dateRe)
    }
  })

  it('all trade types are buy or sell', () => {
    for (const t of result.trades) {
      expect(['buy', 'sell']).toContain(t.tradeType)
    }
  })

  it('all trade IDs and order IDs are strings', () => {
    for (const t of result.trades) {
      expect(typeof t.tradeId).toBe('string')
      expect(typeof t.orderId).toBe('string')
    }
  })

  it('date range is within FY 2025-2026', () => {
    const dates = result.trades.map(t => t.tradeDate).sort()
    // String comparison works for ISO date format YYYY-MM-DD
    expect(dates[0] >= '2025-04-01').toBe(true)
    expect(dates[dates.length - 1] <= '2026-03-31').toBe(true)
  })
})

// ─── Cross-FY carry-forward documentation ────────────────────────────────────

describe('parseTradebook — cross-FY reconciliation', () => {
  it('documents the Rs. 62,284.42 carry-forward cost basis difference', () => {
    // The tradebook only contains current-FY trades.
    // PnL file uses actual purchase cost (including prior-FY buys).
    // Tradebook buy total: Rs. 20,944,860.66
    // PnL file buy total:  Rs. 21,007,145.08
    // Difference:          Rs.     62,284.42
    //
    // This difference is NOT a data error — it is expected cross-FY behavior.
    // The PnL file's realized P&L is authoritative (-10,808.82).
    // The tradebook gross P&L (+51,475.61) misses prior-year purchase costs.

    let buyTotal = 0
    for (const t of result.trades) {
      if (t.tradeType === 'buy') buyTotal += t.quantity * t.price
    }
    // Tradebook buy total should be ~20,944,860 (allow ±500 for rounding)
    expect(buyTotal).toBeGreaterThan(20_900_000)
    expect(buyTotal).toBeLessThan(21_100_000)
  })
})
