/**
 * Parse-files orchestrator — synchronous main-thread parsing (v1).
 *
 * For v1 the dataset (2,219 rows) parses in <500ms which does not cause
 * perceptible UI jank. Web Worker enhancement deferred to Step 6.
 */
import type { ParseTradebookResult, ParsePnLResult } from '@/lib/types'
import { parseTradeBookFile } from './tradebook-parser'
import { parsePnLFile } from './pnl-parser'

export async function parseFiles(
  tradebookFile: File,
  pnlFile: File,
): Promise<{ tradebook: ParseTradebookResult; pnl: ParsePnLResult }> {
  const [tradebook, pnl] = await Promise.all([
    parseTradeBookFile(tradebookFile),
    parsePnLFile(pnlFile),
  ])
  return { tradebook, pnl }
}
