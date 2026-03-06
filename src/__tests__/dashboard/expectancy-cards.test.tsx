import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ExpectancyCards } from '@/components/dashboard/ExpectancyCards'
import type { ExpectancyMetric, RiskRewardMetric } from '@/lib/types'

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makeExpectancyBreakdown(overrides: Partial<ExpectancyMetric['overall']> = {}): ExpectancyMetric['overall'] {
  return {
    expectancy: 150,
    avgWin: 500,
    avgLoss: -200,
    winCount: 10,
    lossCount: 5,
    winRate: 0.667,
    ...overrides,
  }
}

function makeExpectancyMetric(overrides: Partial<ExpectancyMetric> = {}): ExpectancyMetric {
  return {
    overall: makeExpectancyBreakdown(),
    intraday: makeExpectancyBreakdown({ expectancy: 80, winCount: 4, lossCount: 2, winRate: 0.667 }),
    swing: makeExpectancyBreakdown({ expectancy: 220, winCount: 6, lossCount: 3, winRate: 0.667 }),
    ...overrides,
  }
}

function makeRiskRewardBreakdown(overrides: Partial<RiskRewardMetric['overall']> = {}): RiskRewardMetric['overall'] {
  return {
    ratio: 2.5,
    avgWin: 500,
    avgLoss: -200,
    winCount: 10,
    lossCount: 5,
    ...overrides,
  }
}

function makeRiskRewardMetric(overrides: Partial<RiskRewardMetric> = {}): RiskRewardMetric {
  return {
    overall: makeRiskRewardBreakdown(),
    intraday: makeRiskRewardBreakdown({ ratio: 1.5, winCount: 4, lossCount: 2 }),
    swing: makeRiskRewardBreakdown({ ratio: 0.8, winCount: 6, lossCount: 3 }),
    ...overrides,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExpectancyCards', () => {
  it('renders without crashing', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric()}
      />
    )
    expect(screen.getByText('Expectancy')).toBeInTheDocument()
    expect(screen.getByText('Risk-Reward Ratio')).toBeInTheDocument()
  })

  it('renders section headings for overall, intraday, swing', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric()}
      />
    )
    // Each section (expectancy + risk-reward) has 3 breakdowns
    const overallLabels = screen.getAllByText('Overall')
    const intradayLabels = screen.getAllByText('Intraday')
    const swingLabels = screen.getAllByText('Swing')
    expect(overallLabels).toHaveLength(2)
    expect(intradayLabels).toHaveLength(2)
    expect(swingLabels).toHaveLength(2)
  })

  it('shows positive expectancy with green color class', () => {
    const { container } = render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric()}
      />
    )
    // positive expectancy → text-green-600 class on the value
    const greenValues = container.querySelectorAll('.text-green-600')
    expect(greenValues.length).toBeGreaterThan(0)
  })

  it('shows negative expectancy with red color class', () => {
    const negExpectancy = makeExpectancyMetric({
      overall: makeExpectancyBreakdown({ expectancy: -120, winCount: 2, lossCount: 8, winRate: 0.2 }),
    })
    const { container } = render(
      <ExpectancyCards
        expectancy={negExpectancy}
        riskReward={makeRiskRewardMetric()}
      />
    )
    const redValues = container.querySelectorAll('.text-red-600')
    expect(redValues.length).toBeGreaterThan(0)
  })

  it('shows "No trades" when a breakdown has zero matches', () => {
    const emptyBreakdown = makeExpectancyBreakdown({ winCount: 0, lossCount: 0, expectancy: 0, winRate: 0, avgWin: 0, avgLoss: 0 })
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric({ intraday: emptyBreakdown })}
        riskReward={makeRiskRewardMetric()}
      />
    )
    expect(screen.getByText('No trades')).toBeInTheDocument()
  })

  it('shows "Good" label for R:R >= 2:1', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric({ overall: makeRiskRewardBreakdown({ ratio: 2.5 }) })}
      />
    )
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  it('shows "Acceptable" label for R:R between 1 and 2', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric({ overall: makeRiskRewardBreakdown({ ratio: 1.5 }) })}
      />
    )
    const labels = screen.getAllByText('Acceptable')
    expect(labels.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Poor" label for R:R < 1:1', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric({
          overall: makeRiskRewardBreakdown({ ratio: 0.7 }),
          intraday: makeRiskRewardBreakdown({ ratio: 2.0 }),
          swing: makeRiskRewardBreakdown({ ratio: 2.0 }),
        })}
      />
    )
    expect(screen.getByText('Poor')).toBeInTheDocument()
  })

  it('shows "No losses" when lossCount is 0', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric({
          overall: makeRiskRewardBreakdown({ ratio: 0, lossCount: 0 }),
        })}
      />
    )
    expect(screen.getByText('No losses')).toBeInTheDocument()
  })

  it('formats ratio as X.XX:1', () => {
    render(
      <ExpectancyCards
        expectancy={makeExpectancyMetric()}
        riskReward={makeRiskRewardMetric({ overall: makeRiskRewardBreakdown({ ratio: 2.5 }) })}
      />
    )
    expect(screen.getByText('2.50:1')).toBeInTheDocument()
  })
})
