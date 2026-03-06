import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TradingStyleSection } from '@/components/dashboard/TradingStyleSection'
import type { TradingStyleResult, TradingStyleMetrics } from '@/lib/types'

function makeMetrics(overrides: Partial<TradingStyleMetrics> = {}): TradingStyleMetrics {
  return { count: 0, winRate: 0, avgPnL: 0, totalPnL: 0, ...overrides }
}

function makeResult(overrides: Partial<TradingStyleResult> = {}): TradingStyleResult {
  return {
    intraday: makeMetrics(),
    btst: makeMetrics(),
    velocity: makeMetrics(),
    swing: makeMetrics(),
    bestStyle: null,
    worstStyle: null,
    ...overrides,
  }
}

describe('TradingStyleSection', () => {
  it('renders all 4 style labels in empty state', () => {
    render(<TradingStyleSection tradingStyles={makeResult()} />)
    expect(screen.getByText(/No Intraday Trades/)).toBeDefined()
    expect(screen.getByText(/No BTST Trades/)).toBeDefined()
    expect(screen.getByText(/No Velocity Trades/)).toBeDefined()
    expect(screen.getByText(/No Swing Trades/)).toBeDefined()
  })

  it('shows holding period descriptions for empty categories', () => {
    render(<TradingStyleSection tradingStyles={makeResult()} />)
    expect(screen.getAllByText(/Holding:/).length).toBe(4)
  })

  it('displays trade count and win rate for populated styles', () => {
    render(
      <TradingStyleSection
        tradingStyles={makeResult({
          intraday: makeMetrics({ count: 15, winRate: 60, avgPnL: 250, totalPnL: 3750 }),
        })}
      />,
    )
    // Trade count in the new layout uses separate elements
    expect(screen.getByText('15')).toBeDefined()
    expect(screen.getByText('60.0%')).toBeDefined()
  })

  it('shows Best badge on best style', () => {
    render(
      <TradingStyleSection
        tradingStyles={makeResult({
          intraday: makeMetrics({ count: 5, winRate: 80, avgPnL: 300, totalPnL: 1500 }),
          swing: makeMetrics({ count: 5, winRate: 40, avgPnL: -100, totalPnL: -500 }),
          bestStyle: 'Intraday',
          worstStyle: 'Swing',
        })}
      />,
    )
    expect(screen.getByText('Best')).toBeDefined()
    expect(screen.getByText('Worst')).toBeDefined()
  })

  it('shows threshold message when no best/worst', () => {
    render(<TradingStyleSection tradingStyles={makeResult()} />)
    expect(
      screen.getByText('Need at least 3 trades in 2+ styles for best/worst recommendation'),
    ).toBeDefined()
  })

  it('hides threshold message when best/worst exist', () => {
    render(
      <TradingStyleSection
        tradingStyles={makeResult({
          bestStyle: 'Intraday',
          worstStyle: 'Swing',
        })}
      />,
    )
    expect(
      screen.queryByText('Need at least 3 trades in 2+ styles for best/worst recommendation'),
    ).toBeNull()
  })
})
