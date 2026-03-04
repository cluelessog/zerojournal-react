import { useState } from 'react'
import { usePortfolioStore } from '@/lib/store/portfolio-store'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'

/**
 * Inline input component for setting initial trading capital.
 * Shown when max drawdown is in 'absolute' mode (no capital set).
 * When capital is set, displays as an editable badge with clear button.
 */
export function CapitalInput() {
  const initialCapital = usePortfolioStore((s) => s.initialCapital)
  const setInitialCapital = usePortfolioStore((s) => s.setInitialCapital)
  const clearInitialCapital = usePortfolioStore((s) => s.clearInitialCapital)

  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  function handleSave() {
    const parsed = Number(inputValue.replace(/,/g, ''))
    if (isNaN(parsed) || parsed <= 0) {
      setError('Enter a positive number')
      return
    }
    setError('')
    setInitialCapital(parsed)
    setInputValue('')
    setIsEditing(false)
  }

  function handleClear() {
    clearInitialCapital()
    setInputValue('')
    setError('')
    setIsEditing(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSave()
    }
    if (e.key === 'Escape') {
      setInputValue('')
      setError('')
      setIsEditing(false)
    }
  }

  // Display mode: capital is set, show badge
  if (initialCapital != null && initialCapital > 0 && !isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="secondary"
          className="cursor-pointer text-xs"
          onClick={() => {
            setInputValue(String(initialCapital))
            setIsEditing(true)
          }}
        >
          Capital: Rs. {initialCapital.toLocaleString('en-IN')}
        </Badge>
        <button
          onClick={handleClear}
          className="text-gray-400 hover:text-red-500 transition-colors"
          aria-label="Clear initial capital"
          title="Clear initial capital"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // Input mode: no capital set or editing
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <Input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 100000"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setError('')
          }}
          onKeyDown={handleKeyDown}
          className="h-7 w-28 text-xs"
          aria-label="Initial capital amount"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          className="h-7 px-2 text-xs"
        >
          Set Capital
        </Button>
        {isEditing && (
          <button
            onClick={() => {
              setInputValue('')
              setError('')
              setIsEditing(false)
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Cancel
          </button>
        )}
      </div>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  )
}
