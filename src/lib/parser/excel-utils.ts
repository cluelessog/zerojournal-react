import type * as XLSXType from 'xlsx'

// ─── Lazy XLSX loader ─────────────────────────────────────────────────────────

// Holds the resolved XLSX module after the first loadXLSX() call.
let _xlsxCache: typeof XLSXType | null = null

/**
 * Dynamically import SheetJS and cache it for subsequent calls.
 * Must be awaited before any XLSX operation (openWorkbook, getSheetRows, coerceCell date branch).
 */
export async function loadXLSX(): Promise<typeof XLSXType> {
  if (!_xlsxCache) {
    _xlsxCache = await import('xlsx')
  }
  return _xlsxCache
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type CellTargetType = 'string' | 'number' | 'boolean' | 'date'

// ─── findHeaderRow ────────────────────────────────────────────────────────────

/**
 * Scan rows for a header row containing the expected column names.
 * Returns the 0-based row index and a column-name->index map.
 *
 * @param rows         Array of arrays from sheet_to_json(ws, { header: 1 })
 * @param expectedHeaders  Column names to search for
 * @param minMatches   Minimum number of expected headers that must match (default 5)
 * @param maxScanRows  Maximum rows to scan before giving up (default 30)
 */
export function findHeaderRow(
  rows: unknown[][],
  expectedHeaders: string[],
  minMatches = 5,
  maxScanRows = 30,
): { rowIndex: number; columnMap: Record<string, number> } | null {
  const limit = Math.min(rows.length, maxScanRows)
  for (let i = 0; i < limit; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue
    const columnMap: Record<string, number> = {}
    let matches = 0
    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] ?? '').trim()
      if (expectedHeaders.includes(cell)) {
        columnMap[cell] = j
        matches++
      }
    }
    if (matches >= minMatches) {
      return { rowIndex: i, columnMap }
    }
  }
  return null
}

// ─── coerceCell ───────────────────────────────────────────────────────────────

/**
 * Coerce a cell value to the expected type.
 * Handles: string, number, boolean, date (Excel serial number -> ISO date string).
 *
 * Excel date serials: integers representing days since 1899-12-30.
 * SheetJS returns dates as JS Date objects when cellDates:true, but we use
 * header:1 without cellDates so serials come through as numbers.
 *
 * For the date branch, XLSX must already be loaded via loadXLSX() before calling.
 */
export function coerceCell(value: unknown, targetType: CellTargetType): unknown {
  if (value === null || value === undefined || value === '') {
    return targetType === 'number' ? 0 : targetType === 'boolean' ? false : ''
  }

  switch (targetType) {
    case 'string':
      return String(value).trim()

    case 'number': {
      const n = Number(value)
      return isNaN(n) ? 0 : n
    }

    case 'boolean':
      if (typeof value === 'boolean') return value
      if (typeof value === 'number') return value !== 0
      if (typeof value === 'string') {
        const s = value.trim().toLowerCase()
        return s === 'true' || s === '1' || s === 'yes'
      }
      return Boolean(value)

    case 'date': {
      // Already a string (e.g., "2025-04-01" or "2025-04-01T09:26:27")
      if (typeof value === 'string') {
        const s = value.trim()
        if (s.length >= 8) return s
        return ''
      }
      // Excel serial number -> ISO date string
      if (typeof value === 'number' && value > 0) {
        // _xlsxCache is guaranteed to be set before parsers call coerceCell,
        // because parseTradeBookFile / parsePnLFile call loadXLSX() first.
        const XLSX = _xlsxCache
        if (!XLSX) return ''
        const date = XLSX.SSF.parse_date_code(value)
        if (!date) return ''
        const y = date.y
        const m = String(date.m).padStart(2, '0')
        const d = String(date.d).padStart(2, '0')
        return `${y}-${m}-${d}`
      }
      // JS Date object (shouldn't happen with header:1, but handle defensively)
      if (value instanceof Date) {
        return value.toISOString().slice(0, 10)
      }
      return ''
    }
  }
}

// ─── extractLabeledValue ──────────────────────────────────────────────────────

/**
 * Scan rows for a cell matching `label` in column `labelCol`, then return
 * the numeric value from `valueCol` in the same row.
 * Used for PnL summary section (e.g., label="Charges" -> 20817.67).
 *
 * @param rows      All rows from the sheet
 * @param label     The label text to search for (case-insensitive prefix match)
 * @param labelCol  Column index containing labels (default 1 = column B)
 * @param valueCol  Column index containing values (default 2 = column C)
 */
export function extractLabeledValue(
  rows: unknown[][],
  label: string,
  labelCol = 1,
  valueCol = 2,
): number | null {
  const lowerLabel = label.toLowerCase()
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const cellRaw = row[labelCol]
    if (cellRaw == null) continue
    const cellStr = String(cellRaw).trim().toLowerCase()
    if (cellStr === lowerLabel || cellStr.startsWith(lowerLabel)) {
      const val = row[valueCol]
      if (val == null) return null
      const n = Number(val)
      return isNaN(n) ? null : n
    }
  }
  return null
}

// ─── openWorkbook ─────────────────────────────────────────────────────────────

/**
 * Read an ArrayBuffer into a SheetJS workbook.
 * Loads XLSX dynamically on first call.
 */
export async function openWorkbook(data: ArrayBuffer): Promise<XLSXType.WorkBook> {
  const XLSX = await loadXLSX()
  return XLSX.read(new Uint8Array(data), { type: 'array' })
}

// ─── getSheetRows ─────────────────────────────────────────────────────────────

/**
 * Get all rows from a named sheet as an array-of-arrays.
 * Returns empty array if sheet not found.
 * Requires loadXLSX() to have been called first.
 */
export function getSheetRows(wb: XLSXType.WorkBook, sheetName: string): unknown[][] {
  // _xlsxCache is guaranteed set before this is called (openWorkbook or loadXLSX awaited first)
  const XLSX = _xlsxCache
  if (!XLSX) return []
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
}

// ─── stripChargeSuffix ────────────────────────────────────────────────────────

/**
 * Strip the " - Z" suffix from Zerodha charge labels (e.g., "Brokerage - Z" -> "Brokerage").
 * Some labels (e.g., "IPFT") do not have this suffix — returns them unchanged.
 */
export function stripChargeSuffix(label: string): string {
  return label.replace(/\s*-\s*Z\s*$/i, '').trim()
}
