import type { TradeAnalytics, Insight } from '../types'

export function generateInsights(analytics: TradeAnalytics): Insight[] {
  if (analytics.totalTrades === 0) return []

  const insights: Insight[] = []
  const statReady = analytics.totalTrades >= 5

  // Rule 1: Negative overall expectancy (critical, priority 95)
  if (statReady && analytics.expectancy.overall.expectancy < 0) {
    insights.push({
      id: 'negative-expectancy',
      severity: 'critical',
      priority: 95,
      title: 'Negative Expectancy',
      description: `Your overall expectancy is ₹${analytics.expectancy.overall.expectancy.toFixed(2)}/trade. On average, each trade loses money.`,
      metric: 'expectancy',
      recommendation: 'Review losing trades for common patterns. Consider reducing position sizes until expectancy turns positive.',
    })
  }

  // Rule 2: Intraday vs swing profitability divergence (warning, priority 80)
  if (statReady) {
    const intraday = analytics.expectancy.intraday
    const swing = analytics.expectancy.swing
    const intradayCount = intraday.winCount + intraday.lossCount
    const swingCount = swing.winCount + swing.lossCount
    if (intradayCount >= 3 && swingCount >= 3) {
      const intradayPositive = intraday.expectancy > 0
      const swingPositive = swing.expectancy > 0
      if (intradayPositive !== swingPositive) {
        const profitableStyle = intradayPositive ? 'intraday' : 'swing'
        const unprofitableStyle = intradayPositive ? 'swing' : 'intraday'
        const profitableValue = intradayPositive ? intraday.expectancy : swing.expectancy
        const unprofitableValue = intradayPositive ? swing.expectancy : intraday.expectancy
        insights.push({
          id: 'style-divergence',
          severity: 'warning',
          priority: 80,
          title: 'Style Profitability Divergence',
          description: `Your ${profitableStyle} trades are profitable (₹${profitableValue.toFixed(2)}/trade) but ${unprofitableStyle} trades are losing (₹${unprofitableValue.toFixed(2)}/trade).`,
          metric: 'tradingStyles',
          recommendation: `Consider focusing more on ${profitableStyle} trading or improving your ${unprofitableStyle} strategy.`,
        })
      }
    }
  }

  // Rule 3: Loss streak > 3 (warning, priority 75)
  if (
    analytics.streaks.currentStreak.type === 'loss' &&
    analytics.streaks.currentStreak.count > 3
  ) {
    insights.push({
      id: 'loss-streak',
      severity: 'warning',
      priority: 75,
      title: 'Extended Loss Streak',
      description: `You are on a ${analytics.streaks.currentStreak.count}-trade losing streak.`,
      metric: 'streaks',
      recommendation: 'Consider taking a break or reducing position sizes to manage risk during drawdowns.',
    })
  }

  // Rule 4: Max drawdown > 20% (warning, priority 70)
  if (
    analytics.maxDrawdown.mode === 'percentage' &&
    analytics.maxDrawdown.value < -20
  ) {
    insights.push({
      id: 'high-drawdown',
      severity: 'warning',
      priority: 70,
      title: 'High Drawdown',
      description: `Your maximum drawdown is ${analytics.maxDrawdown.value.toFixed(2)}%, indicating significant capital erosion.`,
      metric: 'maxDrawdown',
      recommendation: 'Review risk management rules. Consider setting stop-losses or maximum daily loss limits.',
    })
  }

  // Rule 5: Risk-reward ratio < 1 (warning, priority 65)
  if (
    statReady &&
    analytics.riskReward.overall.ratio > 0 &&
    analytics.riskReward.overall.ratio < 1
  ) {
    insights.push({
      id: 'unfavorable-rr',
      severity: 'warning',
      priority: 65,
      title: 'Unfavorable Risk-Reward',
      description: `Your risk-reward ratio is ${analytics.riskReward.overall.ratio.toFixed(2)}. You risk more than you gain on average.`,
      metric: 'riskReward',
      recommendation: 'Aim for a minimum 1.5:1 reward-to-risk ratio by adjusting targets and stop-losses.',
    })
  }

  // Rule 6: Positive expectancy (positive, priority 50)
  if (statReady && analytics.expectancy.overall.expectancy > 0) {
    insights.push({
      id: 'positive-expectancy',
      severity: 'positive',
      priority: 50,
      title: 'Positive Edge Detected',
      description: `Your overall expectancy is ₹${analytics.expectancy.overall.expectancy.toFixed(2)}/trade. Your strategy has a statistical edge.`,
      metric: 'expectancy',
    })
  }

  // Rule 7: Best trading style recommendation (info, priority 40)
  if (analytics.tradingStyles.bestStyle !== null) {
    const styleName = analytics.tradingStyles.bestStyle
    const styleKey = styleName as keyof typeof analytics.tradingStyles
    const styleMetrics = analytics.tradingStyles[styleKey]
    if (styleMetrics && typeof styleMetrics === 'object' && 'avgPnL' in styleMetrics) {
      const { avgPnL, winRate } = styleMetrics as { avgPnL: number; winRate: number }
      insights.push({
        id: 'best-style',
        severity: 'info',
        priority: 40,
        title: `Best Performing Style: ${styleName}`,
        description: `Your ${styleName} trades have the highest average P&L of ₹${avgPnL.toFixed(2)}/trade with ${winRate.toFixed(1)}% win rate.`,
        metric: 'tradingStyles',
      })
    }
  }

  // Rule 8: Win rate misleading (info, priority 30)
  if (
    statReady &&
    analytics.winRate > 60 &&
    analytics.expectancy.overall.expectancy < 0
  ) {
    insights.push({
      id: 'win-rate-misleading',
      severity: 'info',
      priority: 30,
      title: 'Win Rate Can Be Misleading',
      description: `You win ${analytics.winRate.toFixed(1)}% of trades but still have negative expectancy. Your losses are larger than your wins.`,
      metric: 'winRate',
      recommendation: 'Focus on improving your average loss size rather than win rate.',
    })
  }

  return insights.sort((a, b) => b.priority - a.priority)
}
