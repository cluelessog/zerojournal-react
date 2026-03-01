import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
  type PieLabelRenderProps,
} from 'recharts'
import type { PnLSummary } from '@/lib/types'

interface ChargesBreakdownProps {
  pnlSummary: PnLSummary
}

const COLORS = [
  '#6366f1', // brokerage - indigo
  '#f59e0b', // exchange txn - amber
  '#10b981', // sebi - emerald
  '#3b82f6', // stamp duty - blue
  '#ef4444', // stt - red
  '#8b5cf6', // gst - violet
  '#64748b', // dp charges - slate
]

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function ChargesBreakdown({ pnlSummary }: ChargesBreakdownProps) {
  const { charges } = pnlSummary

  const lineItems = [
    { label: 'Brokerage', value: charges.brokerage },
    { label: 'Exchange Txn Charges', value: charges.exchangeTxnCharges },
    { label: 'SEBI Turnover Fee', value: charges.sebiTurnoverFee },
    { label: 'Stamp Duty', value: charges.stampDuty },
    { label: 'STT', value: charges.stt },
    { label: 'GST', value: charges.gst },
    { label: 'DP Charges', value: charges.dpCharges },
  ]

  const tradingChargesTotal = charges.total
  const grandTotal = charges.total + charges.dpCharges

  const pieData = lineItems
    .map((item, originalIndex) => ({
      name: item.label,
      value: item.value,
      color: COLORS[originalIndex % COLORS.length],
    }))
    .filter((item) => item.value > 0)

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {/* Pie chart */}
      <div className="flex-1 min-w-0">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={110}
                dataKey="value"
                label={(props: PieLabelRenderProps) => {
                  const percent = (props.percent ?? 0) as number;
                  return `${props.name ?? ''} ${(percent * 100).toFixed(1)}%`;
                }}
                labelLine={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const d = payload[0].payload as { name: string; value: number }
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-md text-xs">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-muted-foreground">Rs. {fmt(d.value)}</p>
                    </div>
                  )
                }}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-w-0">
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Charge Type
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount (Rs.)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
              {lineItems.map((item, i) => (
                <tr key={item.label} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-2 flex items-center gap-2 text-gray-700 dark:text-gray-300">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    {item.label}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-700 dark:text-gray-300 font-mono">
                    {fmt(item.value)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600">
              <tr>
                <td className="px-4 py-2 font-semibold text-gray-900 dark:text-gray-100">
                  Trading Charges Subtotal
                </td>
                <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100 font-mono">
                  {fmt(tradingChargesTotal)}
                </td>
              </tr>
              <tr className="border-t border-gray-300 dark:border-gray-600">
                <td className="px-4 py-2 font-bold text-gray-900 dark:text-gray-100">
                  Grand Total (incl. DP)
                </td>
                <td className="px-4 py-2 text-right font-bold text-red-600 dark:text-red-400 font-mono">
                  {fmt(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          * DP Charges are deducted separately by the depository on sell transactions and are not included in the trading charges total from the P&L file.
        </p>
      </div>
    </div>
  )
}
