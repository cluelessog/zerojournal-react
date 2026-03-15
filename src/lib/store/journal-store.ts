import { create } from 'zustand'
import type { JournalEntry, JournalMood } from '@/lib/types'
import {
  addJournalEntry,
  getAllJournalEntries,
  getJournalEntriesByDate,
  updateJournalEntry,
  deleteJournalEntry,
} from '@/lib/persistence/db'

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
    symbol: string | null
    content: string
    tags: string[]
    mood: JournalMood | null
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
      const entries = await getAllJournalEntries()
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
      const entries = await getJournalEntriesByDate(date)
      entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      set({ entries, isLoading: false })
    } catch (err) {
      console.error('[JournalStore] loadEntriesByDate failed', err)
      set({ error: 'Failed to load journal entries', isLoading: false })
    }
  },

  addEntry: async ({ tradeDate, symbol, content, tags, mood }) => {
    const now = new Date().toISOString()
    const entry: JournalEntry = {
      id: crypto.randomUUID(),
      tradeDate,
      symbol: symbol ?? null,
      content,
      tags,
      mood,
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
