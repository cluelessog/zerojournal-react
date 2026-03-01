import * as React from 'react'
import { Search, Download, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type TradeTypeFilter = 'all' | 'buy' | 'sell'
type GroupBy = 'none' | 'symbol' | 'order'

interface TradeFiltersProps {
  symbols: string[]
  selectedSymbols: string[]
  dateFrom: string
  dateTo: string
  tradeTypeFilter: TradeTypeFilter
  groupBy: GroupBy
  onSymbolsChange: (symbols: string[]) => void
  onDateFromChange: (date: string) => void
  onDateToChange: (date: string) => void
  onTradeTypeChange: (type: TradeTypeFilter) => void
  onGroupByChange: (groupBy: GroupBy) => void
  onExportCSV: () => void
  onReset: () => void
}

function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-sm font-medium transition-colors',
            value === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function TradeFilters({
  symbols,
  selectedSymbols,
  dateFrom,
  dateTo,
  tradeTypeFilter,
  groupBy,
  onSymbolsChange,
  onDateFromChange,
  onDateToChange,
  onTradeTypeChange,
  onGroupByChange,
  onExportCSV,
  onReset,
}: TradeFiltersProps) {
  const [symbolSearch, setSymbolSearch] = React.useState('')
  const [showDropdown, setShowDropdown] = React.useState(false)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const filteredSymbols = React.useMemo(
    () =>
      symbols.filter(
        (s) =>
          s.toLowerCase().includes(symbolSearch.toLowerCase()) &&
          !selectedSymbols.includes(s)
      ),
    [symbols, symbolSearch, selectedSymbols]
  )

  // Close dropdown on outside click
  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const addSymbol = (sym: string) => {
    onSymbolsChange([...selectedSymbols, sym])
    setSymbolSearch('')
    setShowDropdown(false)
  }

  const removeSymbol = (sym: string) => {
    onSymbolsChange(selectedSymbols.filter((s) => s !== sym))
  }

  const hasActiveFilters =
    selectedSymbols.length > 0 ||
    dateFrom !== '' ||
    dateTo !== '' ||
    tradeTypeFilter !== 'all' ||
    groupBy !== 'none'

  return (
    <div className="flex flex-wrap items-end gap-3 p-4 bg-card border border-border rounded-lg">
      {/* Date range */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">From</label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-8 w-36 text-sm"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">To</label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-8 w-36 text-sm"
        />
      </div>

      {/* Symbol combobox */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Symbol</label>
        <div className="relative" ref={dropdownRef}>
          <div className="flex items-center gap-1 flex-wrap min-w-48 max-w-72 rounded-md border border-input bg-background px-2 py-1">
            {selectedSymbols.map((sym) => (
              <span
                key={sym}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs px-2 py-0.5"
              >
                {sym}
                <button onClick={() => removeSymbol(sym)} className="hover:text-destructive">
                  <X className="size-3" />
                </button>
              </span>
            ))}
            <div className="flex items-center gap-1 flex-1 min-w-20">
              <Search className="size-3 text-muted-foreground shrink-0" />
              <input
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                placeholder={selectedSymbols.length === 0 ? 'Search symbol…' : ''}
                value={symbolSearch}
                onChange={(e) => {
                  setSymbolSearch(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
              />
            </div>
          </div>
          {showDropdown && filteredSymbols.length > 0 && (
            <div className="absolute top-full left-0 z-50 mt-1 w-56 max-h-64 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              {filteredSymbols.map((sym) => (
                <button
                  key={sym}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    addSymbol(sym)
                  }}
                >
                  {sym}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trade type toggle */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Type</label>
        <ToggleGroup
          options={[
            { label: 'All', value: 'all' as TradeTypeFilter },
            { label: 'Buy', value: 'buy' as TradeTypeFilter },
            { label: 'Sell', value: 'sell' as TradeTypeFilter },
          ]}
          value={tradeTypeFilter}
          onChange={onTradeTypeChange}
        />
      </div>

      {/* Group by toggle */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-muted-foreground font-medium">Group by</label>
        <ToggleGroup
          options={[
            { label: 'None', value: 'none' as GroupBy },
            { label: 'Symbol', value: 'symbol' as GroupBy },
            { label: 'Order', value: 'order' as GroupBy },
          ]}
          value={groupBy}
          onChange={onGroupByChange}
        />
      </div>

      {/* Actions */}
      <div className="flex items-end gap-2 ml-auto">
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="size-4 mr-1" />
            Reset
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={onExportCSV}>
          <Download className="size-4 mr-1" />
          Export CSV
        </Button>
      </div>
    </div>
  )
}
