import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

// ─── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockTradebookResult, mockPnlResult } = vi.hoisted(() => ({
  mockTradebookResult: {
    trades: [{ symbol: 'INFY', tradeType: 'buy' as const, quantity: 5, price: 1500 }],
    warnings: [],
    errors: [],
    rowCount: 1,
    skippedRows: 0,
  },
  mockPnlResult: {
    symbolPnL: [],
    pnlSummary: {
      totalRealizedPnL: 0,
      totalUnrealizedPnL: 0,
      charges: {
        brokerage: 0,
        exchangeTxnCharges: 0,
        sebiTurnoverFee: 0,
        stampDuty: 0,
        stt: 0,
        gst: 0,
        dpCharges: 0,
        total: 0,
      },
      netPnL: 0,
    },
    dpCharges: [],
    warnings: [],
    errors: [],
  },
}))

vi.mock('@/lib/parser/parse-files', () => ({
  parseFiles: vi.fn().mockResolvedValue({
    tradebook: mockTradebookResult,
    pnl: mockPnlResult,
  }),
}))

import { useParseWorker } from '@/lib/parser/use-parse-worker'

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useParseWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // In jsdom, Worker is not available — this ensures the fallback path is exercised.
    vi.stubGlobal('Worker', undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('initialises with correct default state', () => {
    const { result } = renderHook(() => useParseWorker())

    expect(result.current.isParsing).toBe(false)
    expect(result.current.result).toBeNull()
    expect(result.current.error).toBeNull()
    expect(typeof result.current.startParse).toBe('function')
  })

  it('falls back to sync parsing when Worker is unavailable', async () => {
    const { result } = renderHook(() => useParseWorker())

    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    let parseResult: Awaited<ReturnType<typeof result.current.startParse>>

    await act(async () => {
      parseResult = await result.current.startParse(tradebookFile, pnlFile)
    })

    expect(parseResult!).not.toBeNull()
    expect(parseResult!.tradebook).toEqual(mockTradebookResult)
    expect(parseResult!.pnl).toEqual(mockPnlResult)
    expect(result.current.isParsing).toBe(false)
    expect(result.current.result).not.toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('sets result state after successful fallback parse', async () => {
    const { result } = renderHook(() => useParseWorker())

    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    await act(async () => {
      await result.current.startParse(tradebookFile, pnlFile)
    })

    expect(result.current.result).toEqual({
      tradebook: mockTradebookResult,
      pnl: mockPnlResult,
    })
  })

  it('sets error state when both worker and fallback fail', async () => {
    const { parseFiles } = await import('@/lib/parser/parse-files')
    vi.mocked(parseFiles).mockRejectedValueOnce(new Error('Sync parse exploded'))

    const { result } = renderHook(() => useParseWorker())

    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    await act(async () => {
      await result.current.startParse(tradebookFile, pnlFile)
    })

    expect(result.current.error).toBe('Sync parse exploded')
    expect(result.current.result).toBeNull()
    expect(result.current.isParsing).toBe(false)
  })

  it('returns null when both worker and fallback fail', async () => {
    const { parseFiles } = await import('@/lib/parser/parse-files')
    vi.mocked(parseFiles).mockRejectedValueOnce(new Error('Total failure'))

    const { result } = renderHook(() => useParseWorker())

    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    let parseResult: Awaited<ReturnType<typeof result.current.startParse>>

    await act(async () => {
      parseResult = await result.current.startParse(tradebookFile, pnlFile)
    })

    expect(parseResult!).toBeNull()
  })

  it('resets state between parse calls', async () => {
    const { result } = renderHook(() => useParseWorker())

    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    // First parse: success
    await act(async () => {
      await result.current.startParse(tradebookFile, pnlFile)
    })
    expect(result.current.result).not.toBeNull()
    expect(result.current.error).toBeNull()

    // Second parse: force failure
    const { parseFiles } = await import('@/lib/parser/parse-files')
    vi.mocked(parseFiles).mockRejectedValueOnce(new Error('Second call failed'))

    await act(async () => {
      await result.current.startParse(tradebookFile, pnlFile)
    })

    expect(result.current.error).toBe('Second call failed')
    // result should be reset to null on new parse attempt
    expect(result.current.result).toBeNull()
  })
})
