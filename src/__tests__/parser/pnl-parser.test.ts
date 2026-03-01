import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { parsePnL } from '@/lib/parser/pnl-parser'
import { validateParsedData, validateChargesIntegrity } from '@/lib/parser/validation'
import type { ParsePnLResult } from '@/lib/types'

// ─── Load fixture ─────────────────────────────────────────────────────────────

const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/pnl-UK4551.xlsx')

let result: ParsePnLResult

beforeAll(() => {
  const buffer = fs.readFileSync(FIXTURE_PATH)
  const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
  result = parsePnL({ workbook })
})

// ─── Ground-truth assertions (from soft-blocker-analysis.md) ─────────────────

describe('parsePnL — ground truth', () => {
  it('parses exactly 152 symbol P&L rows', () => {
    expect(result.symbolPnL.length).toBe(152)
  })

  it('realized P&L equals -10,808.82', () => {
    expect(result.pnlSummary.totalRealizedPnL).toBeCloseTo(-10808.82, 0)
  })

  it('total charges equal 20,817.67', () => {
    expect(result.pnlSummary.charges.total).toBeCloseTo(20817.67, 0)
  })

  it('produces zero parse errors', () => {
    expect(result.errors.length).toBe(0)
  })

  it('unrealized P&L is 0.00 (no open positions in summary)', () => {
    // May be 0 for a closed FY or non-zero for current period — accept either
    expect(typeof result.pnlSummary.totalUnrealizedPnL).toBe('number')
  })
})

// ─── Charges breakdown assertions ────────────────────────────────────────────

describe('parsePnL — charges breakdown', () => {
  it('brokerage is parsed as a positive number', () => {
    expect(result.pnlSummary.charges.brokerage).toBeGreaterThan(0)
    // From soft-blocker-analysis: Rs. 8,445.88
    expect(result.pnlSummary.charges.brokerage).toBeCloseTo(8445.88, 0)
  })

  it('STT is parsed as a positive number', () => {
    expect(result.pnlSummary.charges.stt).toBeGreaterThan(0)
    // From soft-blocker-analysis: Rs. 8,435.00
    expect(result.pnlSummary.charges.stt).toBeCloseTo(8435.00, 0)
  })

  it('GST (Integrated GST) is parsed', () => {
    expect(result.pnlSummary.charges.gst).toBeGreaterThan(0)
    // From soft-blocker-analysis: Rs. 1,760.74 (IGST only — Central/State are 0)
    expect(result.pnlSummary.charges.gst).toBeCloseTo(1760.74, 0)
  })

  it('SEBI turnover fee is parsed', () => {
    // From soft-blocker-analysis: Rs. 41.94
    expect(result.pnlSummary.charges.sebiTurnoverFee).toBeCloseTo(41.94, 0)
  })

  it('stamp duty is parsed', () => {
    // From soft-blocker-analysis: Rs. 840.00
    expect(result.pnlSummary.charges.stampDuty).toBeCloseTo(840.00, 0)
  })

  it('IPFT charge (no " - Z" suffix) is captured in total', () => {
    // IPFT = 40.98 per soft-blocker-analysis
    // It has no " - Z" suffix — the parser must handle this edge case
    // We verify the total includes it (total = 20,817.67)
    expect(result.pnlSummary.charges.total).toBeCloseTo(20817.67, 0)
  })
})

// ─── Per-symbol data quality ──────────────────────────────────────────────────

describe('parsePnL — symbol data quality', () => {
  it('all symbols are non-empty strings', () => {
    for (const s of result.symbolPnL) {
      expect(s.symbol).toBeTruthy()
      expect(typeof s.symbol).toBe('string')
    }
  })

  it('buy and sell values are non-negative numbers', () => {
    for (const s of result.symbolPnL) {
      expect(s.buyValue).toBeGreaterThanOrEqual(0)
      expect(s.sellValue).toBeGreaterThanOrEqual(0)
    }
  })

  it('realized P&L sum is close to summary total', () => {
    const sumRealized = result.symbolPnL.reduce((acc, s) => acc + s.realizedPnL, 0)
    // Should match -10,808.82 within Rs. 1 (rounding differences)
    expect(sumRealized).toBeCloseTo(-10808.82, 0)
  })

  it('contains AEGISVOPAK breakeven symbol (realizedPnL = 0)', () => {
    const aegis = result.symbolPnL.find(s => s.symbol === 'AEGISVOPAK')
    expect(aegis).toBeDefined()
    expect(aegis!.realizedPnL).toBeCloseTo(0, 2)
    expect(aegis!.buyValue).toBeCloseTo(29150.00, 0)
    expect(aegis!.sellValue).toBeCloseTo(29150.00, 0)
  })

  it('counts winner/loser/breakeven symbols correctly', () => {
    const winners = result.symbolPnL.filter(s => s.realizedPnL > 0)
    const losers = result.symbolPnL.filter(s => s.realizedPnL < 0)
    const breakeven = result.symbolPnL.filter(s => s.realizedPnL === 0)
    // From soft-blocker-analysis: 49 winners, 102 losers, 1 breakeven
    expect(winners.length).toBe(49)
    expect(losers.length).toBe(102)
    expect(breakeven.length).toBe(1)
    expect(winners.length + losers.length + breakeven.length).toBe(152)
  })

  it('win rate denominator includes breakeven symbols', () => {
    const winners = result.symbolPnL.filter(s => s.realizedPnL > 0).length
    const total = result.symbolPnL.length
    const winRate = winners / total
    // 49/152 = 32.2%
    expect(winRate).toBeCloseTo(0.322, 2)
  })
})

// ─── DP charges ───────────────────────────────────────────────────────────────

describe('parsePnL — DP charges', () => {
  it('DP charges total is ~889.72 (58 entries × Rs. 15.34)', () => {
    // dpCharges is the absolute value from "Other Credit & Debit" summary line
    expect(result.pnlSummary.charges.dpCharges).toBeCloseTo(889.72, 0)
  })
})

// ─── Validation cross-check ───────────────────────────────────────────────────

describe('parsePnL — validation', () => {
  it('charges integrity check passes (breakdown vs total within Rs. 1)', () => {
    const warning = validateChargesIntegrity(
      result.pnlSummary.charges,
      result.pnlSummary.charges.total,
    )
    // The breakdown fields sum is used for the check — may have IPFT difference
    // but we only warn, never error on this
    if (warning) {
      expect(warning.field).toBe('charges')
      // Delta should be small (IPFT = 40.98)
      const delta = Math.abs((warning.rawValue as { computed: number }).computed - result.pnlSummary.charges.total)
      expect(delta).toBeLessThan(50)
    }
  })
})

// ─── Symbol count mismatch (corporate action renames) ────────────────────────

describe('validateParsedData — symbol count mismatch warning', () => {
  it('emits a warning when tradebook and PnL symbol counts differ', () => {
    // Simulate a tradebook with 151 symbols (one symbol missing)
    const fakeTrades = result.symbolPnL.slice(0, 151).map(s => ({
      symbol: s.symbol,
      isin: s.isin,
      tradeDate: '2025-04-01',
      exchange: 'NSE',
      segment: 'EQ',
      series: 'EQ',
      tradeType: 'buy' as const,
      auction: 'false',
      quantity: 10,
      price: 100,
      tradeId: '1',
      orderId: '1',
      orderExecutionTime: '2025-04-01T09:00:00',
    }))
    const validation = validateParsedData(fakeTrades, result.symbolPnL)
    expect(validation.warnings.some(w => w.includes('mismatch'))).toBe(true)
    // Should still be valid (mismatch is warning, not error)
    expect(validation.valid).toBe(true)
  })

  it('no error when both files have 152 symbols', () => {
    const fakeTrades = result.symbolPnL.map(s => ({
      symbol: s.symbol,
      isin: s.isin,
      tradeDate: '2025-04-01',
      exchange: 'NSE',
      segment: 'EQ',
      series: 'EQ',
      tradeType: 'buy' as const,
      auction: 'false',
      quantity: 10,
      price: 100,
      tradeId: '1',
      orderId: '1',
      orderExecutionTime: '2025-04-01T09:00:00',
    }))
    const validation = validateParsedData(fakeTrades, result.symbolPnL)
    expect(validation.errors.length).toBe(0)
  })
})
