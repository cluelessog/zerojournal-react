import type * as XLSXType from 'xlsx'
import type { RawTrade, ParseTradebookResult, ParseWarning, ParseError } from '@/lib/types'
import { loadXLSX, findHeaderRow, coerceCell, getSheetRows } from './excel-utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const TRADEBOOK_HEADERS = [
  'Symbol',
  'ISIN',
  'Trade Date',
  'Exchange',
  'Segment',
  'Series',
  'Trade Type',
  'Auction',
  'Quantity',
  'Price',
  'Trade ID',
  'Order ID',
  'Order Execution Time',
]

// ─── parseTradebook ───────────────────────────────────────────────────────────

/**
 * Parse a Zerodha tradebook workbook into an array of RawTrade objects.
 *
 * Algorithm:
 * 1. Read the first sheet (tradebook has only one sheet).
 * 2. Scan first 30 rows for the header row using findHeaderRow().
 * 3. For each data row after the header, map cells to RawTrade by column name.
 * 4. Coerce types, collect warnings for bad rows, skip fully empty rows.
 *
 * Note: XLSX must be loaded via loadXLSX() before calling this function
 * (the coerceCell date branch requires the cached XLSX module).
 */
export function parseTradebook(input: { workbook: XLSXType.WorkBook }): ParseTradebookResult {
  const { workbook } = input
  const warnings: ParseWarning[] = []
  const errors: ParseError[] = []

  // Use the first sheet
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) {
    errors.push({ code: 'NO_SHEET', message: 'Workbook contains no sheets' })
    return { trades: [], warnings, errors, rowCount: 0, skippedRows: 0 }
  }

  const rows = getSheetRows(workbook, firstSheetName)

  // Find header row
  const headerResult = findHeaderRow(rows, TRADEBOOK_HEADERS, 5, 30)
  if (!headerResult) {
    errors.push({
      code: 'HEADER_NOT_FOUND',
      message: 'Could not find tradebook header row in first 30 rows',
      details: { expectedHeaders: TRADEBOOK_HEADERS },
    })
    return { trades: [], warnings, errors, rowCount: 0, skippedRows: 0 }
  }

  const { rowIndex: headerRowIndex, columnMap } = headerResult
  const trades: RawTrade[] = []
  let skippedRows = 0

  // Parse data rows (all rows after the header)
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) { skippedRows++; continue }

    // Skip fully empty rows
    const hasContent = row.some(cell => cell !== null && cell !== undefined && cell !== '')
    if (!hasContent) { skippedRows++; continue }

    // Helper: get cell value by column name
    const get = (colName: string): unknown => {
      const idx = columnMap[colName]
      return idx !== undefined ? row[idx] : null
    }

    const symbol = String(coerceCell(get('Symbol'), 'string') ?? '').trim()
    if (!symbol) {
      warnings.push({ row: i + 1, field: 'Symbol', message: 'Empty symbol — row skipped', rawValue: get('Symbol') })
      skippedRows++
      continue
    }

    const quantityRaw = coerceCell(get('Quantity'), 'number') as number
    const quantity = Math.round(quantityRaw)

    const price = coerceCell(get('Price'), 'number') as number

    const tradeTypeRaw = String(coerceCell(get('Trade Type'), 'string') ?? '').toLowerCase()
    let tradeType: 'buy' | 'sell'
    if (tradeTypeRaw === 'buy' || tradeTypeRaw === 'b') {
      tradeType = 'buy'
    } else if (tradeTypeRaw === 'sell' || tradeTypeRaw === 's') {
      tradeType = 'sell'
    } else {
      warnings.push({ row: i + 1, field: 'Trade Type', message: `Unknown trade type: "${tradeTypeRaw}"`, rawValue: get('Trade Type') })
      skippedRows++
      continue
    }

    const tradeDate = coerceCell(get('Trade Date'), 'date') as string
    const orderExecutionTime = coerceCell(get('Order Execution Time'), 'date') as string

    // Auction: comes as boolean false/true in this file
    const auctionRaw = get('Auction')
    let auction: string
    if (typeof auctionRaw === 'boolean') {
      auction = auctionRaw ? 'true' : 'false'
    } else {
      auction = String(coerceCell(auctionRaw, 'string') ?? '').toLowerCase()
    }

    // Trade ID and Order ID: preserve as strings to avoid precision loss
    const tradeId = String(get('Trade ID') ?? '').trim()
    const orderId = String(get('Order ID') ?? '').trim()

    const trade: RawTrade = {
      symbol,
      isin: String(coerceCell(get('ISIN'), 'string') ?? '').trim(),
      tradeDate,
      exchange: String(coerceCell(get('Exchange'), 'string') ?? '').trim(),
      segment: String(coerceCell(get('Segment'), 'string') ?? '').trim(),
      series: String(coerceCell(get('Series'), 'string') ?? '').trim(),
      tradeType,
      auction,
      quantity,
      price,
      tradeId,
      orderId,
      orderExecutionTime,
    }

    trades.push(trade)
  }

  return {
    trades,
    warnings,
    errors,
    rowCount: trades.length,
    skippedRows,
  }
}

// ─── parseTradeBookFile ───────────────────────────────────────────────────────

/**
 * Parse a tradebook File object (entry point for worker-thread parsing).
 * Loads SheetJS dynamically so it stays out of the main bundle.
 */
export async function parseTradeBookFile(file: File): Promise<ParseTradebookResult> {
  const XLSX = await loadXLSX()
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' })
  const result = parseTradebook({ workbook })
  return result
}
