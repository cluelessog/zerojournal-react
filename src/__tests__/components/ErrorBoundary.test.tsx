import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// A component that throws on render
function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test error from component')
  }
  return <div data-testid="working">Working</div>
}

// Suppress console.error noise from expected errors in tests
const originalConsoleError = console.error

beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalConsoleError
})

describe('ErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </ErrorBoundary>
    )
    expect(screen.getByTestId('working')).toBeInTheDocument()
  })

  it('renders fallback UI when child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
    expect(
      screen.getByText('An unexpected error occurred. Please try refreshing the page.')
    ).toBeInTheDocument()
  })

  it('shows Refresh Page button in fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument()
  })

  it('shows Reset Data button in fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(screen.getByRole('button', { name: 'Reset Data' })).toBeInTheDocument()
  })

  it('logs error to console when error is caught', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    expect(console.error).toHaveBeenCalled()
    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls
    const hasErrorLog = calls.some((args) =>
      String(args[0]).includes('[ErrorBoundary]')
    )
    expect(hasErrorLog).toBe(true)
  })

  it('Reset Data button is clickable and does not throw', () => {
    // jsdom does not support window.location.href reassignment; we just verify
    // the button is present and clicking it does not throw an exception.
    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )
    const resetBtn = screen.getByRole('button', { name: 'Reset Data' })
    expect(resetBtn).toBeInTheDocument()
    // Clicking should not throw even though location.href cannot be set in jsdom
    expect(() => fireEvent.click(resetBtn)).not.toThrow()
  })

  it('Refresh Page button calls window.location.reload', () => {
    const reloadMock = vi.fn()
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock },
    })

    render(
      <ErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ErrorBoundary>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Refresh Page' }))
    expect(reloadMock).toHaveBeenCalledOnce()
  })
})

describe('ChartErrorBoundary', () => {
  it('renders children when no error occurs', async () => {
    const { ChartErrorBoundary } = await import('@/components/dashboard/ChartErrorBoundary')
    render(
      <ChartErrorBoundary chartName="TestChart">
        <div data-testid="chart">Chart content</div>
      </ChartErrorBoundary>
    )
    expect(screen.getByTestId('chart')).toBeInTheDocument()
  })

  it('renders fallback when child throws', async () => {
    const { ChartErrorBoundary } = await import('@/components/dashboard/ChartErrorBoundary')
    render(
      <ChartErrorBoundary chartName="TestChart">
        <ThrowingComponent shouldThrow={true} />
      </ChartErrorBoundary>
    )
    expect(screen.getByText('Chart failed to load')).toBeInTheDocument()
  })

  it('logs chart name in error message', async () => {
    const { ChartErrorBoundary } = await import('@/components/dashboard/ChartErrorBoundary')
    render(
      <ChartErrorBoundary chartName="PnLTimeline">
        <ThrowingComponent shouldThrow={true} />
      </ChartErrorBoundary>
    )
    expect(console.error).toHaveBeenCalled()
    const calls = (console.error as ReturnType<typeof vi.fn>).mock.calls
    const hasChartLog = calls.some((args) =>
      String(args[0]).includes('ChartErrorBoundary') && String(args[0]).includes('PnLTimeline')
    )
    expect(hasChartLog).toBe(true)
  })

  it('fallback has accessible role status', async () => {
    const { ChartErrorBoundary } = await import('@/components/dashboard/ChartErrorBoundary')
    render(
      <ChartErrorBoundary>
        <ThrowingComponent shouldThrow={true} />
      </ChartErrorBoundary>
    )
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
