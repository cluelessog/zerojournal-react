import type { RawTrade, SymbolPnL, ChargesBreakdown, ParseWarning } from '@/lib/types'

// ─── ValidationResult ─────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ─── validateTrade ────────────────────────────────────────────────────────────

export function validateTrade(
  trade: Partial<RawTrade>,
  rowNumber: number,
): { valid: boolean; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = []
  let valid = true

  if (!trade.symbol || trade.symbol.trim() === '') {
    warnings.push({ row: rowNumber, field: 'symbol', message: 'Missing symbol', rawValue: trade.symbol })
    valid = false
  }

  if (!trade.isin || trade.isin.trim() === '') {
    warnings.push({ row: rowNumber, field: 'isin', message: 'Missing ISIN', rawValue: trade.isin })
    valid = false
  }

  if (!trade.tradeDate || trade.tradeDate.trim() === '') {
    warnings.push({ row: rowNumber, field: 'tradeDate', message: 'Missing trade date', rawValue: trade.tradeDate })
    valid = false
  }

  if (trade.quantity === undefined || trade.quantity === null || trade.quantity <= 0) {
    warnings.push({ row: rowNumber, field: 'quantity', message: 'Quantity must be a positive integer', rawValue: trade.quantity })
    valid = false
  }

  if (trade.price === undefined || trade.price === null || trade.price <= 0) {
    warnings.push({ row: rowNumber, field: 'price', message: 'Price must be a positive number', rawValue: trade.price })
    valid = false
  }

  if (trade.tradeType !== 'buy' && trade.tradeType !== 'sell') {
    warnings.push({ row: rowNumber, field: 'tradeType', message: `Invalid trade type: "${trade.tradeType}"`, rawValue: trade.tradeType })
    valid = false
  }

  return { valid, warnings }
}

// ─── validateSymbolPnL ────────────────────────────────────────────────────────

export function validateSymbolPnL(
  pnl: Partial<SymbolPnL>,
  rowNumber: number,
): { valid: boolean; warnings: ParseWarning[] } {
  const warnings: ParseWarning[] = []
  let valid = true

  if (!pnl.symbol || pnl.symbol.trim() === '') {
    warnings.push({ row: rowNumber, field: 'symbol', message: 'Missing symbol', rawValue: pnl.symbol })
    valid = false
  }

  if (!pnl.isin || pnl.isin.trim() === '') {
    // ISIN missing is a warning, not a hard error (some entries may lack it)
    warnings.push({ row: rowNumber, field: 'isin', message: 'Missing ISIN', rawValue: pnl.isin })
  }

  if (typeof pnl.buyValue !== 'number' || isNaN(pnl.buyValue)) {
    warnings.push({ row: rowNumber, field: 'buyValue', message: 'Invalid buy value', rawValue: pnl.buyValue })
    valid = false
  }

  if (typeof pnl.sellValue !== 'number' || isNaN(pnl.sellValue)) {
    warnings.push({ row: rowNumber, field: 'sellValue', message: 'Invalid sell value', rawValue: pnl.sellValue })
    valid = false
  }

  if (typeof pnl.realizedPnL !== 'number' || isNaN(pnl.realizedPnL)) {
    warnings.push({ row: rowNumber, field: 'realizedPnL', message: 'Invalid realized P&L', rawValue: pnl.realizedPnL })
    valid = false
  }

  return { valid, warnings }
}

// ─── validateChargesIntegrity ─────────────────────────────────────────────────

export function validateChargesIntegrity(
  charges: ChargesBreakdown,
  reportedTotal: number,
): ParseWarning | null {
  // Sum the breakdown fields (excluding dpCharges and total itself)
  const computed =
    charges.brokerage +
    charges.exchangeTxnCharges +
    charges.sebiTurnoverFee +
    charges.stampDuty +
    charges.stt +
    charges.gst
  const delta = Math.abs(computed - reportedTotal)
  if (delta > 1.0) {
    return {
      row: 0,
      field: 'charges',
      message: `Charges breakdown sum (${computed.toFixed(2)}) differs from reported total (${reportedTotal.toFixed(2)}) by ${delta.toFixed(2)}`,
      rawValue: { computed, reportedTotal },
    }
  }
  return null
}

// ─── validateParsedData ───────────────────────────────────────────────────────

/**
 * Cross-validate trades and symbol P&L entries.
 * Symbol count mismatch between files is a WARNING (not error) — corporate
 * action renames (ITDCEM/CEMPRO etc.) cause name mismatches that ISIN
 * reconciliation resolves downstream.
 */
export function validateParsedData(
  trades: RawTrade[],
  symbolPnL: SymbolPnL[],
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (trades.length === 0) {
    errors.push('No trades found in tradebook')
  }

  if (symbolPnL.length === 0) {
    errors.push('No symbol P&L entries found in PnL file')
  }

  // Unique symbols in tradebook
  const tradebookSymbols = new Set(trades.map(t => t.symbol))
  const pnlSymbols = new Set(symbolPnL.map(s => s.symbol))

  if (tradebookSymbols.size !== pnlSymbols.size) {
    warnings.push(
      `Symbol count mismatch: tradebook has ${tradebookSymbols.size} unique symbols, PnL has ${pnlSymbols.size}. ` +
      `Corporate action renames (e.g., ITDCEM->CEMPRO) may explain this — use ISIN for cross-reference.`,
    )
  }

  // Check for trades with zero price or quantity
  const badPriceTrades = trades.filter(t => t.price <= 0)
  if (badPriceTrades.length > 0) {
    warnings.push(`${badPriceTrades.length} trades have non-positive price`)
  }

  const badQtyTrades = trades.filter(t => t.quantity <= 0)
  if (badQtyTrades.length > 0) {
    warnings.push(`${badQtyTrades.length} trades have non-positive quantity`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}
