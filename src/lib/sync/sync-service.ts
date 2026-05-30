import { getSettings, setSettings } from '@/lib/persistence/storage'
import {
  getAllJournalEntries,
  updateJournalEntry,
  addJournalEntry,
  loadPortfolio,
  savePortfolio,
  getMetadata,
  saveMetadata,
} from '@/lib/persistence/db'
import type { JournalEntry, PortfolioSnapshot, ImportMetadata } from '@/lib/types'
import {
  initDriveClient,
  getAccessToken,
  clearToken as clearDriveToken,
  findOrCreateFolder,
  findFile,
  uploadFile,
  downloadFile,
} from './google-drive'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'disconnected' | 'connecting' | 'idle' | 'pushing' | 'pulling' | 'error'

interface DrivePortfolioFile {
  snapshot: PortfolioSnapshot
  metadata: ImportMetadata
}

// ─── Module State ──────────────────────────────────────────────────────────────

const FOLDER_NAME = 'ZeroJournal'
const PORTFOLIO_FILE = 'zerojournal-portfolio.json'
const JOURNAL_FILE = 'zerojournal-journal.json'

let _status: SyncStatus = 'disconnected'
let _folderId: string | null = null
let _portfolioFileId: string | null = null
let _journalFileId: string | null = null
let _pushTimer: ReturnType<typeof setTimeout> | null = null
let _listeners: Array<(s: SyncStatus) => void> = []
let _storeReloader: (() => void) | null = null

// ─── Status Management ─────────────────────────────────────────────────────────

function setStatus(s: SyncStatus): void {
  _status = s
  for (const cb of _listeners) {
    try { cb(s) } catch { /* ignore listener errors */ }
  }
}

export function getSyncStatus(): SyncStatus {
  return _status
}

export function onStatusChange(cb: (s: SyncStatus) => void): () => void {
  _listeners.push(cb)
  return () => {
    _listeners = _listeners.filter((l) => l !== cb)
  }
}

export function registerStoreReloader(fn: () => void): void {
  _storeReloader = fn
}

// ─── File ID Resolution ────────────────────────────────────────────────────────

async function ensureFolder(token: string): Promise<string> {
  if (_folderId) return _folderId
  _folderId = await findOrCreateFolder(FOLDER_NAME, token)
  return _folderId
}

async function ensureFileIds(token: string, folderId: string): Promise<void> {
  if (!_portfolioFileId) {
    _portfolioFileId = await findFile(PORTFOLIO_FILE, folderId, token)
  }
  if (!_journalFileId) {
    _journalFileId = await findFile(JOURNAL_FILE, folderId, token)
  }
}

// ─── Journal Merge ─────────────────────────────────────────────────────────────

function mergeJournal(local: JournalEntry[], remote: JournalEntry[]): JournalEntry[] {
  const map = new Map<string, JournalEntry>()
  for (const entry of local) {
    map.set(entry.id, entry)
  }
  for (const entry of remote) {
    const existing = map.get(entry.id)
    if (!existing || entry.updatedAt > existing.updatedAt) {
      map.set(entry.id, entry)
    }
  }
  return Array.from(map.values())
}

// ─── Public API ────────────────────────────────────────────────────────────────

export async function initSync(): Promise<void> {
  try {
    const clientId = await getSettings<string>('googleClientId')
    if (!clientId) {
      setStatus('disconnected')
      return
    }
    setStatus('connecting')
    await initDriveClient(clientId)
    const token = await getAccessToken(false)
    if (!token) {
      setStatus('disconnected')
      return
    }
    setStatus('idle')
    await pullAndMerge()
  } catch {
    setStatus('disconnected')
  }
}

export async function connectDrive(clientId?: string): Promise<void> {
  try {
    setStatus('connecting')
    if (clientId) {
      await setSettings('googleClientId', clientId)
      await initDriveClient(clientId)
    }
    await getAccessToken(true)
    setStatus('idle')
    await pullAndMerge()
  } catch (err) {
    console.error('[SyncService] connectDrive failed', err)
    setStatus('error')
    throw err
  }
}

export async function disconnectDrive(): Promise<void> {
  clearDriveToken()
  _folderId = null
  _portfolioFileId = null
  _journalFileId = null
  if (_pushTimer) {
    clearTimeout(_pushTimer)
    _pushTimer = null
  }
  setStatus('disconnected')
}

export async function pullAndMerge(): Promise<void> {
  try {
    setStatus('pulling')
    const token = await getAccessToken(false)
    const folderId = await ensureFolder(token)
    await ensureFileIds(token, folderId)

    // Merge journal entries
    if (_journalFileId) {
      try {
        const raw = await downloadFile(_journalFileId, token)
        const remoteEntries: JournalEntry[] = JSON.parse(raw)
        const localEntries = await getAllJournalEntries()
        const merged = mergeJournal(localEntries, remoteEntries)
        const localIds = new Set(localEntries.map((e) => e.id))
        for (const entry of merged) {
          if (!localIds.has(entry.id)) {
            await addJournalEntry(entry)
          } else {
            const local = localEntries.find((e) => e.id === entry.id)
            if (local && entry.updatedAt > local.updatedAt) {
              await updateJournalEntry(entry)
            }
          }
        }
      } catch (err) {
        console.error('[SyncService] pullAndMerge journal failed', err)
      }
    }

    // Merge portfolio — remote wins if newer
    if (_portfolioFileId) {
      try {
        const raw = await downloadFile(_portfolioFileId, token)
        const driveFile: DrivePortfolioFile = JSON.parse(raw)
        const localPortfolio = await loadPortfolio()
        const localImportedAt = localPortfolio?.importedAt ?? ''
        const remoteImportedAt = driveFile.snapshot?.importedAt ?? ''
        if (remoteImportedAt > localImportedAt) {
          await savePortfolio(driveFile.snapshot)
          await saveMetadata(driveFile.metadata)
        }
      } catch (err) {
        console.error('[SyncService] pullAndMerge portfolio failed', err)
      }
    }

    _storeReloader?.()
    setStatus('idle')
  } catch (err) {
    console.error('[SyncService] pullAndMerge failed', err)
    setStatus('error')
  }
}

export function schedulePush(): void {
  if (_status === 'disconnected') return
  if (_pushTimer) clearTimeout(_pushTimer)
  _pushTimer = setTimeout(() => {
    push().catch((err) => console.error('[SyncService] push failed', err))
  }, 2000)
}

async function push(): Promise<void> {
  try {
    setStatus('pushing')
    const token = await getAccessToken(false)
    const folderId = await ensureFolder(token)

    // Upload journal
    const journalEntries = await getAllJournalEntries()
    const journalContent = JSON.stringify(journalEntries)
    _journalFileId = await uploadFile(
      JOURNAL_FILE,
      journalContent,
      _journalFileId,
      folderId,
      token,
    )

    // Upload portfolio (only if data exists)
    const portfolio = await loadPortfolio()
    const metadata = await getMetadata()
    if (portfolio && metadata) {
      const driveFile: DrivePortfolioFile = { snapshot: portfolio, metadata }
      const portfolioContent = JSON.stringify(driveFile)
      _portfolioFileId = await uploadFile(
        PORTFOLIO_FILE,
        portfolioContent,
        _portfolioFileId,
        folderId,
        token,
      )
    }

    setStatus('idle')
  } catch (err) {
    console.error('[SyncService] push failed', err)
    setStatus('error')
  }
}
