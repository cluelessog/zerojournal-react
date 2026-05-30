import { create } from 'zustand'
import type { JournalEntry } from '@/lib/types'
import {
  addJournalEntry,
  getAllJournalEntries,
  getJournalEntriesByDate,
  updateJournalEntry,
  deleteJournalEntry,
} from '@/lib/persistence/db'

export function exportJournalEntries(entries: JournalEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zerojournal-entries-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export async function importJournalEntries(
  file: File,
  existingEntries: JournalEntry[]
): Promise<{ imported: number; skipped: number }> {
  const text = await file.text()
  const parsed: unknown = JSON.parse(text)
  if (!Array.isArray(parsed)) throw new Error('Invalid file: expected a JSON array')

  const existingById = new Map(existingEntries.map((e) => [e.id, e]))
  let imported = 0
  let skipped = 0

  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object' || !('id' in raw) || !('tradeDate' in raw)) {
      skipped++
      continue
    }
    const incoming = raw as JournalEntry
    const existing = existingById.get(incoming.id)
    // Keep whichever version was updated more recently
    if (existing && existing.updatedAt >= incoming.updatedAt) {
      skipped++
      continue
    }
    await updateJournalEntry({ ...incoming, notes: incoming.notes ?? incoming.content ?? '' })
    imported++
  }

  return { imported, skipped }
}

/** Normalize legacy v4 entries that have `content` instead of `notes` */
function normalizeEntry(entry: JournalEntry): JournalEntry {
  return {
    ...entry,
    notes: entry.notes ?? entry.content ?? '',
    setup: entry.setup ?? null,
    orderGroupId: entry.orderGroupId ?? null,
  }
}

interface JournalStore {
  // State
  entries: JournalEntry[]
  isLoading: boolean
  error: string | null
  selectedDate: string | null

  // Actions
  loadEntries: () => Promise<void>
  loadEntriesByDate: (date: string) => Promise<void>
  addEntry: (entry: {
    tradeDate: string
    notes: string
    symbol?: string | null
    setup?: string | null
    orderGroupId?: string | null
  }) => Promise<void>
  updateEntry: (id: string, updates: Partial<Omit<JournalEntry, 'id' | 'createdAt'>>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  setSelectedDate: (date: string | null) => void
}

export const useJournalStore = create<JournalStore>((set, get) => ({
  entries: [],
  isLoading: false,
  error: null,
  selectedDate: null,

  loadEntries: async () => {
    set({ isLoading: true, error: null })
    try {
      const raw = await getAllJournalEntries()
      const entries = raw.map(normalizeEntry)
      // Sort most recent first
      entries.sort((a, b) => b.tradeDate.localeCompare(a.tradeDate))
      set({ entries, isLoading: false })
    } catch (err) {
      console.error('[JournalStore] loadEntries failed', err)
      set({ error: 'Failed to load journal entries', isLoading: false })
    }
  },

  loadEntriesByDate: async (date: string) => {
    set({ isLoading: true, error: null })
    try {
      const raw = await getJournalEntriesByDate(date)
      const entries = raw.map(normalizeEntry)
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      set({ entries, isLoading: false })
    } catch (err) {
      console.error('[JournalStore] loadEntriesByDate failed', err)
      set({ error: 'Failed to load journal entries', isLoading: false })
    }
  },

  addEntry: async ({ tradeDate, notes, symbol, setup, orderGroupId }) => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      tradeDate,
      symbol: symbol ?? null,
      notes,
      setup: setup ?? null,
      orderGroupId: orderGroupId ?? null,
      createdAt: now,
      updatedAt: now,
    }
    try {
      await addJournalEntry(entry)
      // Reload to keep sort order consistent
      await get().loadEntries()
    } catch (err) {
      console.error('[JournalStore] addEntry failed', err)
      set({ error: 'Failed to save journal entry' })
      throw err
    }
  },

  updateEntry: async (id, updates) => {
    const existing = get().entries.find((e) => e.id === id)
    if (!existing) return
    const updated: JournalEntry = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    }
    try {
      await updateJournalEntry(updated)
      await get().loadEntries()
    } catch (err) {
      console.error('[JournalStore] updateEntry failed', err)
      set({ error: 'Failed to update journal entry' })
      throw err
    }
  },

  deleteEntry: async (id) => {
    try {
      await deleteJournalEntry(id)
      set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }))
    } catch (err) {
      console.error('[JournalStore] deleteEntry failed', err)
      set({ error: 'Failed to delete journal entry' })
      throw err
    }
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date })
  },
}))
