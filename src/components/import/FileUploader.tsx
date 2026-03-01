import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'

type FileType = 'tradebook' | 'pnl'

interface FileUploaderProps {
  fileType: FileType
  label: string
  description: string
  selectedFile: File | null
  error: string | null
  onFileSelected: (file: File, type: FileType) => void
}

const MAX_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

function validateFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return `Invalid file type: "${file.name}". Only .xlsx files are accepted.`
  }
  if (file.size > MAX_SIZE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum size is 50 MB.`
  }
  return null
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function FileDropZone({
  fileType,
  label,
  description,
  selectedFile,
  error,
  onFileSelected,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File) => {
      const err = validateFile(file)
      if (err) {
        setValidationError(err)
        return
      }
      setValidationError(null)
      onFileSelected(file, fileType)
    },
    [fileType, onFileSelected],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
      // Reset input so same file can be re-selected
      e.target.value = ''
    },
    [handleFile],
  )

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const displayError = validationError ?? error

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        onClick={handleClick}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? handleClick() : undefined}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex flex-col items-center justify-center w-full min-h-[140px] rounded-lg border-2 border-dashed cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : selectedFile
              ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
              : displayError
                ? 'border-red-400 bg-red-50 dark:bg-red-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={handleInputChange}
          aria-hidden="true"
        />

        {selectedFile ? (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-2xl">✓</span>
            <span className="text-sm font-medium text-green-700 dark:text-green-400 break-all">
              {selectedFile.name}
            </span>
            <span className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</span>
            <span className="text-xs text-gray-400 mt-1">Click or drop to replace</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <span className="text-3xl text-gray-400">{isDragging ? '↓' : '↑'}</span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {isDragging ? 'Drop file here' : 'Drag & drop or click to browse'}
            </span>
            <span className="text-xs text-gray-400">{description}</span>
            <span className="text-xs text-gray-400">.xlsx only · max 50 MB</span>
          </div>
        )}
      </div>

      {displayError && (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {displayError}
        </p>
      )}
    </div>
  )
}

// Convenience wrapper that renders both drop zones
interface DualFileUploaderProps {
  tradebookFile: File | null
  pnlFile: File | null
  tradebookError: string | null
  pnlError: string | null
  onFileSelected: (file: File, type: FileType) => void
}

export function DualFileUploader({
  tradebookFile,
  pnlFile,
  tradebookError,
  pnlError,
  onFileSelected,
}: DualFileUploaderProps) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <FileDropZone
        fileType="tradebook"
        label="Tradebook"
        description="Zerodha tradebook export (equity segment)"
        selectedFile={tradebookFile}
        error={tradebookError}
        onFileSelected={onFileSelected}
      />
      <FileDropZone
        fileType="pnl"
        label="P&L Statement"
        description="Zerodha P&L / tax P&L export"
        selectedFile={pnlFile}
        error={pnlError}
        onFileSelected={onFileSelected}
      />
    </div>
  )
}
