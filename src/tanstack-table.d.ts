import type { TableOptions, RowData, Table } from '@tanstack/table-core'
import type * as React from 'react'

// Augment ColumnMeta to support className
declare module '@tanstack/table-core' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string
  }
}

// Declare @tanstack/react-table's React-specific exports for tsc -b compatibility
declare module '@tanstack/react-table' {
  export * from '@tanstack/table-core'

  type Renderable<TProps> = React.ReactNode | React.ComponentType<TProps>

  export function flexRender<TProps extends object>(
    Comp: Renderable<TProps>,
    props: TProps
  ): React.ReactNode | React.JSX.Element

  export function useReactTable<TData extends RowData>(
    options: TableOptions<TData>
  ): Table<TData>
}
