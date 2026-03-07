import { describe, it, expect } from 'vitest'
import { generateInsights } from '../../lib/engine/insights'
import type { TradeAnalytics } from '../../lib/types'

function makeAnalytics(overrides: Partial<TradeAnalytics> = {}): TradeAnalytics {
  const defaults: TradeAnalytics = {
    totalTrades: 50,
    totalSymbols: 10,
    totalOrderGroups: 40,
    winningTrades: 27,
    losingTrades: 23,
    breakEvenTrades: 0,
    winRate: 55,
    avgWin: 500,
    avgLoss: -300,
    profitFactor: 1.5,
    totalRealizedPnL: 5000,
    totalCharges: 500,
    netPnL: 4500,
    tradingDays: 30,
    avgTradesPerDay: 1.67,
    bestTrade: { symbol: 'RELIANCE', pnl: 2000 },
    worstTrade: { symbol: 'INFY', pnl: -1000 },
    longestHolding: null,
    mostTradedSymbol: 'RELIANCE',
    sharpeRatio: 1.2,
    maxDrawdown: {
      value: -10,
      peakDate: '2024-01-01',
      troughDate: '2024-02-01',
      status: 'computed',
      mode: 'percentage',
    },
    minDrawup: {
      value: 5,
      peakDate: '2024-01-15',
      troughDate: '2024-01-20',
      status: 'computed',
      mode: 'percentage',
    },
    streaks: {
      longestWinStreak: 5,
      longestLossStreak: 3,
      currentStreak: { type: 'win', count: 2 },
    },
    monthlyBreakdown: [],
    fifoMatches: [],
    expectancy: {
      overall: {
        expectancy: 100,
        avgWin: 500,
        avgLoss: -300,
        winCount: 27,
        lossCount: 23,
        winRate: 0.55,
      },
      intraday: {
        expectancy: 120,
        avgWin: 400,
        avgLoss: -200,
        winCount: 15,
        lossCount: 10,
        winRate: 0.6,
      },
      swing: {
        expectancy: 80,
        avgWin: 600,
        avgLoss: -400,
        winCount: 12,
        lossCount: 13,
        winRate: 0.48,
      },
    },
    riskReward: {
      overall: {
        ratio: 1.67,
        avgWin: 500,
        avgLoss: -300,
        winCount: 27,
        lossCount: 23,
      },
      intraday: {
        ratio: 2.0,
        avgWin: 400,
        avgLoss: -200,
        winCount: 15,
        lossCount: 10,
      },
      swing: {
        ratio: 1.5,
        avgWin: 600,
        avgLoss: -400,
        winCount: 12,
        lossCount: 13,
      },
    },
    rollingExpectancy: [],
    tradingStyles: {
      intraday: { count: 25, winRate: 60, avgPnL: 120, totalPnL: 3000 },
      btst: { count: 5, winRate: 40, avgPnL: 50, totalPnL: 250 },
      velocity: { count: 3, winRate: 33, avgPnL: 30, totalPnL: 90 },
      swing: { count: 17, winRate: 47, avgPnL: 80, totalPnL: 1360 },
      bestStyle: 'intraday',
      worstStyle: 'velocity',
    },
  }

  return { ...defaults, ...overrides }
}

describe('generateInsights', () => {
  it('returns empty array when totalTrades === 0', () => {
    const analytics = makeAnalytics({ totalTrades: 0 })
    expect(generateInsights(analytics)).toEqual([])
  })

  it('returns empty array for statistical rules when totalTrades < 5', () => {
    // With 2 trades and positive expectancy — rule 6 (positive expectancy) should NOT fire
    const analytics = makeAnalytics({
      totalTrades: 2,
      winningTrades: 1,
      losingTrades: 1,
      expectancy: {
        overall: { expectancy: 100, avgWin: 500, avgLoss: -300, winCount: 1, lossCount: 1, winRate: 0.5 },
        intraday: { expectancy: 120, avgWin: 400, avgLoss: -200, winCount: 1, lossCount: 0, winRate: 1.0 },
        swing: { expectancy: 80, avgWin: 600, avgLoss: -400, winCount: 0, lossCount: 1, winRate: 0 },
      },
    })
    const results = generateInsights(analytics)
    // None of rules 1-5 or 8 should fire (require >= 5 trades)
    expect(results.every(i => !['negative-expectancy', 'positive-expectancy', 'style-divergence', 'unfavorable-rr', 'win-rate-misleading'].includes(i.id))).toBe(true)
  })

  it('fires negative expectancy rule when expectancy < 0 and totalTrades >= 5', () => {
    const analytics = makeAnalytics({
      expectancy: {
        ...makeAnalytics().expectancy,
        overall: { expectancy: -50, avgWin: 200, avgLoss: -400, winCount: 20, lossCount: 30, winRate: 0.4 },
      },
    })
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'negative-expectancy')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('critical')
    expect(rule!.priority).toBe(95)
    expect(rule!.description).toContain('-50.00')
  })

  it('fires positive expectancy rule when expectancy > 0 and totalTrades >= 5', () => {
    const analytics = makeAnalytics() // defaults have expectancy 100
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'positive-expectancy')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('positive')
    expect(rule!.priority).toBe(50)
    expect(rule!.description).toContain('100.00')
  })

  it('fires style divergence rule when intraday profitable but swing losing', () => {
    const analytics = makeAnalytics({
      expectancy: {
        overall: { expectancy: 20, avgWin: 400, avgLoss: -350, winCount: 27, lossCount: 23, winRate: 0.54 },
        intraday: { expectancy: 150, avgWin: 400, avgLoss: -200, winCount: 15, lossCount: 5, winRate: 0.75 },
        swing: { expectancy: -80, avgWin: 300, avgLoss: -500, winCount: 5, lossCount: 10, winRate: 0.33 },
      },
    })
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'style-divergence')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('warning')
    expect(rule!.priority).toBe(80)
    expect(rule!.description).toContain('intraday')
    expect(rule!.description).toContain('swing')
  })

  it('fires loss streak rule when current streak type is loss and count > 3', () => {
    const analytics = makeAnalytics({
      streaks: {
        longestWinStreak: 5,
        longestLossStreak: 6,
        currentStreak: { type: 'loss', count: 5 },
      },
    })
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'loss-streak')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('warning')
    expect(rule!.priority).toBe(75)
    expect(rule!.description).toContain('5')
  })

  it('does NOT fire loss streak rule when streak count is exactly 3', () => {
    const analytics = makeAnalytics({
      streaks: {
        longestWinStreak: 5,
        longestLossStreak: 3,
        currentStreak: { type: 'loss', count: 3 },
      },
    })
    const results = generateInsights(analytics)
    expect(results.find(i => i.id === 'loss-streak')).toBeUndefined()
  })

  it('fires max drawdown rule when percentage mode and value < -20', () => {
    const analytics = makeAnalytics({
      maxDrawdown: {
        value: -35,
        peakDate: '2024-01-01',
        troughDate: '2024-03-01',
        status: 'computed',
        mode: 'percentage',
      },
    })
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'high-drawdown')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('warning')
    expect(rule!.priority).toBe(70)
    expect(rule!.description).toContain('-35.00')
  })

  it('does NOT fire max drawdown rule when mode is absolute', () => {
    const analytics = makeAnalytics({
      maxDrawdown: {
        value: -50000,
        peakDate: '2024-01-01',
        troughDate: '2024-03-01',
        status: 'computed',
        mode: 'absolute',
      },
    })
    const results = generateInsights(analytics)
    expect(results.find(i => i.id === 'high-drawdown')).toBeUndefined()
  })

  it('fires risk-reward rule when ratio < 1 and > 0 and totalTrades >= 5', () => {
    const analytics = makeAnalytics({
      riskReward: {
        ...makeAnalytics().riskReward,
        overall: { ratio: 0.6, avgWin: 300, avgLoss: -500, winCount: 27, lossCount: 23 },
      },
    })
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'unfavorable-rr')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('warning')
    expect(rule!.priority).toBe(65)
    expect(rule!.description).toContain('0.60')
  })

  it('fires best style recommendation when bestStyle is not null', () => {
    const analytics = makeAnalytics() // defaults have bestStyle: 'intraday'
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'best-style')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('info')
    expect(rule!.priority).toBe(40)
    expect(rule!.title).toContain('intraday')
  })

  it('fires win rate misleading rule when high win rate and negative expectancy', () => {
    const analytics = makeAnalytics({
      winRate: 65,
      expectancy: {
        ...makeAnalytics().expectancy,
        overall: { expectancy: -30, avgWin: 100, avgLoss: -300, winCount: 32, lossCount: 18, winRate: 0.65 },
      },
    })
    const results = generateInsights(analytics)
    const rule = results.find(i => i.id === 'win-rate-misleading')
    expect(rule).toBeDefined()
    expect(rule!.severity).toBe('info')
    expect(rule!.priority).toBe(30)
    expect(rule!.description).toContain('65.0%')
  })

  it('returns results sorted by priority descending', () => {
    // Trigger multiple rules: negative expectancy (95), high drawdown (70), best style (40)
    const analytics = makeAnalytics({
      expectancy: {
        ...makeAnalytics().expectancy,
        overall: { expectancy: -50, avgWin: 200, avgLoss: -400, winCount: 20, lossCount: 30, winRate: 0.4 },
      },
      maxDrawdown: {
        value: -30,
        peakDate: '2024-01-01',
        troughDate: '2024-03-01',
        status: 'computed',
        mode: 'percentage',
      },
    })
    const results = generateInsights(analytics)
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].priority).toBeGreaterThanOrEqual(results[i].priority)
    }
  })

  it('allows multiple rules to fire simultaneously', () => {
    const analytics = makeAnalytics({
      expectancy: {
        ...makeAnalytics().expectancy,
        overall: { expectancy: -50, avgWin: 200, avgLoss: -400, winCount: 20, lossCount: 30, winRate: 0.4 },
      },
      maxDrawdown: {
        value: -25,
        peakDate: '2024-01-01',
        troughDate: '2024-03-01',
        status: 'computed',
        mode: 'percentage',
      },
      streaks: {
        longestWinStreak: 5,
        longestLossStreak: 6,
        currentStreak: { type: 'loss', count: 4 },
      },
      riskReward: {
        ...makeAnalytics().riskReward,
        overall: { ratio: 0.5, avgWin: 200, avgLoss: -400, winCount: 20, lossCount: 30 },
      },
    })
    const results = generateInsights(analytics)
    expect(results.length).toBeGreaterThanOrEqual(4)
    expect(results.find(i => i.id === 'negative-expectancy')).toBeDefined()
    expect(results.find(i => i.id === 'high-drawdown')).toBeDefined()
    expect(results.find(i => i.id === 'loss-streak')).toBeDefined()
    expect(results.find(i => i.id === 'unfavorable-rr')).toBeDefined()
  })
})
