/**
 * Web Worker script for off-main-thread file parsing.
 *
 * Receives tradebook + PnL File objects, parses them in parallel via
 * parseTradeBookFile / parsePnLFile, and posts the result back.
 *
 * Communication protocol:
 *   Request:  { type: 'parse', tradebookFile: File, pnlFile: File }
 *   Response: { type: 'complete', result: { tradebook, pnl } }
 *           | { type: 'error', error: string }
 */

import { parseTradeBookFile } from './tradebook-parser'
import { parsePnLFile } from './pnl-parser'
import type { WorkerRequest, WorkerResponse } from '@/lib/types'

declare const self: DedicatedWorkerGlobalScope

self.addEventListener('message', async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data

  if (msg.type !== 'parse') {
    const response: WorkerResponse = {
      type: 'error',
      error: `Unknown message type: ${String((msg as Record<string, unknown>).type)}`,
    }
    self.postMessage(response)
    return
  }

  try {
    const [tradebook, pnl] = await Promise.all([
      parseTradeBookFile(msg.tradebookFile),
      parsePnLFile(msg.pnlFile),
    ])

    const response: WorkerResponse = {
      type: 'complete',
      result: { tradebook, pnl },
    }
    self.postMessage(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown worker error'
    const response: WorkerResponse = { type: 'error', error: message }
    self.postMessage(response)
  }
})
