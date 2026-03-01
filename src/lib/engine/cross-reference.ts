import type { RawTrade, SymbolPnL, PnLSummary, CrossReferenceData } from '@/lib/types'

/**
 * Build cross-reference data between PnL file (authoritative) and tradebook (supplementary).
 *
 * No formula reconciliation -- PnL realized P&L is authoritative.
 * Calculates carry-forward cost = PnL_buy_total - Tradebook_buy_total.
 */
export function buildCrossReference(
  trades: RawTrade[],
  symbolPnL: SymbolPnL[],
  pnlSummary: PnLSummary
): CrossReferenceData {
  // PnL file values (authoritative)
  const pnlBuyTotal = symbolPnL.reduce((sum, s) => sum + s.buyValue, 0)
  const pnlSellTotal = symbolPnL.reduce((sum, s) => sum + s.sellValue, 0)
  const pnlRealizedPnL = pnlSummary.totalRealizedPnL

  // Tradebook values (supplementary, current FY only)
  let tradebookBuyTotal = 0
  let tradebookSellTotal = 0

  for (const t of trades) {
    const value = t.quantity * t.price
    if (t.tradeType === 'buy') {
      tradebookBuyTotal += value
    } else {
      tradebookSellTotal += value
    }
  }

  const tradebookGrossPnL = tradebookSellTotal - tradebookBuyTotal

  // Carry-forward: difference in buy totals indicates prior-FY cost basis
  const carryForwardCost = pnlBuyTotal - tradebookBuyTotal

  return {
    pnlBuyTotal: Math.round(pnlBuyTotal * 100) / 100,
    pnlSellTotal: Math.round(pnlSellTotal * 100) / 100,
    pnlRealizedPnL: Math.round(pnlRealizedPnL * 100) / 100,
    tradebookBuyTotal: Math.round(tradebookBuyTotal * 100) / 100,
    tradebookSellTotal: Math.round(tradebookSellTotal * 100) / 100,
    tradebookGrossPnL: Math.round(tradebookGrossPnL * 100) / 100,
    carryForwardCost: Math.round(carryForwardCost * 100) / 100,
    hasCarryForward: carryForwardCost > 0,
  }
}
