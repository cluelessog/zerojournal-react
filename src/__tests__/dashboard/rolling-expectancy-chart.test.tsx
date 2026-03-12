import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RollingExpectancyChart } from '@/components/dashboard/RollingExpectancyChart'
import type { RollingExpectancyPoint } from '@/lib/types'

// ─── Test Fixtures ────────────────────────────────────────────────────────────

function makePoint(tradeNumber: number, overall: number, intraday = 0, swing = 0): RollingExpectancyPoint {
  return { tradeNumber, overall, intraday, swing }
}

/** Build a data array where overall expectancy goes from `start` to `end` linearly over `n` points */
function makeLinearData(start: number, end: number, n = 5): RollingExpectancyPoint[] {
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0 : i / (n - 1)
    return makePoint(i + 1, start + (end - start) * t)
  })
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RollingExpectancyChart', () => {
  it('renders empty state when data is empty', () => {
    render(<RollingExpectancyChart data={[]} />)
    expect(screen.getByText(/Need at least/)).toBeInTheDocument()
  })

  it('renders card title with window size', () => {
    render(<RollingExpectancyChart data={makeLinearData(100, 200)} window={20} />)
    expect(screen.getByText(/Rolling 20-Trade Expectancy/)).toBeInTheDocument()
  })

  // ─── Trend Badge Tests ────────────────────────────────────────────────────

  it('shows "Improving" trend badge when current > initial by more than Rs. 1', () => {
    const data = makeLinearData(100, 250) // initial=100, current=250
    render(<RollingExpectancyChart data={data} />)
    expect(screen.getByText('Improving')).toBeInTheDocument()
  })

  it('shows "Declining" trend badge when current < initial by more than Rs. 1', () => {
    const data = makeLinearData(250, 100) // initial=250, current=100
    render(<RollingExpectancyChart data={data} />)
    expect(screen.getByText('Declining')).toBeInTheDocument()
  })

  it('shows "Flat" trend badge when current ≈ initial (within Rs. 1)', () => {
    const data = makeLinearData(100, 100.5) // difference = 0.5, below threshold
    render(<RollingExpectancyChart data={data} />)
    expect(screen.getByText('Flat')).toBeInTheDocument()
  })

  it('applies green color class for improving trend', () => {
    const data = makeLinearData(100, 300)
    const { container } = render(<RollingExpectancyChart data={data} />)
    const badge = container.querySelector('[data-testid="trend-badge"]')
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toContain('text-green')
  })

  it('applies red color class for declining trend', () => {
    const data = makeLinearData(300, 100)
    const { container } = render(<RollingExpectancyChart data={data} />)
    const badge = container.querySelector('[data-testid="trend-badge"]')
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toContain('text-red')
  })

  it('applies muted color class for flat trend', () => {
    const data = makeLinearData(100, 100)
    const { container } = render(<RollingExpectancyChart data={data} />)
    const badge = container.querySelector('[data-testid="trend-badge"]')
    expect(badge).toBeInTheDocument()
    expect(badge?.className).toContain('text-muted')
  })

  // ─── Description Text ─────────────────────────────────────────────────────

  it('shows updated description text mentioning reference lines', () => {
    render(<RollingExpectancyChart data={makeLinearData(100, 200)} />)
    expect(screen.getByText(/initial and current/i)).toBeInTheDocument()
  })

  // ─── Edge Cases ───────────────────────────────────────────────────────────

  it('renders correctly with single data point', () => {
    const data = [makePoint(1, 150)]
    render(<RollingExpectancyChart data={data} />)
    // Single point: initial === current, so trend is flat
    expect(screen.getByText('Flat')).toBeInTheDocument()
  })

  it('handles negative expectancy values', () => {
    const data = makeLinearData(-200, -50) // negative but improving
    render(<RollingExpectancyChart data={data} />)
    expect(screen.getByText('Improving')).toBeInTheDocument()
  })

  it('handles transition from negative to positive', () => {
    const data = makeLinearData(-100, 200) // crossed zero, improving
    render(<RollingExpectancyChart data={data} />)
    expect(screen.getByText('Improving')).toBeInTheDocument()
  })
})
