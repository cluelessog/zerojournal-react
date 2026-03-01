import * as React from 'react'
import { useReactTable, flexRender } from '@tanstack/react-table'
import {
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
} from '@tanstack/table-core'
import type {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  RowData,
  Table as TTable,
  Row,
  Header,
  Cell,
  HeaderGroup,
} from '@tanstack/table-core'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type { ColumnDef, RowData }

interface DataTableProps<TData extends RowData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  pageSize?: number
  globalFilter?: string
  onRowClick?: (row: TData) => void
  expandedRowId?: string | null
  getRowId?: (row: TData) => string
  renderSubRow?: (row: TData) => React.ReactNode
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp className="size-3 ml-1 inline" />
  if (sorted === 'desc') return <ChevronDown className="size-3 ml-1 inline" />
  return <ChevronsUpDown className="size-3 ml-1 inline opacity-40" />
}

export function DataTable<TData extends RowData>({
  columns,
  data,
  pageSize = 50,
  globalFilter,
  onRowClick,
  expandedRowId,
  getRowId,
  renderSubRow,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, globalFilter: globalFilter ?? '' },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: { pagination: { pageSize } },
    getRowId,
  }) as TTable<TData>

  const { pageIndex, pageSize: ps } = table.getState().pagination
  const totalRows = table.getFilteredRowModel().rows.length
  const startRow = pageIndex * ps + 1
  const endRow = Math.min(startRow + ps - 1, totalRows)

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup: HeaderGroup<TData>) => (
              <TableRow key={headerGroup.id} className="bg-muted/30 hover:bg-muted/30">
                {headerGroup.headers.map((header: Header<TData, unknown>) => {
                  const canSort = header.column.getCanSort()
                  const sorted = header.column.getIsSorted()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        canSort && 'cursor-pointer select-none hover:text-foreground',
                        header.column.columnDef.meta?.className
                      )}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      {header.isPlaceholder ? null : (
                        <span className="inline-flex items-center">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIcon sorted={sorted} />}
                        </span>
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row: Row<TData>) => {
                const rowId = getRowId ? getRowId(row.original) : row.id
                const isExpanded = expandedRowId === rowId
                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={cn(
                        onRowClick && 'cursor-pointer',
                        isExpanded && 'bg-muted/50'
                      )}
                      onClick={() => onRowClick?.(row.original)}
                    >
                      {row.getVisibleCells().map((cell: Cell<TData, unknown>) => (
                        <TableCell
                          key={cell.id}
                          className={cn(cell.column.columnDef.meta?.className)}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                    {isExpanded && renderSubRow && (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={columns.length} className="p-0">
                          {renderSubRow(row.original)}
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1 text-sm text-muted-foreground">
        <span>
          {totalRows === 0
            ? 'No rows'
            : `${startRow}–${endRow} of ${totalRows} rows`}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2">
            Page {pageIndex + 1} of {table.getPageCount() || 1}
          </span>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
