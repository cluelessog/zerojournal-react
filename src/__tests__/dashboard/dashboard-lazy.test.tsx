import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Suspense } from 'react'

// Mock recharts to avoid canvas/resize-observer issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  AreaChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  BarChart: ({ children }: { children: React.ReactNode }) => <svg>{children}</svg>,
  Area: () => null,
  Bar: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ReferenceLine: () => null,
}))

// Mock store to avoid portfolio store dependency
vi.mock('@/lib/store/portfolio-store', () => ({
  usePortfolioStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      analytics: null,
      trades: [],
      symbolPnL: [],
      pnlSummary: null,
      isLoaded: false,
    }),
}))

// Mock router
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

import { ChartSkeleton } from '@/components/dashboard/ChartSkeleton'

describe('ChartSkeleton', () => {
  it('renders with default height', () => {
    render(<ChartSkeleton />)
    const el = screen.getByRole('status')
    expect(el).toBeInTheDocument()
    expect(el).toHaveAttribute('aria-label', 'Loading chart...')
  })

  it('renders with custom height', () => {
    render(<ChartSkeleton height={350} />)
    const el = screen.getByRole('status')
    // height prop is used in inline style: 350 + 80 = 430
    expect(el).toHaveStyle({ height: '430px' })
  })

  it('has animate-pulse class for visual feedback', () => {
    render(<ChartSkeleton height={300} />)
    const el = screen.getByRole('status')
    expect(el.className).toContain('animate-pulse')
  })
})

describe('Suspense fallback with ChartSkeleton', () => {
  it('shows skeleton while lazy component is loading', async () => {
    // Create a component that never resolves to simulate pending state
    let resolvePromise!: () => void
    const neverResolvingPromise = new Promise<{ default: () => null }>((resolve) => {
      resolvePromise = () => resolve({ default: () => null })
    })

    const { lazy } = await import('react')
    const NeverLoads = lazy(() => neverResolvingPromise)

    render(
      <Suspense fallback={<ChartSkeleton height={300} />}>
        <NeverLoads />
      </Suspense>
    )

    // Skeleton should be visible while the component hasn't loaded
    expect(screen.getByRole('status')).toBeInTheDocument()

    // Cleanup: resolve promise to avoid open handles
    resolvePromise()
  })

  it('shows lazy component after it loads', async () => {
    const { lazy } = await import('react')
    const EagerComponent = lazy(() =>
      Promise.resolve({ default: () => <div data-testid="loaded-chart">Chart Loaded</div> })
    )

    render(
      <Suspense fallback={<ChartSkeleton height={300} />}>
        <EagerComponent />
      </Suspense>
    )

    // Wait for the lazy component to load
    await waitFor(() => {
      expect(screen.getByTestId('loaded-chart')).toBeInTheDocument()
    })

    // Skeleton should no longer be present
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('DashboardPage lazy imports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty state when no data is loaded', async () => {
    const { default: DashboardPage } = await import('@/pages/DashboardPage')
    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByText('No data yet')).toBeInTheDocument()
    })
  }, 15000)

  it('chart components are exported and lazy-importable', async () => {
    // Each chart module should be dynamically importable without error
    const [pnl, winloss, top, monthly, calendar] = await Promise.all([
      import('@/components/dashboard/PnLTimelineChart'),
      import('@/components/dashboard/WinLossDistribution'),
      import('@/components/dashboard/TopSymbolsChart'),
      import('@/components/dashboard/MonthlyVolumeChart'),
      import('@/components/dashboard/TradingCalendar'),
    ])

    expect(typeof pnl.PnLTimelineChart).toBe('function')
    expect(typeof winloss.WinLossDistribution).toBe('function')
    expect(typeof top.TopSymbolsChart).toBe('function')
    expect(typeof monthly.MonthlyVolumeChart).toBe('function')
    expect(typeof calendar.TradingCalendar).toBe('function')
  }, 15000)
})
