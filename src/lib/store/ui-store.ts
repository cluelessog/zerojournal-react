import { create } from 'zustand'
import type { TradeFilters } from '@/lib/types'
import { defaultTradeFilters } from '@/lib/types'

type TradeTypeFilter = 'all' | 'buy' | 'sell'
type GroupBy = 'none' | 'symbol' | 'order'

interface UIStore {
  // State
  sidebarOpen: boolean
  filters: TradeFilters

  // Trade page state
  selectedSymbols: string[]
  dateRange: { from: string; to: string }
  tradeTypeFilter: TradeTypeFilter
  groupBy: GroupBy

  // Chart state
  // NOTE: initialCapital exists in both UIStore (chart display toggle) and PortfolioStore (persisted, used for analytics).
  // UIStore.initialCapital controls chart rendering mode; PortfolioStore.initialCapital drives drawdown calculations.
  // A future refactor should unify these into a single source of truth.
  initialCapital: number | null  // null = show cumulative P&L; number = show portfolio value

  // Actions
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setFilters: (filters: Partial<TradeFilters>) => void
  resetFilters: () => void

  // Trade page actions
  setSymbols: (symbols: string[]) => void
  setDateRange: (range: { from: string; to: string }) => void
  setTradeType: (type: TradeTypeFilter) => void
  setGroupBy: (groupBy: GroupBy) => void
  resetTradeFilters: () => void

  // Chart actions
  setInitialCapital: (capital: number | null) => void
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  filters: defaultTradeFilters,

  // Trade page initial state
  selectedSymbols: [],
  dateRange: { from: '', to: '' },
  tradeTypeFilter: 'all',
  groupBy: 'none',

  // Chart state
  initialCapital: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  resetFilters: () => set({ filters: defaultTradeFilters }),

  // Trade page actions
  setSymbols: (symbols) => set({ selectedSymbols: symbols }),
  setDateRange: (range) => set({ dateRange: range }),
  setTradeType: (type) => set({ tradeTypeFilter: type }),
  setGroupBy: (groupBy) => set({ groupBy }),
  resetTradeFilters: () =>
    set({
      selectedSymbols: [],
      dateRange: { from: '', to: '' },
      tradeTypeFilter: 'all',
      groupBy: 'none',
    }),

  // Chart actions
  setInitialCapital: (capital) => set({ initialCapital: capital }),
}))
