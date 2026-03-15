import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useJournalStore } from '@/lib/store/journal-store'
import type { JournalEntry, JournalMood } from '@/lib/types'

const MOODS: { value: JournalMood; emoji: string; label: string }[] = [
  { value: 'confident', emoji: '😎', label: 'Confident' },
  { value: 'neutral', emoji: '😐', label: 'Neutral' },
  { value: 'anxious', emoji: '😰', label: 'Anxious' },
  { value: 'frustrated', emoji: '😤', label: 'Frustrated' },
  { value: 'disciplined', emoji: '🧘', label: 'Disciplined' },
]

interface JournalEditorProps {
  entry?: JournalEntry
  defaultDate?: string
  onSaved?: () => void
  onCancel?: () => void
}

export function JournalEditor({ entry, defaultDate, onSaved, onCancel }: JournalEditorProps) {
  const addEntry = useJournalStore((s) => s.addEntry)
  const updateEntry = useJournalStore((s) => s.updateEntry)

  const today = new Date().toISOString().slice(0, 10)

  const [tradeDate, setTradeDate] = useState(entry?.tradeDate ?? defaultDate ?? today)
  const [symbol, setSymbol] = useState(entry?.symbol ?? '')
  const [content, setContent] = useState(entry?.content ?? '')
  const [mood, setMood] = useState<JournalMood | null>(entry?.mood ?? null)
  const [tagsInput, setTagsInput] = useState(entry?.tags.join(', ') ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!entry

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) {
      setError('Content is required.')
      return
    }
    if (!tradeDate) {
      setError('Date is required.')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setSaving(true)
    setError(null)
    try {
      if (isEdit) {
        await updateEntry(entry.id, {
          tradeDate,
          symbol: symbol.trim() || null,
          content: content.trim(),
          tags,
          mood,
        })
      } else {
        await addEntry({
          tradeDate,
          symbol: symbol.trim() || null,
          content: content.trim(),
          tags,
          mood,
        })
      }
      onSaved?.()
    } catch {
      setError('Failed to save entry. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{isEdit ? 'Edit Entry' : 'New Journal Entry'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Date + Symbol row */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Trade Date <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
                required
                className="text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Symbol <span className="text-gray-400">(optional)</span>
              </label>
              <Input
                type="text"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                placeholder="e.g. RELIANCE"
                className="text-sm uppercase"
              />
            </div>
          </div>

          {/* Mood picker */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Mood</label>
            <div className="flex gap-2">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMood(mood === m.value ? null : m.value)}
                  title={m.label}
                  className={[
                    'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md border text-xs transition-colors',
                    mood === m.value
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400',
                  ].join(' ')}
                >
                  <span className="text-lg leading-none">{m.emoji}</span>
                  <span className="hidden sm:block">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What happened today? Your thoughts, observations, lessons learned…"
              rows={5}
              required
              className="w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {/* Tags */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
              Tags <span className="text-gray-400">(comma separated)</span>
            </label>
            <Input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. breakout, momentum, mistake"
              className="text-sm"
            />
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-1">
            {onCancel && (
              <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
                Cancel
              </Button>
            )}
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Update Entry' : 'Save Entry'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
