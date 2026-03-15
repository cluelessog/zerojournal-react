import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { JournalEntry } from '@/lib/types'

interface DayJournalEntriesProps {
  entries: JournalEntry[]
  onEdit: (entry: JournalEntry) => void
  onDelete: (id: string) => void
}

const NOTES_PREVIEW_LINES = 2

function NotesPreview({ notes }: { notes: string }) {
  const [expanded, setExpanded] = useState(false)
  const lines = notes.split('\n')
  const needsTruncation = lines.length > NOTES_PREVIEW_LINES || notes.length > 160

  const displayNotes =
    expanded || !needsTruncation
      ? notes
      : lines.slice(0, NOTES_PREVIEW_LINES).join('\n').slice(0, 160) + (notes.length > 160 ? '…' : '')

  return (
    <div>
      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
        {displayNotes}
      </p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-0.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export function DayJournalEntries({ entries, onEdit, onDelete }: DayJournalEntriesProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-3">
        No journal entries for this day
      </p>
    )
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await Promise.resolve(onDelete(id))
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const isConfirming = confirmDeleteId === entry.id
        const notes = entry.notes ?? entry.content ?? ''

        return (
          <div
            key={entry.id}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5"
          >
            {/* Header: symbol + setup + actions */}
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                {entry.symbol && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0 shrink-0">
                    {entry.symbol}
                  </Badge>
                )}
                {entry.setup && (
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">
                    {entry.setup}
                  </span>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => onEdit(entry)}
                  title="Edit entry"
                >
                  <Pencil className="size-3" />
                </Button>

                {isConfirming ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleDelete(entry.id)}
                      disabled={deleting}
                    >
                      {deleting ? '…' : 'Delete'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setConfirmDeleteId(null)}
                      disabled={deleting}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                    onClick={() => setConfirmDeleteId(entry.id)}
                    title="Delete entry"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Notes preview */}
            {notes && <NotesPreview notes={notes} />}
          </div>
        )
      })}
    </div>
  )
}
