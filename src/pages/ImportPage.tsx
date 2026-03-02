import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { DualFileUploader } from '@/components/import/FileUploader'
import { ImportPreview } from '@/components/import/ImportPreview'
import { ImportValidation } from '@/components/import/ImportValidation'
import { useParseWorker } from '@/lib/parser/use-parse-worker'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import type { ParseTradebookResult, ParsePnLResult, ParseWarning, ParseError } from '@/lib/types'

type ImportState = 'idle' | 'parsing' | 'previewing' | 'importing' | 'complete'

export default function ImportPage() {
  const navigate = useNavigate()
  const { importData } = usePortfolioStore()
  const { startParse } = useParseWorker()

  const [state, setState] = useState<ImportState>('idle')
  const [progressText, setProgressText] = useState('')

  const [tradebookFile, setTradebookFile] = useState<File | null>(null)
  const [pnlFile, setPnlFile] = useState<File | null>(null)
  const [tradebookError, setTradebookError] = useState<string | null>(null)
  const [pnlError, setPnlError] = useState<string | null>(null)

  const [tradebookResult, setTradebookResult] = useState<ParseTradebookResult | null>(null)
  const [pnlResult, setPnlResult] = useState<ParsePnLResult | null>(null)

  const [allWarnings, setAllWarnings] = useState<ParseWarning[]>([])
  const [allErrors, setAllErrors] = useState<ParseError[]>([])

  const handleFileSelected = useCallback((file: File, type: 'tradebook' | 'pnl') => {
    // Reset parse results when files change
    setTradebookResult(null)
    setPnlResult(null)
    setAllWarnings([])
    setAllErrors([])
    setState('idle')

    if (type === 'tradebook') {
      setTradebookFile(file)
      setTradebookError(null)
    } else {
      setPnlFile(file)
      setPnlError(null)
    }
  }, [])

  const handleParse = useCallback(async () => {
    if (!tradebookFile || !pnlFile) return

    setState('parsing')
    setProgressText('Parsing files...')

    const t0 = performance.now()

    try {
      const parseResult = await startParse(tradebookFile, pnlFile)

      const elapsed = Math.round(performance.now() - t0)
      console.log(`Parse complete: ${elapsed}ms`)

      if (!parseResult) {
        setAllErrors([{ code: 'PARSE_FAILED', message: 'Parsing returned no result' }])
        setState('previewing')
        return
      }

      const { tradebook, pnl } = parseResult

      setProgressText(`${tradebook.trades.length} trades found`)

      setTradebookResult(tradebook)
      setPnlResult(pnl)
      setAllWarnings([...tradebook.warnings, ...pnl.warnings])
      setAllErrors([...tradebook.errors, ...pnl.errors])

      setState('previewing')
    } catch (err) {
      const elapsed = Math.round(performance.now() - t0)
      console.log(`Parse failed: ${elapsed}ms`)
      const message = err instanceof Error ? err.message : 'Unexpected error during parsing'
      setAllErrors([{ code: 'PARSE_FAILED', message }])
      setState('previewing')
    }
  }, [tradebookFile, pnlFile, startParse])

  const handleConfirm = useCallback(async () => {
    if (!tradebookResult || !pnlResult) return

    setState('importing')
    setProgressText('Saving to local storage...')

    try {
      await importData(tradebookResult, pnlResult)
      setState('complete')
      navigate('/')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save data'
      setAllErrors((prev) => [...prev, { code: 'IMPORT_FAILED', message }])
      setState('previewing')
    }
  }, [tradebookResult, pnlResult, importData, navigate])

  const handleCancel = useCallback(() => {
    setTradebookResult(null)
    setPnlResult(null)
    setAllWarnings([])
    setAllErrors([])
    setState('idle')
  }, [])

  const isParsing = state === 'parsing'
  const canParse = tradebookFile !== null && pnlFile !== null && state === 'idle'
  const hasErrors = allErrors.length > 0

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Import Data</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Upload your Zerodha tradebook and P&amp;L files to get started. Files are processed
          entirely in your browser — nothing is uploaded to any server.
        </p>
      </div>

      {/* Step 1: File upload */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
          Step 1 — Select files
        </h2>
        <DualFileUploader
          tradebookFile={tradebookFile}
          pnlFile={pnlFile}
          tradebookError={tradebookError}
          pnlError={pnlError}
          onFileSelected={handleFileSelected}
        />
      </section>

      {/* Parse button / spinner */}
      {(state === 'idle' || state === 'parsing') && (
        <div className="flex items-center gap-4">
          <button
            onClick={handleParse}
            disabled={!canParse || isParsing}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isParsing ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white dark:border-gray-900 border-t-transparent rounded-full animate-spin" />
                Parsing...
              </>
            ) : (
              'Parse Files'
            )}
          </button>
          {state === 'parsing' && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{progressText}</span>
          )}
          {!tradebookFile && (
            <span className="text-xs text-gray-400">Select tradebook file to continue</span>
          )}
          {tradebookFile && !pnlFile && (
            <span className="text-xs text-gray-400">Select P&amp;L file to continue</span>
          )}
        </div>
      )}

      {/* Importing spinner */}
      {state === 'importing' && (
        <div className="flex items-center gap-3">
          <span className="inline-block w-5 h-5 border-2 border-gray-900 dark:border-gray-100 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-600 dark:text-gray-300">{progressText}</span>
        </div>
      )}

      {/* Step 2: Validation + Preview */}
      {(state === 'previewing' || state === 'importing') && tradebookResult && pnlResult && (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Step 2 — Review &amp; confirm
          </h2>

          <ImportValidation warnings={allWarnings} errors={allErrors} />

          <ImportPreview
            tradebookResult={tradebookResult}
            pnlResult={pnlResult}
            hasErrors={hasErrors}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        </section>
      )}
    </div>
  )
}
