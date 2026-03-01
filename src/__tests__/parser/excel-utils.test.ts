import { describe, it, expect } from 'vitest'
import { findHeaderRow, coerceCell, extractLabeledValue, stripChargeSuffix } from '@/lib/parser/excel-utils'

describe('findHeaderRow', () => {
  it('finds header row with enough matching columns', () => {
    const rows: unknown[][] = [
      [null, 'Junk', 'More Junk'],
      [null, 'Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Segment', 'Series'],
      [null, 'ROHLTD', 'INE123', '2025-04-01', 'NSE', 'EQ', 'EQ'],
    ]
    const result = findHeaderRow(rows, ['Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Segment', 'Series'], 5)
    expect(result).not.toBeNull()
    expect(result!.rowIndex).toBe(1)
    expect(result!.columnMap['Symbol']).toBe(1)
    expect(result!.columnMap['ISIN']).toBe(2)
    expect(result!.columnMap['Trade Date']).toBe(3)
  })

  it('returns null when headers are not found', () => {
    const rows: unknown[][] = [
      [null, 'Foo', 'Bar', 'Baz'],
      [null, 'A', 'B', 'C'],
    ]
    const result = findHeaderRow(rows, ['Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Segment'], 5)
    expect(result).toBeNull()
  })

  it('respects maxScanRows limit', () => {
    const rows: unknown[][] = [
      [null, 'Junk'],
      [null, 'Junk'],
      [null, 'Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Segment'],
    ]
    // maxScanRows=2 stops before row index 2
    const result = findHeaderRow(rows, ['Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Segment'], 5, 2)
    expect(result).toBeNull()
  })

  it('accepts fewer minMatches', () => {
    const rows: unknown[][] = [
      [null, 'Symbol', 'ISIN', 'Trade Date'],
    ]
    const result = findHeaderRow(rows, ['Symbol', 'ISIN', 'Trade Date', 'Exchange', 'Segment'], 3)
    expect(result).not.toBeNull()
    expect(result!.rowIndex).toBe(0)
  })
})

describe('coerceCell', () => {
  it('coerces string values', () => {
    expect(coerceCell('  hello  ', 'string')).toBe('hello')
    expect(coerceCell(42, 'string')).toBe('42')
    expect(coerceCell(null, 'string')).toBe('')
  })

  it('coerces number values', () => {
    expect(coerceCell('15.0', 'number')).toBe(15)
    expect(coerceCell(399.45, 'number')).toBe(399.45)
    expect(coerceCell(null, 'number')).toBe(0)
    expect(coerceCell('abc', 'number')).toBe(0)
  })

  it('coerces boolean values', () => {
    expect(coerceCell(true, 'boolean')).toBe(true)
    expect(coerceCell(false, 'boolean')).toBe(false)
    expect(coerceCell(0, 'boolean')).toBe(false)
    expect(coerceCell(1, 'boolean')).toBe(true)
    expect(coerceCell('true', 'boolean')).toBe(true)
    expect(coerceCell('false', 'boolean')).toBe(false)
    expect(coerceCell(null, 'boolean')).toBe(false)
  })

  it('coerces date strings passthrough', () => {
    expect(coerceCell('2025-04-01', 'date')).toBe('2025-04-01')
    expect(coerceCell('2025-04-01T09:26:27', 'date')).toBe('2025-04-01T09:26:27')
  })

  it('coerces Excel serial number to ISO date', () => {
    // Excel serial 45748 = 2025-04-08 (approx)
    const result = coerceCell(45748, 'date') as string
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('returns empty string for null date', () => {
    expect(coerceCell(null, 'date')).toBe('')
    expect(coerceCell('', 'date')).toBe('')
  })
})

describe('extractLabeledValue', () => {
  it('extracts numeric value by label', () => {
    const rows: unknown[][] = [
      [null, 'Realized P&L', 51475.61],
      [null, 'Charges', 20817.67],
      [null, 'Unrealized P&L', 0],
    ]
    expect(extractLabeledValue(rows, 'Charges')).toBeCloseTo(20817.67, 2)
    expect(extractLabeledValue(rows, 'Realized P&L')).toBeCloseTo(51475.61, 2)
    expect(extractLabeledValue(rows, 'Unrealized P&L')).toBeCloseTo(0, 2)
  })

  it('returns null when label not found', () => {
    const rows: unknown[][] = [
      [null, 'Something Else', 100],
    ]
    expect(extractLabeledValue(rows, 'Charges')).toBeNull()
  })
})

describe('stripChargeSuffix', () => {
  it('strips " - Z" suffix', () => {
    expect(stripChargeSuffix('Brokerage - Z')).toBe('Brokerage')
    expect(stripChargeSuffix('Securities Transaction Tax - Z')).toBe('Securities Transaction Tax')
    expect(stripChargeSuffix('Exchange Transaction Charges - Z')).toBe('Exchange Transaction Charges')
  })

  it('leaves labels without suffix unchanged', () => {
    expect(stripChargeSuffix('IPFT')).toBe('IPFT')
    expect(stripChargeSuffix('DP Charges')).toBe('DP Charges')
  })

  it('handles mixed case suffix', () => {
    expect(stripChargeSuffix('Brokerage - z')).toBe('Brokerage')
  })
})
