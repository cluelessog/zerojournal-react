import { create } from 'zustand'
import type {
  RawTrade,
  OrderGroup,
  SymbolPnL,
  PnLSummary,
  DPCharge,
  TradeAnalytics,
  TimelinePoint,
  ImportMetadata,
  PortfolioSnapshot,
  ParseTradebookResult,
  ParsePnLResult,
} from '@/lib/types'
import { groupOrders } from '@/lib/engine/order-grouper'
import { computeAnalytics } from '@/lib/engine/analytics'
import { buildTimeline } from '@/lib/engine/timeline'
import { savePortfolio, loadPortfolio, deleteAll } from '@/lib/persistence/db'
import { getSettings, setSettings } from '@/lib/persistence/storage'

interface PortfolioStore {
  // State
  trades: RawTrade[]
  orderGroups: OrderGroup[]
  symbolPnL: SymbolPnL[]
  pnlSummary: PnLSummary | null
  dpCharges: DPCharge[]
  analytics: TradeAnalytics | null
  timeline: TimelinePoint[]
  importMetadata: ImportMetadata | null
  isLoaded: boolean
  initialCapital: number | null

  // Actions
  importData: (tradebookResult: ParseTradebookResult, pnlResult: ParsePnLResult) => Promise<void>
  loadFromDB: () => Promise<void>
  clearData: () => Promise<void>
  resetData: () => void
  getAnalytics: () => TradeAnalytics | null
  setInitialCapital: (capital: number) => void
  clearInitialCapital: () => void
}

const initialState = {
  trades: [],
  orderGroups: [],
  symbolPnL: [],
  pnlSummary: null,
  dpCharges: [],
  analytics: null,
  timeline: [],
  importMetadata: null,
  isLoaded: false,
  initialCapital: null as number | null,
}

export const usePortfolioStore = create<PortfolioStore>((set, get) => ({
  ...initialState,

  importData: async (tradebookResult: ParseTradebookResult, pnlResult: ParsePnLResult) => {
    const orderGroups = groupOrders(tradebookResult.trades)
    const now = new Date().toISOString()

    // Build a partial snapshot for analytics computation
    const snapshot: PortfolioSnapshot = {
      version: 1,
      importedAt: now,
      trades: tradebookResult.trades,
      orderGroups,
      symbolPnL: pnlResult.symbolPnL,
      pnlSummary: pnlResult.pnlSummary,
      analytics: null as unknown as TradeAnalytics, // will be set below
      timeline: [],
      dpCharges: pnlResult.dpCharges,
    }

    const analytics = computeAnalytics(snapshot, get().initialCapital)
    const timeline = buildTimeline(tradebookResult.trades, pnlResult.symbolPnL, 'daily')

    snapshot.analytics = analytics
    snapshot.timeline = timeline

    const metadata: ImportMetadata = {
      tradebookFileName: null,
      pnlFileName: null,
      tradebookRowCount: tradebookResult.trades.length,
      pnlSymbolCount: pnlResult.symbolPnL.length,
      importedAt: now,
      warnings: [...tradebookResult.warnings, ...pnlResult.warnings],
    }

    set({
      trades: snapshot.trades,
      orderGroups: snapshot.orderGroups,
      symbolPnL: snapshot.symbolPnL,
      pnlSummary: snapshot.pnlSummary,
      dpCharges: snapshot.dpCharges,
      analytics: snapshot.analytics,
      timeline: snapshot.timeline,
      isLoaded: true,
      importMetadata: metadata,
    })

    await savePortfolio(snapshot)
  },

  loadFromDB: async () => {
    try {
      const snapshot = await loadPortfolio()
      if (!snapshot) {
        return
      }
      // Load persisted initial capital before recomputing analytics
      const savedCapital = await getSettings<number>('initialCapital')
      if (savedCapital !== undefined && savedCapital !== null) {
        set({ initialCapital: savedCapital })
      }
      // Recompute analytics to ensure compatibility with any type changes (e.g., new MonthlyMetric.maxDrawdown field)
      const currentCapital = savedCapital ?? get().initialCapital
      const currentAnalytics = computeAnalytics(snapshot, currentCapital)
      set({
        trades: snapshot.trades,
        orderGroups: snapshot.orderGroups,
        symbolPnL: snapshot.symbolPnL,
        pnlSummary: snapshot.pnlSummary,
        dpCharges: snapshot.dpCharges,
        analytics: currentAnalytics,
        timeline: snapshot.timeline,
        isLoaded: true,
        importMetadata: {
          tradebookFileName: null,
          pnlFileName: null,
          tradebookRowCount: snapshot.trades.length,
          pnlSymbolCount: snapshot.symbolPnL.length,
          importedAt: snapshot.importedAt,
          warnings: [],
        },
      })
    } catch (err) {
      console.error('[PortfolioStore] loadFromDB failed', err)
    }
  },

  clearData: async () => {
    set(initialState)
    await deleteAll()
  },

  resetData: () => {
    set(initialState)
  },

  getAnalytics: () => {
    return get().analytics
  },

  setInitialCapital: (capital: number) => {
    set({ initialCapital: capital })
    // Persist to IndexedDB
    setSettings('initialCapital', capital).catch((err) =>
      console.error('[PortfolioStore] Failed to persist initialCapital', err)
    )
    // Recompute analytics with the new capital
    const state = get()
    if (state.isLoaded && state.pnlSummary) {
      const snapshot: PortfolioSnapshot = {
        version: 1,
        importedAt: state.importMetadata?.importedAt ?? new Date().toISOString(),
        trades: state.trades,
        orderGroups: state.orderGroups,
        symbolPnL: state.symbolPnL,
        pnlSummary: state.pnlSummary,
        analytics: state.analytics!,
        timeline: state.timeline,
        dpCharges: state.dpCharges,
      }
      const analytics = computeAnalytics(snapshot, capital)
      set({ analytics })
    }
  },

  clearInitialCapital: () => {
    set({ initialCapital: null })
    // Remove from IndexedDB
    setSettings('initialCapital', null).catch((err) =>
      console.error('[PortfolioStore] Failed to clear initialCapital', err)
    )
    // Recompute analytics without capital
    const state = get()
    if (state.isLoaded && state.pnlSummary) {
      const snapshot: PortfolioSnapshot = {
        version: 1,
        importedAt: state.importMetadata?.importedAt ?? new Date().toISOString(),
        trades: state.trades,
        orderGroups: state.orderGroups,
        symbolPnL: state.symbolPnL,
        pnlSummary: state.pnlSummary,
        analytics: state.analytics!,
        timeline: state.timeline,
        dpCharges: state.dpCharges,
      }
      const analytics = computeAnalytics(snapshot, null)
      set({ analytics })
    }
  },
}))
