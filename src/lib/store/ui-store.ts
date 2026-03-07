import { create } from 'zustand'
import type { TradeFilters } from '@/lib/types'
import { defaultTradeFilters } from '@/lib/types'

type TradeTypeFilter = 'all' | 'buy' | 'sell'
type GroupBy = 'none' | 'symbol' | 'order'

interface UIStore {
  // State
  sidebarOpen: boolean
  activeTab: string
  filters: TradeFilters

  // Trade page state
  selectedSymbols: string[]
  dateRange: { from: string; to: string }
  tradeTypeFilter: TradeTypeFilter
  groupBy: GroupBy

  // Actions
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void
  setActiveTab: (tab: string) => void
  setFilters: (filters: Partial<TradeFilters>) => void
  resetFilters: () => void

  // Trade page actions
  setSymbols: (symbols: string[]) => void
  setDateRange: (range: { from: string; to: string }) => void
  setTradeType: (type: TradeTypeFilter) => void
  setGroupBy: (groupBy: GroupBy) => void
  resetTradeFilters: () => void

}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  activeTab: 'overview',
  filters: defaultTradeFilters,

  // Trade page initial state
  selectedSymbols: [],
  dateRange: { from: '', to: '' },
  tradeTypeFilter: 'all',
  groupBy: 'none',

  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setActiveTab: (tab) => set({ activeTab: tab }),
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

}))
