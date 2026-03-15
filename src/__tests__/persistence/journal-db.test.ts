import { describe, it, expect, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import type { JournalEntry } from '@/lib/types'

// Import db module once; reset data between tests via deleteAll()
import * as db from '@/lib/persistence/db'

function makeEntry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: crypto.randomUUID(),
    tradeDate: '2024-01-15',
    symbol: null,
    content: 'Test journal entry',
    tags: [],
    mood: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('journal IndexedDB', () => {
  beforeEach(async () => {
    // Clear all stores between tests for isolation
    await db.deleteAll()
  })

  it('fresh install creates journal store (add and read back)', async () => {
    const entry = makeEntry({ id: 'test-fresh-1' })
    await db.addJournalEntry(entry)
    const result = await db.getJournalEntry('test-fresh-1')
    expect(result).toBeDefined()
    expect(result?.id).toBe('test-fresh-1')
  })

  it('CRUD: add, read, update, delete', async () => {
    const entry = makeEntry({ id: 'crud-1', content: 'Original content' })
    await db.addJournalEntry(entry)

    // Read
    const fetched = await db.getJournalEntry('crud-1')
    expect(fetched?.content).toBe('Original content')

    // Update
    const updated: JournalEntry = { ...entry, content: 'Updated content', updatedAt: new Date().toISOString() }
    await db.updateJournalEntry(updated)
    const afterUpdate = await db.getJournalEntry('crud-1')
    expect(afterUpdate?.content).toBe('Updated content')

    // Delete
    await db.deleteJournalEntry('crud-1')
    const afterDelete = await db.getJournalEntry('crud-1')
    expect(afterDelete).toBeUndefined()
  })

  it('query by date index returns matching entries', async () => {
    const entry1 = makeEntry({ id: 'date-1', tradeDate: '2024-03-10' })
    const entry2 = makeEntry({ id: 'date-2', tradeDate: '2024-03-10' })
    const entry3 = makeEntry({ id: 'date-3', tradeDate: '2024-03-11' })

    await db.addJournalEntry(entry1)
    await db.addJournalEntry(entry2)
    await db.addJournalEntry(entry3)

    const results = await db.getJournalEntriesByDate('2024-03-10')
    expect(results).toHaveLength(2)
    expect(results.map(e => e.id).sort()).toEqual(['date-1', 'date-2'])
  })

  it('getAllJournalEntries returns all entries', async () => {
    const entries = [
      makeEntry({ id: 'all-1', tradeDate: '2024-01-01' }),
      makeEntry({ id: 'all-2', tradeDate: '2024-01-02' }),
      makeEntry({ id: 'all-3', tradeDate: '2024-01-03' }),
    ]

    for (const e of entries) {
      await db.addJournalEntry(e)
    }

    const all = await db.getAllJournalEntries()
    expect(all).toHaveLength(3)
    expect(all.map(e => e.id).sort()).toEqual(['all-1', 'all-2', 'all-3'])
  })

  it('deleteAll clears journal store', async () => {
    await db.addJournalEntry(makeEntry({ id: 'del-1' }))
    await db.addJournalEntry(makeEntry({ id: 'del-2' }))

    const before = await db.getAllJournalEntries()
    expect(before).toHaveLength(2)

    await db.deleteAll()

    const after = await db.getAllJournalEntries()
    expect(after).toHaveLength(0)
  })
})
