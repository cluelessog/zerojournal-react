import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { useJournalStore, exportJournalEntries, importJournalEntries } from '@/lib/store/journal-store'
import { buildTimeline } from '@/lib/engine/timeline'
import { JournalCalendar } from '@/components/journal/JournalCalendar'
import { DayDetailSheet } from '@/components/journal/DayDetailSheet'
import { JournalEntryEditor } from '@/components/journal/JournalEntryEditor'
import type { JournalEntry } from '@/lib/types'

type EditorState =
  | { mode: 'closed' }
  | { mode: 'create'; date: string; symbol?: string }
  | { mode: 'edit'; date: string; entry: JournalEntry }

export default function JournalPage() {
  const trades = usePortfolioStore((s) => s.trades)
  const orderGroups = usePortfolioStore((s) => s.orderGroups)
  const symbolPnL = usePortfolioStore((s) => s.symbolPnL)
  const pnlSummary = usePortfolioStore((s) => s.pnlSummary)
  const analytics = usePortfolioStore((s) => s.analytics)
  const fifoMatches = analytics?.fifoMatches ?? []

  // Same pattern as PnLBarCharts: buildTimeline with charges for authoritative P&L
  const totalCharges = pnlSummary?.charges.total ?? 0
  const timeline = useMemo(
    () => buildTimeline(trades, symbolPnL, 'daily', totalCharges),
    [trades, symbolPnL, totalCharges]
  )

  const loadEntries = useJournalStore((s) => s.loadEntries)
  const entries = useJournalStore((s) => s.entries)
  const deleteEntry = useJournalStore((s) => s.deleteEntry)
  const isLoading = useJournalStore((s) => s.isLoading)
  const error = useJournalStore((s) => s.error)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editor, setEditor] = useState<EditorState>({ mode: 'closed' })
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(() => {
    exportJournalEntries(entries)
  }, [entries])

  const handleImportFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    try {
      const { imported, skipped } = await importJournalEntries(file, entries)
      await loadEntries()
      setImportMsg(`Imported ${imported} entries${skipped > 0 ? `, ${skipped} skipped (already up to date)` : ''}.`)
    } catch {
      setImportMsg('Import failed — make sure the file is a valid zerojournal export.')
    }
    setTimeout(() => setImportMsg(null), 5000)
  }, [entries, loadEntries])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const handleDayClick = useCallback((date: string) => {
    setSelectedDate(date)
    setEditor({ mode: 'closed' })
    setSheetOpen(true)
  }, [])

  const handleAddEntry = useCallback(
    (symbol?: string) => {
      if (!selectedDate) return
      setEditor({ mode: 'create', date: selectedDate, symbol })
    },
    [selectedDate]
  )

  const handleEditEntry = useCallback((entry: JournalEntry) => {
    setEditor({ mode: 'edit', date: entry.tradeDate, entry })
  }, [])

  const handleDeleteEntry = useCallback(
    async (id: string) => {
      await deleteEntry(id)
    },
    [deleteEntry]
  )

  const handleEditorSave = useCallback(() => {
    setEditor({ mode: 'closed' })
  }, [])

  const handleEditorCancel = useCallback(() => {
    setEditor({ mode: 'closed' })
  }, [])

  const handleSheetOpenChange = useCallback((open: boolean) => {
    setSheetOpen(open)
    if (!open) {
      setEditor({ mode: 'closed' })
      setSelectedDate(null)
    }
  }, [])

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-5 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
            Trade Journal
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Click any day to view trades and add journal entries
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={handleImportFile}
          />
          <button
            onClick={() => importInputRef.current?.click()}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Import
          </button>
          <button
            onClick={handleExport}
            disabled={entries.length === 0}
            className="text-xs px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Export
          </button>
        </div>
      </div>

      {/* Import result message */}
      {importMsg && (
        <p className="text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-md">
          {importMsg}
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md">
          {error}
        </p>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-gray-400 dark:text-gray-500 text-sm">
          Loading entries…
        </div>
      ) : (
        <JournalCalendar
          trades={trades}
          orderGroups={orderGroups}
          timeline={timeline}
          journalEntries={entries}
          onDayClick={handleDayClick}
        />
      )}

      {/* Day Detail Sheet */}
      <DayDetailSheet
        date={selectedDate}
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        fifoMatches={fifoMatches}
        orderGroups={orderGroups}
        journalEntries={entries}
        onAddEntry={handleAddEntry}
        onEditEntry={handleEditEntry}
        onDeleteEntry={handleDeleteEntry}
        editorSlot={
          editor.mode !== 'closed' && selectedDate ? (
            <JournalEntryEditor
              tradeDate={editor.mode === 'create' ? editor.date : editor.entry.tradeDate}
              entry={editor.mode === 'edit' ? editor.entry : undefined}
              prefilledSymbol={editor.mode === 'create' ? editor.symbol : undefined}
              onSave={handleEditorSave}
              onCancel={handleEditorCancel}
            />
          ) : undefined
        }
      />
    </div>
  )
}
