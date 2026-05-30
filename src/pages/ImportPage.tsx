import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DualFileUploader } from '@/components/import/FileUploader'
import { ImportPreview } from '@/components/import/ImportPreview'
import { ImportValidation } from '@/components/import/ImportValidation'
import { useParseWorker } from '@/lib/parser/use-parse-worker'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { getSyncStatus, connectDrive, onStatusChange, type SyncStatus } from '@/lib/sync/sync-service'
import type { ParseTradebookResult, ParsePnLResult, ParseWarning, ParseError } from '@/lib/types'

const HAS_DRIVE = !!import.meta.env.VITE_GOOGLE_CLIENT_ID

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}

type ImportState = 'idle' | 'parsing' | 'previewing' | 'importing' | 'complete'

export default function ImportPage() {
  const navigate = useNavigate()
  const { importData } = usePortfolioStore()
  const { startParse } = useParseWorker()

  const [state, setState] = useState<ImportState>('idle')
  const [progressText, setProgressText] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus)
  const [signingIn, setSigningIn] = useState(false)

  useEffect(() => onStatusChange(setSyncStatus), [])

  async function handleGoogleSignIn() {
    setSigningIn(true)
    try {
      await connectDrive()
    } finally {
      setSigningIn(false)
    }
  }

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

    try {
      const parseResult = await startParse(tradebookFile, pnlFile)

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
      await importData(tradebookResult, pnlResult, {
        tradebook: tradebookFile?.name,
        pnl: pnlFile?.name,
      })
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

      {/* Google sign-in banner */}
      {HAS_DRIVE && syncStatus === 'disconnected' && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sign in to enable auto-sync</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Your data will be backed up and synced across devices via Google Drive</p>
          </div>
          <button
            onClick={handleGoogleSignIn}
            disabled={signingIn}
            className="inline-flex items-center gap-2 shrink-0 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm transition-colors"
          >
            {signingIn ? (
              <span className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            {signingIn ? 'Signing in…' : 'Sign in with Google'}
          </button>
        </div>
      )}

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
