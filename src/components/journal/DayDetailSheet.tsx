import { useMemo, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { PlusCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { TradeBubbleDiagram } from '@/components/journal/TradeBubbleDiagram'
import { DayJournalEntries } from '@/components/journal/DayJournalEntries'
import type { FIFOMatch, OrderGroup, JournalEntry } from '@/lib/types'

interface DayDetailSheetProps {
  date: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  fifoMatches: FIFOMatch[]
  orderGroups: OrderGroup[]
  journalEntries: JournalEntry[]
  onAddEntry: (symbol?: string) => void
  onEditEntry: (entry: JournalEntry) => void
  onDeleteEntry: (id: string) => void
  editorSlot?: ReactNode
}

function formatRs(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 100000) {
    return `${value < 0 ? '-' : ''}Rs. ${(abs / 100000).toFixed(2)}L`
  }
  return `${value < 0 ? '-' : ''}Rs. ${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export function DayDetailSheet({
  date,
  open,
  onOpenChange,
  fifoMatches,
  orderGroups,
  journalEntries,
  onAddEntry,
  onEditEntry,
  onDeleteEntry,
  editorSlot,
}: DayDetailSheetProps) {
  const dayFifoMatches = useMemo(
    () => (date ? fifoMatches.filter((m) => m.sellDate === date) : []),
    [fifoMatches, date]
  )

  const dayOrderGroups = useMemo(
    () =>
      date
        ? orderGroups.filter(
            (og) =>
              og.closeDate === date ||
              (og.openDate === date && og.status === 'open')
          )
        : [],
    [orderGroups, date]
  )

  const dayEntries = useMemo(
    () => (date ? journalEntries.filter((e) => e.tradeDate === date) : []),
    [journalEntries, date]
  )

  const totalPnL = useMemo(
    () => dayFifoMatches.reduce((sum, m) => sum + m.pnl, 0),
    [dayFifoMatches]
  )

  const tradeCount = dayFifoMatches.length + dayOrderGroups.filter(
    (og) => !dayFifoMatches.some((m) => m.symbol === og.symbol)
  ).length

  const formattedDate = date
    ? format(parseISO(date), 'EEEE, d MMMM yyyy')
    : ''

  const pnlSign = totalPnL > 0 ? '+' : ''
  const pnlColor =
    totalPnL > 0
      ? 'text-green-600 dark:text-green-400'
      : totalPnL < 0
      ? 'text-red-600 dark:text-red-400'
      : 'text-gray-500 dark:text-gray-400'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-gray-200 dark:border-gray-700">
          <DialogTitle className="text-base font-semibold leading-tight">
            {formattedDate}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-3 text-sm">
            {dayFifoMatches.length > 0 || dayOrderGroups.length > 0 ? (
              <>
                <span className={pnlColor}>
                  {pnlSign}{formatRs(totalPnL)}
                </span>
                <span className="text-gray-400 dark:text-gray-600">&middot;</span>
                <span>
                  {tradeCount} {tradeCount === 1 ? 'trade' : 'trades'}
                </span>
              </>
            ) : (
              <span>No trades on this day</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-5">
          {/* Trade Bubbles */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Trade Activity
            </h3>
            <TradeBubbleDiagram
              fifoMatches={dayFifoMatches}
              orderGroups={dayOrderGroups}
              onBubbleClick={(symbol) => onAddEntry(symbol)}
            />
          </section>

          {/* Editor (replaces entries when active) or Journal Entries */}
          {editorSlot ? (
            <section>{editorSlot}</section>
          ) : (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Journal Entries
              </h3>
              <DayJournalEntries
                entries={dayEntries}
                onEdit={onEditEntry}
                onDelete={onDeleteEntry}
              />
            </section>
          )}
        </div>

        {/* Footer: Add Entry (hidden when editor is open) */}
        {!editorSlot && (
          <DialogFooter className="px-5 py-3 border-t border-gray-200 dark:border-gray-700">
            <Button
              className="w-full"
              onClick={() => onAddEntry()}
            >
              <PlusCircle className="size-4 mr-2" />
              Add Journal Entry
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
