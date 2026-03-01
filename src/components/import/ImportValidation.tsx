import type { ParseWarning, ParseError } from '@/lib/types'

interface ImportValidationProps {
  warnings: ParseWarning[]
  errors: ParseError[]
}

export function ImportValidation({ warnings, errors }: ImportValidationProps) {
  if (warnings.length === 0 && errors.length === 0) return null

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-red-600 dark:text-red-400 font-semibold text-sm">
              ✕ {errors.length} error{errors.length !== 1 ? 's' : ''} — Cannot proceed
            </span>
          </div>
          <ul className="space-y-1">
            {errors.map((err, i) => (
              <li key={i} className="text-xs text-red-700 dark:text-red-300 flex gap-2">
                <span className="shrink-0 font-mono text-red-500">[{err.code}]</span>
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-amber-700 dark:text-amber-400 font-semibold text-sm">
              ⚠ {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
            </span>
          </div>
          <ul className="space-y-1">
            {warnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-800 dark:text-amber-300 flex gap-2">
                <span className="shrink-0 text-amber-500">Row {w.row}:</span>
                <span>
                  <span className="font-medium">{w.field}</span> — {w.message}
                  {w.rawValue !== undefined && w.rawValue !== null && (
                    <span className="ml-1 font-mono opacity-70">
                      (got: {String(w.rawValue)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
