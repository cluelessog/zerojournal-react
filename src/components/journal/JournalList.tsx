import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useJournalStore } from '@/lib/store/journal-store'
import { JournalEditor } from '@/components/journal/JournalEditor'
import type { JournalEntry, JournalMood } from '@/lib/types'

const MOOD_EMOJI: Record<JournalMood, string> = {
  confident: '😎',
  neutral: '😐',
  anxious: '😰',
  frustrated: '😤',
  disciplined: '🧘',
}

const CONTENT_PREVIEW_LENGTH = 140

interface JournalListProps {
  entries: JournalEntry[]
}

export function JournalList({ entries }: JournalListProps) {
  const deleteEntry = useJournalStore((s) => s.deleteEntry)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <span className="text-4xl mb-3">📓</span>
        <p className="text-gray-500 dark:text-gray-400 font-medium">No journal entries yet</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Add your first entry to start tracking your trading mindset.
        </p>
      </div>
    )
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteEntry(id)
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-3">
      {entries.map((entry) => {
        const isExpanded = expandedIds.has(entry.id)
        const isEditing = editingId === entry.id
        const isConfirmingDelete = confirmDeleteId === entry.id
        const needsTruncation = entry.content.length > CONTENT_PREVIEW_LENGTH
        const displayContent =
          isExpanded || !needsTruncation
            ? entry.content
            : entry.content.slice(0, CONTENT_PREVIEW_LENGTH) + '…'

        if (isEditing) {
          return (
            <JournalEditor
              key={entry.id}
              entry={entry}
              onSaved={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
            />
          )
        }

        return (
          <Card key={entry.id} className="overflow-hidden">
            <CardContent className="pt-4 pb-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 shrink-0">
                    {formatDate(entry.tradeDate)}
                  </span>
                  {entry.symbol && (
                    <Badge variant="secondary" className="text-xs shrink-0">
                      {entry.symbol}
                    </Badge>
                  )}
                  {entry.mood && (
                    <span
                      className="text-base leading-none shrink-0"
                      title={entry.mood.charAt(0).toUpperCase() + entry.mood.slice(1)}
                    >
                      {MOOD_EMOJI[entry.mood]}
                    </span>
                  )}
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    onClick={() => setEditingId(entry.id)}
                  >
                    Edit
                  </Button>
                  {isConfirmingDelete ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleDelete(entry.id)}
                        disabled={deleting}
                      >
                        {deleting ? '…' : 'Confirm'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleting}
                      >
                        No
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      onClick={() => setConfirmDeleteId(entry.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>

              {/* Content */}
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {displayContent}
              </p>
              {needsTruncation && (
                <button
                  onClick={() => toggleExpand(entry.id)}
                  className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {isExpanded ? 'Show less' : 'Show more'}
                </button>
              )}

              {/* Tags */}
              {entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {entry.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Updated timestamp */}
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">
                {entry.updatedAt !== entry.createdAt ? 'Updated' : 'Created'}{' '}
                {new Date(entry.updatedAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
