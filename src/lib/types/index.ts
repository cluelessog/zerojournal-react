// ─── Raw Data Types ───────────────────────────────────────────────────────────

export interface RawTrade {
  symbol: string
  isin: string
  tradeDate: string        // ISO date string
  exchange: string
  segment: string
  series: string
  tradeType: 'buy' | 'sell'
  auction: string
  quantity: number
  price: number
  tradeId: string
  orderId: string
  orderExecutionTime: string
}

export interface SymbolPnL {
  symbol: string
  isin: string
  quantity: number
  buyValue: number
  sellValue: number
  realizedPnL: number
  unrealizedPnL: number
  openQuantity: number
  previousClosingPrice: number
  segment?: string
  series?: string
}

export interface ChargesBreakdown {
  brokerage: number
  exchangeTxnCharges: number
  sebiTurnoverFee: number
  stampDuty: number
  stt: number
  gst: number
  dpCharges: number
  total: number
}

export interface DPCharge {
  symbol: string
  isin: string
  date: string
  quantity: number
  dpChargeAmount: number
}

export interface PnLSummary {
  totalRealizedPnL: number
  totalUnrealizedPnL: number
  charges: ChargesBreakdown
  netPnL: number
}

// ─── Computed / Engine Types ──────────────────────────────────────────────────

export interface OrderGroup {
  id: string
  symbol: string
  isin: string
  openDate: string
  closeDate: string | null
  status: 'open' | 'closed'
  side: 'long' | 'short'
  buyTrades: RawTrade[]
  sellTrades: RawTrade[]
  totalBuyQty: number
  totalSellQty: number
  avgBuyPrice: number
  avgSellPrice: number
  realizedPnL: number
  unrealizedPnL: number
  charges: number
  netPnL: number
  holdingDays: number
  mae: number   // Maximum Adverse Excursion
  mfe: number   // Maximum Favorable Excursion
}

export interface DrawdownMetric {
  value: number // percentage or absolute INR (negative for drawdown, positive for drawup)
  peakDate: string
  troughDate: string
  status?: 'computed' | 'no_data'
  mode?: 'percentage' | 'absolute'
}

export interface StreakMetric {
  longestWinStreak: number
  longestLossStreak: number
  currentStreak: {
    type: 'win' | 'loss'
    count: number
  }
}

export interface MonthlyMetric {
  month: string       // YYYY-MM format
  trades: number
  grossPnL: number
  charges: number
  netPnL: number
  winRate: number     // 0-100
  maxDrawdown: number // percentage or absolute INR, <= 0 (peak-to-trough within the month)
  maxDrawdownMode?: 'percentage' | 'absolute'
  overallExpectancy?: number    // INR per trade for this month
  intradayExpectancy?: number   // INR per trade for intraday matches
  swingExpectancy?: number      // INR per trade for swing matches
}

export interface FIFOMatch {
  symbol: string
  buyDate: string       // YYYY-MM-DD
  sellDate: string      // YYYY-MM-DD
  quantity: number
  buyPrice: number
  sellPrice: number
  pnl: number           // (sellPrice - buyPrice) * quantity
  holdingDays: number   // 0 = intraday, > 0 = swing
}

export interface ExpectancyBreakdown {
  expectancy: number    // INR per trade = (winRate * avgWin) + ((1 - winRate) * avgLoss)
  avgWin: number
  avgLoss: number       // negative value
  winCount: number
  lossCount: number
  winRate: number       // 0-1 fraction
}

export interface ExpectancyMetric {
  overall: ExpectancyBreakdown
  intraday: ExpectancyBreakdown
  swing: ExpectancyBreakdown
}

export interface RiskRewardBreakdown {
  ratio: number         // avgWin / |avgLoss|, 0 if no losses
  avgWin: number
  avgLoss: number       // negative value
  winCount: number
  lossCount: number
}

export interface RiskRewardMetric {
  overall: RiskRewardBreakdown
  intraday: RiskRewardBreakdown
  swing: RiskRewardBreakdown
}

export interface RollingExpectancyPoint {
  tradeNumber: number   // 1-based index of the last trade in the window
  overall: number       // rolling expectancy (INR/trade) across all matches in window
  intraday: number      // rolling expectancy for intraday matches only
  swing: number         // rolling expectancy for swing matches only
}

export interface TradingStyleMetrics {
  count: number
  winRate: number       // 0-100 percentage
  avgPnL: number        // INR per trade
  totalPnL: number      // total INR
}

export interface TradingStyleResult {
  intraday: TradingStyleMetrics
  btst: TradingStyleMetrics
  velocity: TradingStyleMetrics
  swing: TradingStyleMetrics
  bestStyle: string | null    // style name, null if < 2 styles meet threshold
  worstStyle: string | null
}

export interface TradeAnalytics {
  totalTrades: number
  totalSymbols: number
  totalOrderGroups: number
  winningTrades: number
  losingTrades: number
  breakEvenTrades: number
  winRate: number
  avgWin: number
  avgLoss: number
  profitFactor: number
  totalRealizedPnL: number
  totalCharges: number
  netPnL: number
  tradingDays: number
  avgTradesPerDay: number
  bestTrade: { symbol: string; pnl: number } | null
  worstTrade: { symbol: string; pnl: number } | null
  longestHolding: OrderGroup | null
  mostTradedSymbol: string | null
  sharpeRatio: number
  maxDrawdown: DrawdownMetric
  minDrawup: DrawdownMetric
  streaks: StreakMetric
  monthlyBreakdown: MonthlyMetric[]
  fifoMatches: FIFOMatch[]
  expectancy: ExpectancyMetric
  riskReward: RiskRewardMetric
  rollingExpectancy: RollingExpectancyPoint[]
  tradingStyles: TradingStyleResult
}

// ─── Insight Types ──────────────────────────────────────────────────────────

export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info'

export interface Insight {
  id: string
  severity: InsightSeverity
  priority: number        // higher = more important, sorted descending
  title: string
  description: string
  metric?: string         // optional metric name for linking
  recommendation?: string // optional actionable advice
}

export interface CrossReferenceData {
  pnlBuyTotal: number
  pnlSellTotal: number
  pnlRealizedPnL: number
  tradebookBuyTotal: number
  tradebookSellTotal: number
  tradebookGrossPnL: number
  carryForwardCost: number
  hasCarryForward: boolean
}

export interface TimelinePoint {
  date: string
  dailyPnL: number
  cumulativePnL: number
  dailyNetPnL: number
  cumulativeNetPnL: number
  dailyCharges: number
  tradeCount: number
}

export interface PortfolioSnapshot {
  version: number
  importedAt: string
  trades: RawTrade[]
  orderGroups: OrderGroup[]
  symbolPnL: SymbolPnL[]
  pnlSummary: PnLSummary
  analytics: TradeAnalytics
  timeline: TimelinePoint[]
  dpCharges: DPCharge[]
}

export interface ImportMetadata {
  tradebookFileName: string | null
  pnlFileName: string | null
  tradebookRowCount: number
  pnlSymbolCount: number
  importedAt: string | null
  warnings: ParseWarning[]
}

// ─── Parser Types ─────────────────────────────────────────────────────────────

export interface ParseWarning {
  row: number
  field: string
  message: string
  rawValue: unknown
}

export interface ParseError {
  code: string
  message: string
  details?: unknown
}

export interface ParseTradebookResult {
  trades: RawTrade[]
  warnings: ParseWarning[]
  errors: ParseError[]
  rowCount: number
  skippedRows: number
}

export interface ParsePnLResult {
  symbolPnL: SymbolPnL[]
  pnlSummary: PnLSummary
  dpCharges: DPCharge[]
  warnings: ParseWarning[]
  errors: ParseError[]
}

export interface CrossRefResult {
  matched: number
  unmatched: string[]
  warnings: ParseWarning[]
}

// ─── Worker Types ────────────────────────────────────────────────────────────

export type WorkerRequest = {
  type: 'parse'
  tradebookFile: File
  pnlFile: File
}

export type WorkerResponse =
  | { type: 'complete'; result: { tradebook: ParseTradebookResult; pnl: ParsePnLResult } }
  | { type: 'error'; error: string }

// ─── UI Types ─────────────────────────────────────────────────────────────────

export interface TradeFilters {
  symbol: string
  dateFrom: string
  dateTo: string
  side: 'all' | 'long' | 'short'
  status: 'all' | 'open' | 'closed'
  minPnL: number | null
  maxPnL: number | null
}

export const defaultTradeFilters: TradeFilters = {
  symbol: '',
  dateFrom: '',
  dateTo: '',
  side: 'all',
  status: 'all',
  minPnL: null,
  maxPnL: null,
}

// ─── DB Schema ────────────────────────────────────────────────────────────────

export interface ZeroJournalDBSchema {
  portfolio: {
    key: 'current'
    value: PortfolioSnapshot
  }
  metadata: {
    key: string
    value: ImportMetadata
  }
  settings: {
    key: string
    value: unknown
  }
}
