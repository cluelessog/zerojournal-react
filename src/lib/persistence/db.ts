import { openDB as idbOpenDB, type IDBPDatabase } from 'idb'
import type { PortfolioSnapshot, ImportMetadata } from '@/lib/types'

const DB_NAME = 'zerojournal'
const DB_VERSION = 1

interface ZeroJournalDB {
  portfolio: {
    key: string
    value: PortfolioSnapshot
  }
  metadata: {
    key: string
    value: ImportMetadata
  }
}

let dbInstance: IDBPDatabase<ZeroJournalDB> | null = null

export async function getDB(): Promise<IDBPDatabase<ZeroJournalDB>> {
  if (dbInstance) return dbInstance

  dbInstance = await idbOpenDB<ZeroJournalDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('portfolio')) {
        db.createObjectStore('portfolio')
      }
      if (!db.objectStoreNames.contains('metadata')) {
        db.createObjectStore('metadata')
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
  const tx = db.transaction(['portfolio', 'metadata'], 'readwrite')
  await Promise.all([
    tx.objectStore('portfolio').clear(),
    tx.objectStore('metadata').clear(),
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
