// ─── GIS Type Declarations ────────────────────────────────────────────────────

interface GISTokenResponse {
  access_token: string
  expires_in: string | number
  error?: string
}

interface GISTokenClient {
  requestAccessToken(opts?: { prompt?: string }): void
  callback: (r: GISTokenResponse) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: {
            client_id: string
            scope: string
            callback: (r: GISTokenResponse) => void
          }): GISTokenClient
          revoke(token: string, cb?: () => void): void
        }
      }
    }
  }
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const SCOPES = 'https://www.googleapis.com/auth/drive.file'
const SESSION_KEY = 'gd_token'
const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client'
const DRIVE_API = 'https://www.googleapis.com/drive/v3'
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

// ─── Token Management ──────────────────────────────────────────────────────────

interface StoredToken {
  accessToken: string
  expiresAt: number
}

function getStoredToken(): string | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed: StoredToken = JSON.parse(raw)
    if (Date.now() >= parsed.expiresAt - 60_000) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed.accessToken
  } catch {
    return null
  }
}

function storeToken(accessToken: string, expiresIn: string | number): void {
  const seconds = typeof expiresIn === 'string' ? parseInt(expiresIn, 10) : expiresIn
  const stored: StoredToken = {
    accessToken,
    expiresAt: Date.now() + seconds * 1000,
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored))
}

export function clearToken(): void {
  localStorage.removeItem(SESSION_KEY)
  tokenClient = null
}

// ─── GIS Script Loading ────────────────────────────────────────────────────────

let gisScriptPromise: Promise<void> | null = null

function loadGISScript(): Promise<void> {
  if (gisScriptPromise) return gisScriptPromise
  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    gisScriptPromise = Promise.resolve()
    return gisScriptPromise
  }
  gisScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_URL}"]`)
    if (existing) {
      // Script already in DOM, wait for it to load
      if (window.google?.accounts?.oauth2) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Failed to load GIS script')))
      return
    }
    const script = document.createElement('script')
    script.src = GIS_SCRIPT_URL
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load GIS script'))
    document.head.appendChild(script)
  })
  return gisScriptPromise
}

// ─── Token Client ──────────────────────────────────────────────────────────────

let tokenClient: GISTokenClient | null = null

export async function initDriveClient(clientId: string): Promise<void> {
  await loadGISScript()
  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Services not available')
  }
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: () => {
      // Callback is set per-request in getAccessToken
    },
  })
}

export function getAccessToken(interactive = false): Promise<string> {
  const stored = getStoredToken()
  if (stored) return Promise.resolve(stored)

  return new Promise<string>((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Drive client not initialized. Call initDriveClient first.'))
      return
    }
    tokenClient.callback = (response: GISTokenResponse) => {
      if (response.error) {
        // Non-interactive silent auth failed — resolve empty so caller can handle gracefully
        if (!interactive) { resolve(''); return }
        reject(new Error(`OAuth error: ${response.error}`))
        return
      }
      storeToken(response.access_token, response.expires_in)
      resolve(response.access_token)
    }
    // 'none' = fail silently without any UI; '' = show UI only if necessary
    tokenClient.requestAccessToken({ prompt: interactive ? '' : 'none' })
  })
}

// ─── Drive API Helpers ─────────────────────────────────────────────────────────

async function driveRequest(
  url: string,
  options: RequestInit,
  token: string,
): Promise<Response> {
  const headers = new Headers(options.headers as HeadersInit | undefined)
  headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(url, { ...options, headers })
  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText)
    throw new Error(`Drive API error ${response.status}: ${text}`)
  }
  return response
}

export async function findOrCreateFolder(name: string, token: string): Promise<string> {
  // Search for existing folder
  const query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`
  const searchUrl = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
  const searchRes = await driveRequest(searchUrl, { method: 'GET' }, token)
  const searchData: { files: Array<{ id: string; name: string }> } = await searchRes.json()

  if (searchData.files.length > 0) {
    return searchData.files[0].id
  }

  // Create folder
  const createRes = await driveRequest(
    `${DRIVE_API}/files`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    },
    token,
  )
  const created: { id: string } = await createRes.json()
  return created.id
}

export async function findFile(
  name: string,
  parentId: string,
  token: string,
): Promise<string | null> {
  const query = `name='${name}' and '${parentId}' in parents and trashed=false`
  const url = `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name)&spaces=drive`
  const res = await driveRequest(url, { method: 'GET' }, token)
  const data: { files: Array<{ id: string; name: string }> } = await res.json()
  return data.files.length > 0 ? data.files[0].id : null
}

export async function uploadFile(
  name: string,
  content: string,
  fileId: string | null,
  parentId: string,
  token: string,
): Promise<string> {
  const metadata = fileId
    ? { name }
    : { name, parents: [parentId] }

  const boundary = 'zerojournal_boundary'

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n')

  const url = fileId
    ? `${DRIVE_UPLOAD_API}/files/${fileId}?uploadType=multipart`
    : `${DRIVE_UPLOAD_API}/files?uploadType=multipart`

  const method = fileId ? 'PATCH' : 'POST'

  const res = await driveRequest(
    url,
    {
      method,
      headers: {
        'Content-Type': `multipart/related; boundary="${boundary}"`,
      },
      body,
    },
    token,
  )
  const created: { id: string } = await res.json()
  return created.id
}

export async function downloadFile(fileId: string, token: string): Promise<string> {
  const url = `${DRIVE_API}/files/${fileId}?alt=media`
  const res = await driveRequest(url, { method: 'GET' }, token)
  return res.text()
}
