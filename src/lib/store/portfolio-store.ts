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

    const trades = tradebookResult.trades
    const { symbolPnL, pnlSummary, dpCharges } = pnlResult

    const analytics = computeAnalytics({ trades, symbolPnL, pnlSummary, orderGroups })
    const timeline = buildTimeline(trades, symbolPnL, 'daily')

    const snapshot: PortfolioSnapshot = {
      version: 1,
      importedAt: now,
      trades,
      orderGroups,
      symbolPnL,
      pnlSummary,
      analytics,
      timeline,
      dpCharges,
    }

    const metadata: ImportMetadata = {
      tradebookFileName: null,
      pnlFileName: null,
      tradebookRowCount: trades.length,
      pnlSymbolCount: symbolPnL.length,
      importedAt: now,
      warnings: [...tradebookResult.warnings, ...pnlResult.warnings],
    }

    set({
      trades,
      orderGroups,
      symbolPnL,
      pnlSummary,
      dpCharges,
      analytics,
      timeline,
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
      const currentAnalytics = computeAnalytics({
        trades: snapshot.trades,
        symbolPnL: snapshot.symbolPnL,
        pnlSummary: snapshot.pnlSummary,
        orderGroups: snapshot.orderGroups,
      })
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
    await deleteAll()
    set(initialState)
  },

  resetData: () => {
    set(initialState)
  },

  getAnalytics: () => {
    return get().analytics
  },
}))
