/**
 * useParseWorker — React hook for off-main-thread file parsing.
 *
 * Lazily creates a Web Worker on first parse request. If the Worker fails to
 * initialise (e.g. in test environments or old browsers), falls back to
 * synchronous main-thread parsing via parseFiles().
 *
 * Returns { isParsing, result, error, startParse }.
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import type { ParseTradebookResult, ParsePnLResult, WorkerResponse } from '@/lib/types'
import { parseFiles } from './parse-files'

const PARSE_TIMEOUT_MS = 30_000

export interface ParseResult {
  tradebook: ParseTradebookResult
  pnl: ParsePnLResult
}

export function useParseWorker() {
  const [isParsing, setIsParsing] = useState(false)
  const [result, setResult] = useState<ParseResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const workerRef = useRef<Worker | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (workerRef.current) {
        workerRef.current.terminate()
        workerRef.current = null
      }
    }
  }, [])

  const fallbackParse = useCallback(
    async (tradebookFile: File, pnlFile: File): Promise<ParseResult> => {
      return parseFiles(tradebookFile, pnlFile)
    },
    [],
  )

  const startParse = useCallback(
    async (tradebookFile: File, pnlFile: File): Promise<ParseResult | null> => {
      setIsParsing(true)
      setResult(null)
      setError(null)

      // Try Web Worker first
      try {
        const workerResult = await new Promise<ParseResult>((resolve, reject) => {
          // Lazy-init worker
          if (!workerRef.current) {
            try {
              workerRef.current = new Worker(
                new URL('./parser-worker.ts', import.meta.url),
                { type: 'module' },
              )
            } catch {
              reject(new Error('Worker init failed'))
              return
            }
          }

          const worker = workerRef.current

          // Timeout guard
          timeoutRef.current = setTimeout(() => {
            worker.terminate()
            workerRef.current = null
            reject(new Error('Parse timed out after 30s'))
          }, PARSE_TIMEOUT_MS)

          worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)

            const msg = event.data
            if (msg.type === 'complete') {
              resolve(msg.result)
            } else {
              reject(new Error(msg.error))
            }
          }

          worker.onerror = (event) => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            worker.terminate()
            workerRef.current = null
            reject(new Error(event.message || 'Worker error'))
          }

          worker.postMessage({ type: 'parse', tradebookFile, pnlFile })
        })

        setResult(workerResult)
        setIsParsing(false)
        return workerResult
      } catch (workerErr) {
        // Fallback to synchronous parsing
        const reason = workerErr instanceof Error ? workerErr.message : 'Worker failed'
        console.warn(`Web Worker parse failed (${reason}), falling back to sync parsing`)

        try {
          const syncResult = await fallbackParse(tradebookFile, pnlFile)
          setResult(syncResult)
          setIsParsing(false)
          return syncResult
        } catch (syncErr) {
          const message = syncErr instanceof Error ? syncErr.message : 'Parse failed'
          setError(message)
          setIsParsing(false)
          return null
        }
      }
    },
    [fallbackParse],
  )

  return { isParsing, result, error, startParse }
}
