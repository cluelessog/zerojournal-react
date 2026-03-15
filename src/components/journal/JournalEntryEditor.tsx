import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useJournalStore } from '@/lib/store/journal-store'
import type { JournalEntry } from '@/lib/types'

interface JournalEntryEditorProps {
  tradeDate: string           // YYYY-MM-DD — pre-set, not editable in sheet context
  entry?: JournalEntry        // if provided, edit mode (pre-fill fields)
  prefilledSymbol?: string    // if provided, pre-fill symbol from bubble click
  onSave: () => void          // called after successful save
  onCancel: () => void
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function JournalEntryEditor({
  tradeDate,
  entry,
  prefilledSymbol,
  onSave,
  onCancel,
}: JournalEntryEditorProps) {
  const addEntry = useJournalStore((s) => s.addEntry)
  const updateEntry = useJournalStore((s) => s.updateEntry)

  const isEdit = !!entry

  const [symbol, setSymbol] = useState('')
  const [setup, setSetup] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize fields when entry or prefilledSymbol changes
  useEffect(() => {
    if (isEdit && entry) {
      setSymbol(entry.symbol ?? '')
      setSetup(entry.setup ?? '')
      setNotes(entry.notes ?? entry.content ?? '')
    } else {
      setSymbol(prefilledSymbol ?? '')
      setSetup('')
      setNotes('')
    }
  }, [entry, prefilledSymbol, isEdit])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!notes.trim()) {
      setError('Notes are required.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      if (isEdit && entry) {
        await updateEntry(entry.id, {
          notes: notes.trim(),
          symbol: symbol.trim() || null,
          setup: setup.trim() || null,
        })
      } else {
        await addEntry({
          tradeDate,
          notes: notes.trim(),
          symbol: symbol.trim() || null,
          setup: setup.trim() || null,
        })
      }
      onSave()
    } catch {
      setError('Failed to save entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      {/* Date display — read-only */}
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Date</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
          {formatDate(tradeDate)}
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Symbol */}
        {prefilledSymbol ? (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Symbol</span>
            <div>
              <Badge
                variant="secondary"
                className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
              >
                {prefilledSymbol}
              </Badge>
            </div>
          </div>
        ) : !isEdit ? (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="jee-symbol"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Symbol <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <Input
              id="jee-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (optional)"
              className="text-sm uppercase"
            />
          </div>
        ) : (
          /* Edit mode, no prefilledSymbol: show existing symbol as editable input */
          <div className="flex flex-col gap-1">
            <label
              htmlFor="jee-symbol"
              className="text-xs font-medium text-gray-500 dark:text-gray-400"
            >
              Symbol <span className="text-gray-400 dark:text-gray-500">(optional)</span>
            </label>
            <Input
              id="jee-symbol"
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (optional)"
              className="text-sm uppercase"
            />
          </div>
        )}

        {/* Setup / Pattern */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="jee-setup"
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            Setup / Pattern
          </label>
          <Input
            id="jee-setup"
            type="text"
            value={setup}
            onChange={(e) => setSetup(e.target.value)}
            placeholder="e.g., Breakout above resistance"
            className="text-sm"
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label
            htmlFor="jee-notes"
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
          >
            Notes <span className="text-red-500">*</span>
          </label>
          <textarea
            id="jee-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What happened? What did you observe?"
            rows={3}
            className="w-full rounded-md border border-input bg-transparent dark:bg-input/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          />
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={saving || !notes.trim()}
          >
            {saving ? 'Saving…' : isEdit ? 'Update Entry' : 'Save Entry'}
          </Button>
        </div>
      </form>
    </div>
  )
}
