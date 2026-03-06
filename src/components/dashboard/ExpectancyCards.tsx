import type { ExpectancyMetric, RiskRewardMetric, ExpectancyBreakdown, RiskRewardBreakdown } from '@/lib/types'

interface ExpectancyCardsProps {
  expectancy: ExpectancyMetric
  riskReward: RiskRewardMetric
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${value < 0 ? '-' : ''}Rs. ${formatted}`
}

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(2)}:1`
}

// ─── Expectancy Row ───────────────────────────────────────────────────────────

function ExpectancyRow({ label, data }: { label: string; data: ExpectancyBreakdown }) {
  const total = data.winCount + data.lossCount
  const expectancyColor = data.expectancy > 0
    ? 'text-green-600 dark:text-green-400'
    : data.expectancy < 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-600 dark:text-gray-400'

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">{label}</div>
      {total === 0 ? (
        <div className="text-sm text-gray-400 italic">No trades</div>
      ) : (
        <>
          <div className={`text-2xl font-bold ${expectancyColor}`}>
            {formatCurrency(data.expectancy)}
            <span className="ml-1 text-sm font-normal text-gray-500">/trade</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-gray-500 dark:text-gray-400">
            <div>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {data.winCount}W
              </span>
              {' · '}
              <span className="text-red-600 dark:text-red-400 font-medium">
                {data.lossCount}L
              </span>
              {' · '}
              <span>{(data.winRate * 100).toFixed(0)}% win</span>
            </div>
            <div className="text-right">
              <span className="text-green-600 dark:text-green-400">
                avg +{formatCurrency(data.avgWin)}
              </span>
            </div>
            <div className="col-span-2 text-right">
              <span className="text-red-600 dark:text-red-400">
                avg {formatCurrency(data.avgLoss)}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Risk-Reward Row ──────────────────────────────────────────────────────────

function RiskRewardRow({ label, data }: { label: string; data: RiskRewardBreakdown }) {
  const total = data.winCount + data.lossCount

  const ratioColor = data.ratio >= 2
    ? 'text-green-600 dark:text-green-400'
    : data.ratio >= 1
      ? 'text-yellow-600 dark:text-yellow-400'
      : data.lossCount === 0
        ? 'text-gray-400'
        : 'text-red-600 dark:text-red-400'

  const ratioLabel = data.lossCount === 0
    ? 'No losses'
    : data.ratio >= 2
      ? 'Good'
      : data.ratio >= 1
        ? 'Acceptable'
        : 'Poor'

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-2 text-sm font-medium text-gray-600 dark:text-gray-400">{label}</div>
      {total === 0 ? (
        <div className="text-sm text-gray-400 italic">No trades</div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <div className={`text-2xl font-bold ${ratioColor}`}>
              {data.lossCount === 0 ? '—' : formatRatio(data.ratio)}
            </div>
            <div className={`text-xs font-medium ${ratioColor}`}>{ratioLabel}</div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 text-xs text-gray-500 dark:text-gray-400">
            <div>
              <span className="text-green-600 dark:text-green-400 font-medium">
                {data.winCount}W
              </span>
              {' · '}
              <span className="text-red-600 dark:text-red-400 font-medium">
                {data.lossCount}L
              </span>
            </div>
            <div className="text-right">
              <span className="text-green-600 dark:text-green-400">
                avg +{formatCurrency(data.avgWin)}
              </span>
            </div>
            <div className="col-span-2 text-right">
              {data.lossCount > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  avg {formatCurrency(data.avgLoss)}
                </span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ExpectancyCards({ expectancy, riskReward }: ExpectancyCardsProps) {
  return (
    <div className="space-y-6">
      {/* Expectancy Section */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Expectancy</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Average profit/loss per FIFO-matched trade (intraday vs. swing split)
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <ExpectancyRow label="Overall" data={expectancy.overall} />
          <ExpectancyRow label="Intraday" data={expectancy.intraday} />
          <ExpectancyRow label="Swing" data={expectancy.swing} />
        </div>
      </div>

      {/* Risk-Reward Section */}
      <div className="space-y-3">
        <div>
          <h3 className="text-lg font-semibold">Risk-Reward Ratio</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Avg win / |avg loss| — good ≥ 2:1, acceptable 1–2:1, poor &lt; 1:1
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <RiskRewardRow label="Overall" data={riskReward.overall} />
          <RiskRewardRow label="Intraday" data={riskReward.intraday} />
          <RiskRewardRow label="Swing" data={riskReward.swing} />
        </div>
      </div>
    </div>
  )
}
