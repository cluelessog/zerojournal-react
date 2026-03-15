import { openDB as idbOpenDB, type IDBPDatabase } from 'idb'
import type { PortfolioSnapshot, ImportMetadata, JournalEntry } from '@/lib/types'

const DB_NAME = 'zerojournal'
const DB_VERSION = 5

interface ZeroJournalDB {
  portfolio: {
    key: string
    value: PortfolioSnapshot
  }
  metadata: {
    key: string
    value: ImportMetadata
  }
  settings: {
    key: string
    value: unknown
  }
  journal: {
    key: string
    value: JournalEntry
    indexes: { 'by-date': string }
  }
}

let dbInstance: IDBPDatabase<ZeroJournalDB> | null = null

export async function getDB(): Promise<IDBPDatabase<ZeroJournalDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await idbOpenDB<ZeroJournalDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // v1: portfolio + metadata stores
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('portfolio')) {
          db.createObjectStore('portfolio')
        }
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata')
        }
      }
      // v2: settings store
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings')
        }
      }
      // v3: invalidate cache due to parser normalization fix (charges.total semantics change)
      // Old data had charges.total that included DP charges; new parser excludes DP.
      // Users must re-import to get correct data.
      if (oldVersion < 3) {
        db.deleteObjectStore('portfolio')
        db.deleteObjectStore('metadata')
        db.createObjectStore('portfolio')
        db.createObjectStore('metadata')
      }
      // v4: journal store for trade journal entries
      if (oldVersion < 4) {
        if (!db.objectStoreNames.contains('journal')) {
          const journalStore = db.createObjectStore('journal', { keyPath: 'id' })
          journalStore.createIndex('by-date', 'tradeDate', { unique: false })
        }
      }
      // v5: adds setup/notes/orderGroupId fields to JournalEntry type
      // No schema changes needed — IndexedDB is schemaless for field additions
      // Existing entries will lack new fields; code normalizes undefined -> null
      if (oldVersion < 5) {
        // no-op: version bump only
      }
    },
  })

  return dbInstance
}

export async function savePortfolio(snapshot: PortfolioSnapshot): Promise<void> {
  const db = await getDB()
  await db.put('portfolio', snapshot, 'current')
}

export async function loadPortfolio(): Promise<PortfolioSnapshot | undefined> {
  const db = await getDB()
  return db.get('portfolio', 'current')
}

export async function deleteAll(): Promise<void> {
  const db = await getDB()
  const tx = db.transaction(['portfolio', 'metadata', 'settings', 'journal'], 'readwrite')
  await Promise.all([
    tx.objectStore('portfolio').clear(),
    tx.objectStore('metadata').clear(),
    tx.objectStore('settings').clear(),
    tx.objectStore('journal').clear(),
    tx.done,
  ])
}

export async function getMetadata(): Promise<ImportMetadata | undefined> {
  const db = await getDB()
  return db.get('metadata', 'current')
}

export async function saveMetadata(metadata: ImportMetadata): Promise<void> {
  const db = await getDB()
  await db.put('metadata', metadata, 'current')
}

export async function addJournalEntry(entry: JournalEntry): Promise<void> {
  const db = await getDB()
  await db.add('journal', entry)
}

export async function getJournalEntry(id: string): Promise<JournalEntry | undefined> {
  const db = await getDB()
  return db.get('journal', id)
}

export async function getAllJournalEntries(): Promise<JournalEntry[]> {
  const db = await getDB()
  return db.getAll('journal')
}

export async function getJournalEntriesByDate(date: string): Promise<JournalEntry[]> {
  const db = await getDB()
  return db.getAllFromIndex('journal', 'by-date', date)
}

export async function updateJournalEntry(entry: JournalEntry): Promise<void> {
  const db = await getDB()
  await db.put('journal', entry)
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const db = await getDB()
  await db.delete('journal', id)
}
