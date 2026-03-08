import type { FIFOMatch } from '../types'

export interface CumulativeMetricsPoint {
  tradeIndex: number
  cumulativeWinRate: number
  cumulativeProfitFactor: number
  cumulativeRiskReward: number
  cumulativeExpectancy: number
}

export function calculateCumulativeMetrics(matches: FIFOMatch[]): CumulativeMetricsPoint[] {
  if (matches.length === 0) return []

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

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]
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
      cumulativeProfitFactor = sumWinPnL > 0 ? 999 : 0
    } else {
      cumulativeProfitFactor = sumWinPnL / sumLossPnL
    }

    let cumulativeRiskReward: number
    if (wins === 0) {
      cumulativeRiskReward = 0
    } else if (losses === 0) {
      cumulativeRiskReward = 999
    } else {
      const avgWin = sumWinPnL / wins
      const avgLoss = sumLossPnL / losses
      cumulativeRiskReward = avgWin / avgLoss
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
