import * as XLSX from 'xlsx'
import type {
  ParsePnLResult,
  SymbolPnL,
  ChargesBreakdown,
  PnLSummary,
  DPCharge,
  ParseWarning,
  ParseError,
} from '@/lib/types'
import { findHeaderRow, coerceCell, extractLabeledValue, getSheetRows, stripChargeSuffix } from './excel-utils'

// ─── Constants ────────────────────────────────────────────────────────────────

const SYMBOL_PNL_HEADERS = ['Symbol', 'ISIN', 'Quantity', 'Buy Value', 'Sell Value', 'Realized P&L']

const DP_SHEET_HEADERS = ['Particulars', 'Posting Date', 'Debit', 'Credit']

/** Map from stripped charge label -> ChargesBreakdown field */
const CHARGE_LABEL_MAP: Record<string, keyof ChargesBreakdown> = {
  'brokerage': 'brokerage',
  'exchange transaction charges': 'exchangeTxnCharges',
  'clearing charges': 'exchangeTxnCharges',   // merged into exchangeTxnCharges if separate entry absent
  'central gst': 'gst',
  'state gst': 'gst',
  'integrated gst': 'gst',
  'securities transaction tax': 'stt',
  'sebi turnover fees': 'sebiTurnoverFee',
  'sebi turnover fee': 'sebiTurnoverFee',
  'stamp duty': 'stampDuty',
  'ipft': 'total',   // IPFT added to total only (no dedicated field)
  'dp charges': 'dpCharges',
}

// ─── parsePnL ─────────────────────────────────────────────────────────────────

/**
 * Parse a Zerodha PnL workbook.
 *
 * Three-phase approach:
 *   Phase 1: Extract summary values (realized P&L, unrealized P&L, charges total)
 *   Phase 2: Extract per-charge-line breakdown from the charges section
 *   Phase 3: Extract per-symbol P&L rows (header ~row 38)
 *   Bonus:   Extract DP charges from "Other Debits and Credits" sheet
 */
export function parsePnL(input: { workbook: XLSX.WorkBook }): ParsePnLResult {
  const { workbook } = input
  const warnings: ParseWarning[] = []
  const errors: ParseError[] = []

  // ── Identify the main P&L sheet ───────────────────────────────────────────
  // Zerodha PnL files have one main sheet. Use first sheet.
  const mainSheetName = workbook.SheetNames[0]
  if (!mainSheetName) {
    errors.push({ code: 'NO_SHEET', message: 'PnL workbook contains no sheets' })
    return makeEmptyResult(warnings, errors)
  }

  const rows = getSheetRows(workbook, mainSheetName)

  // ── Phase 1: Summary values ───────────────────────────────────────────────
  // Labels appear in column B (index 1), values in column C (index 2).
  // Scan full sheet for each label.
  // Labels are in column index 0 (column A), values in column index 1 (column B)
  const totalCharges = extractLabeledValue(rows, 'Charges', 0, 1) ?? 0
  const otherCreditDebit = extractLabeledValue(rows, 'Other Credit & Debit', 0, 1) ?? 0
  const totalRealizedPnL = extractLabeledValue(rows, 'Realized P&L', 0, 1) ?? 0
  const totalUnrealizedPnL = extractLabeledValue(rows, 'Unrealized P&L', 0, 1) ?? 0

  // ── Phase 2: Charges breakdown ────────────────────────────────────────────
  const charges = parseChargesBreakdown(rows, warnings)
  // Use the authoritative total from the summary section (more reliable)
  if (totalCharges !== 0) {
    charges.total = totalCharges
  }

  // DP charges total comes from "Other Credit & Debit" line (negative = debit)
  charges.dpCharges = Math.abs(otherCreditDebit)

  // ── Phase 3: Per-symbol P&L rows ─────────────────────────────────────────
  const symbolPnL = parseSymbolPnL(rows, warnings)

  if (symbolPnL.length === 0) {
    warnings.push({
      row: 0,
      field: 'symbolPnL',
      message: 'No per-symbol P&L rows found — header may have shifted',
      rawValue: null,
    })
  }

  // ── Bonus: DP charges from "Other Debits and Credits" sheet ──────────────
  const dpCharges = parseDPCharges(workbook, warnings)

  const pnlSummary: PnLSummary = {
    totalRealizedPnL,
    totalUnrealizedPnL,
    charges,
    netPnL: totalRealizedPnL - charges.total,
  }

  return { symbolPnL, pnlSummary, dpCharges, warnings, errors }
}

// ─── parseChargesBreakdown ────────────────────────────────────────────────────

function parseChargesBreakdown(rows: unknown[][], warnings: ParseWarning[]): ChargesBreakdown {
  const charges: ChargesBreakdown = {
    brokerage: 0,
    exchangeTxnCharges: 0,
    sebiTurnoverFee: 0,
    stampDuty: 0,
    stt: 0,
    gst: 0,
    dpCharges: 0,
    total: 0,
  }

  // Find the "Account Head" / "Amount" header that precedes the charges lines
  const chargesHeaderResult = findHeaderRow(rows, ['Account Head', 'Amount'], 2, 50)
  if (!chargesHeaderResult) {
    warnings.push({
      row: 0,
      field: 'charges',
      message: 'Could not find charges header row (Account Head / Amount)',
      rawValue: null,
    })
    return charges
  }

  const { rowIndex: chargesHeaderIdx, columnMap } = chargesHeaderResult
  const labelCol = columnMap['Account Head'] ?? 0
  const amountCol = columnMap['Amount'] ?? 1

  // Read charge lines until we hit an empty row or run out of rows
  let ipft = 0
  for (let i = chargesHeaderIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) break

    const rawLabel = row[labelCol]
    if (rawLabel == null || String(rawLabel).trim() === '') break

    const label = stripChargeSuffix(String(rawLabel).trim()).toLowerCase()
    const amount = Number(row[amountCol] ?? 0)
    if (isNaN(amount)) continue

    const field = CHARGE_LABEL_MAP[label]
    if (field && field !== 'total') {
      // GST fields accumulate (Central + State + Integrated all map to gst)
      ;(charges[field] as number) += amount
    } else if (label === 'ipft') {
      ipft += amount
    } else if (label === 'clearing charges') {
      charges.exchangeTxnCharges += amount
    } else {
      // Unknown charge label — warn but don't drop
      warnings.push({
        row: i + 1,
        field: 'charges',
        message: `Unknown charge label: "${rawLabel}"`,
        rawValue: rawLabel,
      })
    }
  }

  // IPFT is a real charge but has no dedicated field — add to total explicitly
  // (total is overridden by summary value in the caller, so this is informational)
  charges.total = charges.brokerage + charges.exchangeTxnCharges + charges.sebiTurnoverFee +
    charges.stampDuty + charges.stt + charges.gst + ipft

  return charges
}

// ─── parseSymbolPnL ───────────────────────────────────────────────────────────

function parseSymbolPnL(rows: unknown[][], warnings: ParseWarning[]): SymbolPnL[] {
  const result = findHeaderRow(rows, SYMBOL_PNL_HEADERS, 4, rows.length)
  if (!result) {
    warnings.push({
      row: 0,
      field: 'symbolPnL',
      message: 'Could not find per-symbol P&L header row',
      rawValue: null,
    })
    return []
  }

  const { rowIndex: headerIdx, columnMap } = result
  const symbols: SymbolPnL[] = []

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue

    const get = (col: string): unknown => {
      const idx = columnMap[col]
      return idx !== undefined ? row[idx] : null
    }

    const symbol = String(coerceCell(get('Symbol'), 'string') ?? '').trim()
    if (!symbol) continue  // end of data (blank row)

    const isin = String(coerceCell(get('ISIN'), 'string') ?? '').trim()

    // Segment and Series: may be present in extended columns
    const segmentIdx = columnMap['Segment']
    const seriesIdx = columnMap['Series']
    const segment = segmentIdx !== undefined ? String(coerceCell(row[segmentIdx], 'string') ?? '').trim() : ''
    const series = seriesIdx !== undefined ? String(coerceCell(row[seriesIdx], 'string') ?? '').trim() : ''

    const quantity = Math.round(coerceCell(get('Quantity'), 'number') as number)
    const buyValue = coerceCell(get('Buy Value'), 'number') as number
    const sellValue = coerceCell(get('Sell Value'), 'number') as number
    const realizedPnL = coerceCell(get('Realized P&L'), 'number') as number

    // Unrealized P&L and open quantity: may or may not be present
    const unrealizedPnLIdx = columnMap['Unrealized P&L']
    const openQtyIdx = columnMap['Open Quantity']
    const prevCloseIdx = columnMap['Previous Closing Price']

    const unrealizedPnL = unrealizedPnLIdx !== undefined
      ? (coerceCell(row[unrealizedPnLIdx], 'number') as number)
      : 0
    const openQuantity = openQtyIdx !== undefined
      ? Math.round(coerceCell(row[openQtyIdx], 'number') as number)
      : 0
    const previousClosingPrice = prevCloseIdx !== undefined
      ? (coerceCell(row[prevCloseIdx], 'number') as number)
      : 0

    symbols.push({
      symbol,
      isin,
      quantity,
      buyValue,
      sellValue,
      realizedPnL,
      unrealizedPnL,
      openQuantity,
      previousClosingPrice,
      // Store segment/series for cross-reference if available
      ...(segment ? { segment } : {}),
      ...(series ? { series } : {}),
    } as SymbolPnL)
  }

  return symbols
}

// ─── parseDPCharges ───────────────────────────────────────────────────────────

function parseDPCharges(workbook: XLSX.WorkBook, warnings: ParseWarning[]): DPCharge[] {
  // Find the "Other Debits and Credits" sheet (may have slightly different name)
  const dpSheetName = workbook.SheetNames.find(
    n => n.toLowerCase().includes('other debit') || n.toLowerCase().includes('other credit'),
  )

  if (!dpSheetName) {
    // Not an error — some PnL files don't have this sheet
    return []
  }

  const rows = getSheetRows(workbook, dpSheetName)
  const result = findHeaderRow(rows, DP_SHEET_HEADERS, 3, 20)
  if (!result) {
    warnings.push({
      row: 0,
      field: 'dpCharges',
      message: `Could not find DP charges header in sheet "${dpSheetName}"`,
      rawValue: null,
    })
    return []
  }

  const { rowIndex: headerIdx, columnMap } = result
  const dpCharges: DPCharge[] = []
  // Regex to extract symbol from particulars like "DP Charges for Sale of SYMBOL on DATE"
  const symbolRegex = /Sale of ([\w][\w-]*) on/i

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!Array.isArray(row)) continue

    const particularsIdx = columnMap['Particulars'] ?? 1
    const dateIdx = columnMap['Posting Date'] ?? 2
    const debitIdx = columnMap['Debit'] ?? 3
    const creditIdx = columnMap['Credit'] ?? 4

    const particulars = String(coerceCell(row[particularsIdx], 'string') ?? '').trim()
    if (!particulars) continue

    const dateRaw = row[dateIdx]
    const date = coerceCell(dateRaw, 'date') as string
    const debit = Math.abs(coerceCell(row[debitIdx], 'number') as number)
    const credit = coerceCell(row[creditIdx], 'number') as number

    // Extract symbol from particulars
    const match = symbolRegex.exec(particulars)
    const symbol = match ? match[1] : ''

    dpCharges.push({
      symbol,
      isin: '',           // ISIN not present in DP sheet
      date,
      quantity: 0,        // Quantity not present in DP sheet
      dpChargeAmount: debit || credit,
    })
  }

  return dpCharges
}

// ─── makeEmptyResult ──────────────────────────────────────────────────────────

function makeEmptyResult(warnings: ParseWarning[], errors: ParseError[]): ParsePnLResult {
  return {
    symbolPnL: [],
    pnlSummary: {
      totalRealizedPnL: 0,
      totalUnrealizedPnL: 0,
      charges: {
        brokerage: 0,
        exchangeTxnCharges: 0,
        sebiTurnoverFee: 0,
        stampDuty: 0,
        stt: 0,
        gst: 0,
        dpCharges: 0,
        total: 0,
      },
      netPnL: 0,
    },
    dpCharges: [],
    warnings,
    errors,
  }
}

// ─── parsePnLFile ─────────────────────────────────────────────────────────────

/**
 * Parse a PnL File object (entry point for main-thread parsing).
 */
export async function parsePnLFile(file: File): Promise<ParsePnLResult> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(new Uint8Array(data), { type: 'array' })
  const result = parsePnL({ workbook })
  return result
}
