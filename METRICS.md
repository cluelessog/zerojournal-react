# Metrics Methodology

This document explains the calculation methodology for key trading metrics in zeroJournal v2.

## Sharpe Ratio

### Formula

```
Sharpe = (mean(R) - Rf) / std(R) × √252
```

Where:
- `R` = daily percentage returns (realized P&L / daily invested capital)
- `Rf` = annualized risk-free rate (default: 2%, converted to daily: 2% / 252)
- `std(R)` = sample standard deviation of daily returns (N-1 denominator)
- `√252` = annualization factor (252 trading days per year)

### Calculation Process

1. **FIFO Matching**: Match buy and sell trades using FIFO to get realized P&L per position close.
2. **Daily Realized P&L**: Group FIFO matches by sell date, sum realized P&L per date.
3. **Daily Capital Deployed**: For each sell date, sum `buyPrice × quantity` of all matches closing that day.
4. **Charge Distribution**: Total charges distributed proportionally by daily turnover: `dayCharges = totalCharges × (dayTurnover / totalTurnover)`.
5. **Net Daily P&L**: `grossDailyPnL - dayCharges`.
6. **Daily Percentage Returns**: For each sell date with capital > 0, compute `netDailyPnL / dailyCapitalDeployed`.
7. **Sharpe Calculation**: Apply the formula above to the net percentage returns array.

Note: Prior versions used raw buy/sell cashflows which produced impossible daily returns
for swing trades (e.g., buy day 1 = -100%, sell day 2 = +110%). The FIFO-match approach
correctly attributes realized P&L to the sell date only.

### Edge Cases

- **Fewer than 2 returns**: Sharpe = 0 (insufficient data)
- **Zero standard deviation**: Sharpe = 0 (no volatility to measure)
- **No buy trades**: Sharpe = 0 (no capital deployed)

### Example

```
Day 1: Buy 100 @ INR 500 (capital = 50,000), sell @ INR 502
  Daily P&L = 200
  Daily return = 200 / 50,000 = 0.004 (0.4%)

Day 2: Identical
  Daily return = 0.004

Sharpe = ((0.004 - 0.02/252) / std(0.004, 0.004)) × √252
       ≈ 7.99 (very high, since volatility is near zero)
```

### Industry Standards

- **Reference**: Sharpe, W. (1994). "The Sharpe Ratio". Journal of Portfolio Management.
- **Academic**: Taught in CFA curriculum as the standard risk-adjusted return metric
- **Professional Use**: Implemented in Tradervue, Edgewonk, and professional trading journals

## Maximum Drawdown

### Formula

```
Drawdown(t) = (V(t) - Peak(t)) / Peak(t) × 100%
```

Where:
- `V(t)` = cumulative portfolio value at time t
- `Peak(t)` = maximum cumulative value before time t

### Calculation Process

1. Build cumulative P&L series from `SymbolPnL.realizedPnL` distributed across sell dates proportionally by sell quantity (per-trade attribution)
2. Deduct charges proportionally by turnover at each close date (net equity curve): `dayCharges = totalCharges × (dayTurnover / totalTurnover)`, last date gets remainder to prevent rounding drift
3. Track the running maximum (high-water mark) as you walk through time
4. At each point, compute the percentage decline from that peak
5. Return the worst (most negative) drawdown value

### Maximum Drawdown per Month

Same algorithm, but applied to each calendar month independently:
- Extract closed positions whose close month is this month
- Build net cumulative P&L from `SymbolPnL.realizedPnL` within the month, with turnover-proportional charges deducted (same fee model as overall drawdown)
- Apply the high-water-mark algorithm with month-start equity (capital + prior months' cumulative P&L) as baseline
- Return the month's maximum drawdown

### Edge Cases

- **Month never goes positive**: drawdown = 0 (no peak established)
- **Single trade month**: drawdown = 0 (single point, no peak)
- **All losses**: drawdown approaches -100%

### Data Sources

- **Overall drawdown** (`TradeAnalytics.maxDrawdown`): Uses `SymbolPnL.realizedPnL` distributed across sell dates proportionally by sell quantity (per-trade attribution)
- **Monthly drawdown** (`MonthlyMetric.maxDrawdown`): Same per-trade attribution, filtered to the month's dates, with month-start equity as baseline
- **Monthly P&L** (`MonthlyMetric.netPnL`): Uses `SymbolPnL.realizedPnL` from the PnL file

Note: These data sources may diverge for multi-day positions (e.g., position opened in Month A, closed in Month B). This is expected and acceptable.

### Industry Standards

- **Definition**: Standard definition per Investopedia, CFA curriculum
- **Professional Use**: Core metric in risk management across all trading domains

## Win Rate

### Formula

```
Win% = (winning trades / total trades) × 100%
```

Where:
- Winning trade = realized P&L > 0
- Losing trade = realized P&L < 0
- Breakeven trade = realized P&L === 0 (counted separately)

### Monthly Win Rate

Monthly win rate uses **close-month** cohort: a position is counted in the month its last sell trade occurred. This ensures all metrics in a monthly row (win rate, P&L, drawdown, expectancy) describe the same set of positions.

## Gross P&L vs Net P&L

- **Gross P&L**: Total realized P&L from all closed positions
- **Charges**: Fees, commissions, slippage allocated to the period
- **Net P&L**: Gross P&L - Charges

### Charge Distribution

All metrics that use daily P&L (Sharpe ratio, max drawdown, min drawup, P&L timeline, monthly breakdown) distribute total charges proportionally by **turnover**:

```
dayCharges = totalCharges × (dayTurnover / totalTurnover)
```

This matches how charges actually accrue: STT (% of sell value), brokerage (% of trade value), exchange transaction charges, stamp duty, and GST all scale with trade value, not trade count.

The last date in any series receives `totalCharges - sumOfPriorAllocations` to ensure zero rounding drift.

**Charge source**: `PnLSummary.charges.total` (excludes DP charges, consistent with existing convention).

### P&L Timeline Chart

The equity curve defaults to **Net P&L** (after charges). A Gross/Net toggle allows switching views. This follows GIPS 2020 standards and CFA curriculum guidance that net returns represent "what investors actually earned."

---

**Version**: 1.2
**Last Updated**: 2026-03-08
**Author**: zeroJournal Development Team
