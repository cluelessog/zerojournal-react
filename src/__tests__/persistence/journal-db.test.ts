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
    notes: 'Test journal entry',
    setup: null,
    orderGroupId: null,
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
    const entry = makeEntry({ id: 'crud-1', notes: 'Original notes' })
    await db.addJournalEntry(entry)

    // Read
    const fetched = await db.getJournalEntry('crud-1')
    expect(fetched?.notes).toBe('Original notes')

    // Update
    const updated: JournalEntry = { ...entry, notes: 'Updated notes', updatedAt: new Date().toISOString() }
    await db.updateJournalEntry(updated)
    const afterUpdate = await db.getJournalEntry('crud-1')
    expect(afterUpdate?.notes).toBe('Updated notes')

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

  // --- v5 migration tests ---

  it('v5: legacy v4 entries with content field are readable', async () => {
    // Simulate a v4-format entry (has content instead of notes, has mood/tags)
    const v4Entry = {
      id: 'legacy-1',
      tradeDate: '2024-02-20',
      symbol: 'RELIANCE',
      content: 'Old style journal content',
      tags: ['breakout', 'momentum'],
      mood: 'confident' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    // Write as raw object — v4 entries won't have notes/setup/orderGroupId
    await db.addJournalEntry(v4Entry as unknown as JournalEntry)

    const result = await db.getJournalEntry('legacy-1')
    expect(result).toBeDefined()
    // v4 entry has content but no notes
    expect(result?.content).toBe('Old style journal content')
    expect(result?.notes).toBeUndefined()
    // Normalize-on-read: notes ?? content ?? ''
    const normalized = result!.notes ?? result!.content ?? ''
    expect(normalized).toBe('Old style journal content')
    // Legacy fields preserved
    expect(result?.mood).toBe('confident')
    expect(result?.tags).toEqual(['breakout', 'momentum'])
  })

  it('v5: new entries with setup and notes fields round-trip', async () => {
    const entry = makeEntry({
      id: 'v5-1',
      notes: 'Took a breakout trade above resistance',
      setup: 'Breakout above 200 DMA',
      orderGroupId: null,
      symbol: 'INFY',
    })
    await db.addJournalEntry(entry)

    const result = await db.getJournalEntry('v5-1')
    expect(result).toBeDefined()
    expect(result?.notes).toBe('Took a breakout trade above resistance')
    expect(result?.setup).toBe('Breakout above 200 DMA')
    expect(result?.orderGroupId).toBeNull()
    expect(result?.symbol).toBe('INFY')
  })

  it('v5: portfolio and metadata stores are unaffected by migration', async () => {
    // This test verifies the v5 migration doesn't touch portfolio/metadata
    // by simply ensuring we can still read/write to them
    const testSnapshot = {
      rawTrades: [],
      orderGroups: [],
      analytics: null,
      timeline: [],
    }
    await db.savePortfolio(testSnapshot as any)
    const loaded = await db.loadPortfolio()
    expect(loaded).toBeDefined()
    expect(loaded?.rawTrades).toEqual([])

    const testMeta = { importedAt: new Date().toISOString(), tradebookRowCount: 42 }
    await db.saveMetadata(testMeta as any)
    const meta = await db.getMetadata()
    expect(meta).toBeDefined()
    expect((meta as any)?.tradebookRowCount).toBe(42)
  })
})
