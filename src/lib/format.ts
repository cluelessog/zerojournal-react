/** Shared formatting helpers for INR currency, percentages, and numbers. */

export function formatCurrencyINR(value: number): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value < 0 ? '-' : ''}Rs. ${formatted}`
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatNumber(value: number): string {
  return value.toLocaleString('en-IN')
}
