import { useEffect, useState } from 'react'
import { useJournalStore } from '@/lib/store/journal-store'
import { JournalEditor } from '@/components/journal/JournalEditor'
import { JournalList } from '@/components/journal/JournalList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export default function JournalPage() {
  const loadEntries = useJournalStore((s) => s.loadEntries)
  const entries = useJournalStore((s) => s.entries)
  const isLoading = useJournalStore((s) => s.isLoading)
  const error = useJournalStore((s) => s.error)

  const [showEditor, setShowEditor] = useState(false)
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  const filteredEntries = dateFilter
    ? entries.filter((e) => e.tradeDate === dateFilter)
    : entries

  return (
    <div className="p-6 flex flex-col gap-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Trade Journal</h1>
        {!showEditor && (
          <Button size="sm" onClick={() => setShowEditor(true)}>
            + Add Entry
          </Button>
        )}
      </div>

      {/* Inline editor for new entry */}
      {showEditor && (
        <JournalEditor
          defaultDate={dateFilter || undefined}
          onSaved={() => setShowEditor(false)}
          onCancel={() => setShowEditor(false)}
        />
      )}

      {/* Date filter */}
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1 flex-1 max-w-xs">
          <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
            Filter by date
          </label>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="text-sm"
          />
        </div>
        {dateFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-5 text-xs"
            onClick={() => setDateFilter('')}
          >
            Clear filter
          </Button>
        )}
      </div>

      {/* Entry count */}
      {!isLoading && (
        <p className="text-xs text-gray-400 dark:text-gray-500 -mt-3">
          {filteredEntries.length === 0
            ? 'No entries'
            : `${filteredEntries.length} ${filteredEntries.length === 1 ? 'entry' : 'entries'}`}
          {dateFilter ? ` for ${dateFilter}` : ' total'}
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
        <JournalList entries={filteredEntries} />
      )}
    </div>
  )
}
