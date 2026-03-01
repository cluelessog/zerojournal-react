import type { RawTrade, SymbolPnL } from '@/lib/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timestamp(): string {
  const now = new Date()
  const pad = (n: number, d = 2) => String(n).padStart(d, '0')
  return (
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

/** Quote a CSV field if it contains a comma, double-quote, or newline. */
function csvField(value: string | number | null | undefined): string {
  const s = String(value ?? '')
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

function buildCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvField).join(',')]
  for (const row of rows) {
    lines.push(row.map(csvField).join(','))
  }
  return lines.join('\n')
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Exports ──────────────────────────────────────────────────────────────────

export function exportTradesCSV(trades: RawTrade[]): void {
  const headers = [
    'Symbol',
    'ISIN',
    'Trade Date',
    'Exchange',
    'Segment',
    'Series',
    'Trade Type',
    'Quantity',
    'Price',
    'Value',
    'Trade ID',
    'Order ID',
    'Order Execution Time',
  ]
  const rows = trades.map((t) => [
    t.symbol,
    t.isin,
    t.tradeDate,
    t.exchange,
    t.segment,
    t.series,
    t.tradeType,
    t.quantity,
    t.price,
    (t.quantity * t.price).toFixed(2),
    t.tradeId,
    t.orderId,
    t.orderExecutionTime,
  ])
  const csv = buildCSV(headers, rows)
  triggerDownload(csv, `zerojournal-trades-${timestamp()}.csv`, 'text/csv;charset=utf-8;')
}

export function exportTradesJSON(trades: RawTrade[]): void {
  const json = JSON.stringify(trades, null, 2)
  triggerDownload(json, `zerojournal-trades-${timestamp()}.json`, 'application/json')
}

export function exportSymbolPnLCSV(symbolPnLs: SymbolPnL[]): void {
  const headers = [
    'Symbol',
    'ISIN',
    'Quantity',
    'Buy Value',
    'Sell Value',
    'Realized P&L',
    'Unrealized P&L',
    'Open Quantity',
    'Previous Closing Price',
  ]
  const rows = symbolPnLs.map((s) => [
    s.symbol,
    s.isin,
    s.quantity,
    s.buyValue.toFixed(2),
    s.sellValue.toFixed(2),
    s.realizedPnL.toFixed(2),
    s.unrealizedPnL.toFixed(2),
    s.openQuantity,
    s.previousClosingPrice.toFixed(2),
  ])
  const csv = buildCSV(headers, rows)
  triggerDownload(csv, `zerojournal-symbol-pnl-${timestamp()}.csv`, 'text/csv;charset=utf-8;')
}
