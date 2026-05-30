import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  getSyncStatus,
  onStatusChange,
  connectDrive,
  disconnectDrive,
  schedulePush,
  type SyncStatus,
} from '@/lib/sync/sync-service'
import { getSettings } from '@/lib/persistence/storage'
import { cn } from '@/lib/utils'

function SpinnerIcon() {
  return (
    <svg
      className="animate-spin h-3 w-3"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

type DialogMode = 'setup' | 'connected' | null

export function DriveStatusChip() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus)
  const [dialogMode, setDialogMode] = useState<DialogMode>(null)
  const [clientIdInput, setClientIdInput] = useState('')
  const [hasStoredClientId, setHasStoredClientId] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)

  // Subscribe to status changes
  useEffect(() => {
    const unsubscribe = onStatusChange(setStatus)
    return unsubscribe
  }, [])

  // Check whether a client ID is stored
  useEffect(() => {
    getSettings<string>('googleClientId').then((id) => {
      setHasStoredClientId(!!id)
    })
  }, [status])

  async function handleChipClick() {
    if (status === 'disconnected') {
      if (hasStoredClientId) {
        // Attempt silent reconnect, no dialog needed
        try {
          setConnecting(true)
          await connectDrive()
        } catch {
          // Fall back to setup dialog on error
          setDialogMode('setup')
        } finally {
          setConnecting(false)
        }
      } else {
        setDialogMode('setup')
      }
    } else if (status === 'idle' || status === 'error') {
      setDialogMode('connected')
    }
    // Ignore clicks while connecting/pushing/pulling
  }

  async function handleConnect() {
    if (!clientIdInput.trim()) return
    setConnectError(null)
    setConnecting(true)
    try {
      await connectDrive(clientIdInput.trim())
      setHasStoredClientId(true)
      setDialogMode(null)
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    await disconnectDrive()
    setDialogMode(null)
    setHasStoredClientId(false)
  }

  function handleSyncNow() {
    schedulePush()
    setDialogMode(null)
  }

  // Chip appearance
  const isBusy = status === 'connecting' || status === 'pushing' || status === 'pulling'
  const chipClass = cn(
    'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full cursor-pointer select-none transition-colors',
    status === 'idle' &&
      'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50',
    status === 'disconnected' &&
      'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700',
    isBusy && 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 cursor-default',
    status === 'error' &&
      'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50',
  )

  return (
    <>
      <button
        className={chipClass}
        onClick={handleChipClick}
        disabled={isBusy || connecting}
        aria-label="Google Drive sync status"
        title={
          status === 'idle'
            ? 'Synced to Google Drive'
            : status === 'error'
              ? 'Sync error — click to manage'
              : status === 'disconnected'
                ? hasStoredClientId
                  ? 'Connect to Google Drive'
                  : 'Set up Google Drive sync'
                : 'Syncing…'
        }
      >
        {isBusy || connecting ? (
          <SpinnerIcon />
        ) : (
          <span aria-hidden="true">
            {status === 'error' ? '⚠' : '☁'}
          </span>
        )}
        <span>
          {status === 'idle' && 'Drive'}
          {status === 'disconnected' && (hasStoredClientId ? 'Connect Drive' : 'Setup Drive')}
          {(status === 'connecting' || connecting) && 'Connecting…'}
          {(status === 'pushing' || status === 'pulling') && 'Syncing…'}
          {status === 'error' && 'Drive'}
        </span>
      </button>

      {/* Setup dialog — no client ID stored */}
      <Dialog open={dialogMode === 'setup'} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set up Google Drive Sync</DialogTitle>
            <DialogDescription asChild>
              <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
                <p>Follow these steps to enable automatic sync:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>
                    Go to{' '}
                    <a
                      href="https://console.cloud.google.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      console.cloud.google.com
                    </a>{' '}
                    and create a new project
                  </li>
                  <li>Enable the "Google Drive API" for your project</li>
                  <li>
                    Go to Credentials → Create OAuth 2.0 Client ID (Web application)
                  </li>
                  <li>
                    Add Authorized JavaScript origin:{' '}
                    <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">
                      {typeof window !== 'undefined' ? window.location.origin : ''}
                    </code>
                  </li>
                  <li>Copy the Client ID and paste it below</li>
                </ol>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input
              placeholder="your-client-id.apps.googleusercontent.com"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
              disabled={connecting}
            />
            {connectError && (
              <p className="text-xs text-red-600 dark:text-red-400">{connectError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMode(null)} disabled={connecting}>
              Cancel
            </Button>
            <Button
              onClick={handleConnect}
              disabled={!clientIdInput.trim() || connecting}
            >
              {connecting ? 'Connecting…' : 'Connect'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Connected / error dialog */}
      <Dialog
        open={dialogMode === 'connected'}
        onOpenChange={(open) => !open && setDialogMode(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Google Drive Sync</DialogTitle>
            <DialogDescription>
              {status === 'error'
                ? 'The last sync attempt encountered an error. You can retry now or disconnect.'
                : 'Your data is automatically synced to Google Drive.'}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full',
                status === 'idle' &&
                  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                status === 'error' &&
                  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
              )}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {status === 'idle' ? 'Synced' : 'Sync error'}
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-between">
            <Button variant="outline" onClick={handleDisconnect} className="text-red-600 dark:text-red-400 hover:text-red-700 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20">
              Disconnect
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDialogMode(null)}>
                Close
              </Button>
              <Button onClick={handleSyncNow}>
                Sync Now
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
