import type { FIFOMatch } from '../types'

export interface CumulativeMetricsPoint {
  tradeIndex: number
  cumulativeWinRate: number
  cumulativeProfitFactor: number
  cumulativeRiskReward: number
  cumulativeExpectancy: number
}

/** Cap for profit factor and risk-reward to prevent Y-axis distortion */
const RATIO_CAP = 5

export function calculateCumulativeMetrics(matches: FIFOMatch[]): CumulativeMetricsPoint[] {
  if (matches.length === 0) return []

  // Sort chronologically by sell date so cumulative curves reflect the trading journey
  const sorted = [...matches].sort((a, b) => {
    if (a.sellDate !== b.sellDate) return a.sellDate < b.sellDate ? -1 : 1
    if (a.buyDate !== b.buyDate) return a.buyDate < b.buyDate ? -1 : 1
    return 0
  })

  const points: CumulativeMetricsPoint[] = [{
    tradeIndex: 0,
    cumulativeWinRate: 0,
    cumulativeProfitFactor: 0,
    cumulativeRiskReward: 0,
    cumulativeExpectancy: 0,
  }]
  let wins = 0
  let losses = 0
  let sumWinPnL = 0
  let sumLossPnL = 0
  let totalPnL = 0

  for (let i = 0; i < sorted.length; i++) {
    const m = sorted[i]
    totalPnL += m.pnl

    if (m.pnl > 0) {
      wins++
      sumWinPnL += m.pnl
    } else {
      losses++
      sumLossPnL += Math.abs(m.pnl)
    }

    const total = wins + losses
    const cumulativeWinRate = (wins / total) * 100

    let cumulativeProfitFactor: number
    if (sumLossPnL === 0) {
      cumulativeProfitFactor = sumWinPnL > 0 ? RATIO_CAP : 0
    } else {
      cumulativeProfitFactor = Math.min(sumWinPnL / sumLossPnL, RATIO_CAP)
    }

    let cumulativeRiskReward: number
    if (wins === 0) {
      cumulativeRiskReward = 0
    } else if (losses === 0) {
      cumulativeRiskReward = RATIO_CAP
    } else {
      const avgWin = sumWinPnL / wins
      const avgLoss = sumLossPnL / losses
      cumulativeRiskReward = Math.min(avgWin / avgLoss, RATIO_CAP)
    }

    const cumulativeExpectancy = totalPnL / total

    points.push({
      tradeIndex: i + 1,
      cumulativeWinRate,
      cumulativeProfitFactor,
      cumulativeRiskReward,
      cumulativeExpectancy,
    })
  }

  return points
}
