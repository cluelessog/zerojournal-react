import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { WorkerRequest, WorkerResponse } from '@/lib/types'

// ─── Hoisted mocks (vi.mock factories are hoisted above imports) ─────────────

const { mockTradebookResult, mockPnlResult } = vi.hoisted(() => ({
  mockTradebookResult: {
    trades: [{ symbol: 'RELIANCE', tradeType: 'buy', quantity: 10, price: 2500 }],
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

vi.mock('@/lib/parser/tradebook-parser', () => ({
  parseTradeBookFile: vi.fn().mockResolvedValue(mockTradebookResult),
}))

vi.mock('@/lib/parser/pnl-parser', () => ({
  parsePnLFile: vi.fn().mockResolvedValue(mockPnlResult),
}))

// ─── Simulate worker message handler ─────────────────────────────────────────

import { parseTradeBookFile } from '@/lib/parser/tradebook-parser'
import { parsePnLFile } from '@/lib/parser/pnl-parser'

/**
 * Simulates what parser-worker.ts does on receiving a message.
 * This allows testing the worker logic without a real Worker environment.
 */
async function simulateWorkerHandler(msg: WorkerRequest): Promise<WorkerResponse> {
  if (msg.type !== 'parse') {
    return { type: 'error', error: `Unknown message type: ${String((msg as Record<string, unknown>).type)}` }
  }

  try {
    const [tradebook, pnl] = await Promise.all([
      parseTradeBookFile(msg.tradebookFile),
      parsePnLFile(msg.pnlFile),
    ])
    return { type: 'complete', result: { tradebook, pnl } }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown worker error'
    return { type: 'error', error: message }
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parser-worker — message handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns complete response on successful parse', async () => {
    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    const response = await simulateWorkerHandler({ type: 'parse', tradebookFile, pnlFile })

    expect(response.type).toBe('complete')
    if (response.type === 'complete') {
      expect(response.result.tradebook).toEqual(mockTradebookResult)
      expect(response.result.pnl).toEqual(mockPnlResult)
    }
  })

  it('calls parseTradeBookFile and parsePnLFile with correct files', async () => {
    const tradebookFile = new File(['tb-data'], 'tradebook.xlsx')
    const pnlFile = new File(['pnl-data'], 'pnl.xlsx')

    await simulateWorkerHandler({ type: 'parse', tradebookFile, pnlFile })

    expect(parseTradeBookFile).toHaveBeenCalledWith(tradebookFile)
    expect(parsePnLFile).toHaveBeenCalledWith(pnlFile)
  })

  it('returns error response when parseTradeBookFile throws', async () => {
    vi.mocked(parseTradeBookFile).mockRejectedValueOnce(new Error('Corrupt tradebook file'))

    const tradebookFile = new File([''], 'bad.xlsx')
    const pnlFile = new File([''], 'pnl.xlsx')

    const response = await simulateWorkerHandler({ type: 'parse', tradebookFile, pnlFile })

    expect(response.type).toBe('error')
    if (response.type === 'error') {
      expect(response.error).toBe('Corrupt tradebook file')
    }
  })

  it('returns error response when parsePnLFile throws', async () => {
    vi.mocked(parsePnLFile).mockRejectedValueOnce(new Error('Invalid PnL format'))

    const tradebookFile = new File([''], 'tradebook.xlsx')
    const pnlFile = new File([''], 'bad-pnl.xlsx')

    const response = await simulateWorkerHandler({ type: 'parse', tradebookFile, pnlFile })

    expect(response.type).toBe('error')
    if (response.type === 'error') {
      expect(response.error).toBe('Invalid PnL format')
    }
  })

  it('returns error response for unknown message type', async () => {
    const badMsg = { type: 'unknown' } as unknown as WorkerRequest

    const response = await simulateWorkerHandler(badMsg)

    expect(response.type).toBe('error')
    if (response.type === 'error') {
      expect(response.error).toContain('Unknown message type')
    }
  })
})
