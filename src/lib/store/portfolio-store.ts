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

  // Actions
  importData: (tradebookResult: ParseTradebookResult, pnlResult: ParsePnLResult) => Promise<void>
  loadFromDB: () => Promise<void>
  clearData: () => Promise<void>
  resetData: () => void
  getAnalytics: () => TradeAnalytics | null
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

    const analytics = computeAnalytics(snapshot)
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
      // Recompute analytics to ensure compatibility with any type changes (e.g., new MonthlyMetric.maxDrawdown field)
      const currentAnalytics = computeAnalytics(snapshot)
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
}))
